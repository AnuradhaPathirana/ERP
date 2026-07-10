<?php

declare(strict_types=1);

namespace Modules\Inventory\Services;

use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;
use Modules\Inventory\Enums\CostingStatus;
use Modules\Inventory\Enums\GrnStatus;
use Modules\Inventory\Models\GoodsReceivedNoteItem;
use Modules\Inventory\Models\GrnItemPiece;

/**
 * Single source of truth for product price resolution.
 *
 * Selling prices live on the "Channels / Price List" pivot
 * (inv_product_sales_channels); purchase costs live on confirmed GRN
 * lines (per-shipment history) with the latest cost mirrored onto the
 * pivot's cost_price by syncLastCost(). Keep every price lookup here so
 * future pricing strategies (customer-type price lists, promotions,
 * quantity breaks) extend one class instead of leaking into documents.
 */
class ProductPricingService
{
    private const PIVOT_TABLE = 'inv_product_sales_channels';

    /**
     * Default selling price for a product — the primary (first) price-list
     * row. Null when the product has no channel pricing configured.
     */
    public function sellingPriceFor(int $productId): ?float
    {
        $price = DB::table(self::PIVOT_TABLE)
            ->where('product_id', $productId)
            ->orderBy('id')
            ->value('selling_price');

        return $price !== null ? (float) $price : null;
    }

    /** Latest confirmed-GRN purchase cost (last-cost method). */
    public function lastCostFor(int $productId): ?float
    {
        $price = GoodsReceivedNoteItem::where('product_id', $productId)
            ->whereHas('grn', fn ($q) => $q->where('status', GrnStatus::Confirmed->value))
            ->orderByDesc('id')
            ->value('unit_price');

        return $price !== null ? (float) $price : null;
    }

    /**
     * Both prices in one call — selling for the sale-price default,
     * cost for the below-cost guard.
     *
     * @return array{selling_price: ?float, cost_price: ?float}
     */
    public function pricingFor(int $productId): array
    {
        return [
            'selling_price' => $this->sellingPriceFor($productId),
            'cost_price'    => $this->lastCostFor($productId),
        ];
    }

    /**
     * Shipment-specific selling price: the confirmed costing's per-line price
     * for a GRN item. Unique by design — a GRN can live in only one CONFIRMED
     * costing (enforced by CostingService::confirm). Null = not costed yet.
     */
    public function sellingPriceForGrnItem(int $grnItemId): ?float
    {
        $price = DB::table('inv_costing_items')
            ->join('inv_costings', 'inv_costings.id', '=', 'inv_costing_items.costing_id')
            ->where('inv_costing_items.grn_item_id', $grnItemId)
            ->where('inv_costings.status', CostingStatus::Confirmed->value)
            ->whereNull('inv_costings.deleted_at')
            ->orderByDesc('inv_costing_items.id')
            ->value('inv_costing_items.selling_price');

        return $price !== null ? (float) $price : null;
    }

    /**
     * The price a specific roll sells at: its shipment's confirmed-costing
     * price first ("old stock at old price, new stock at new price"), the
     * product price list as fallback.
     *
     * @return array{price: ?float, source: 'costing'|'price_list'|null}
     */
    public function resolvePieceSellingPrice(GrnItemPiece $piece): array
    {
        if ($piece->grn_item_id !== null) {
            $costingPrice = $this->sellingPriceForGrnItem((int) $piece->grn_item_id);
            if ($costingPrice !== null) {
                return ['price' => $costingPrice, 'source' => 'costing'];
            }
        }

        $listPrice = $this->sellingPriceFor((int) $piece->product_id);

        return ['price' => $listPrice, 'source' => $listPrice !== null ? 'price_list' : null];
    }

    /**
     * Mirror a newly received purchase cost onto the product's price-list
     * rows (last-cost method). Selling prices are NEVER touched — margins
     * are the user's decision on the Product form / Costing.
     */
    public function syncLastCost(int $productId, ?int $unitTypeId, float $cost): void
    {
        $this->targetRows($productId, $unitTypeId)
            ->update(['cost_price' => $cost, 'updated_at' => now()]);
    }

    /**
     * Confirmed-costing write-back: the price list mirrors the NEWEST costed
     * shipment — landed cost into cost_price, costing selling price into
     * selling_price. Older shipments keep pricing from their own costing
     * (resolved per roll via resolvePieceSellingPrice).
     */
    public function syncFromCosting(int $productId, ?int $unitTypeId, float $landedCost, float $sellingPrice): void
    {
        $this->targetRows($productId, $unitTypeId)->update([
            'cost_price'    => $landedCost,
            'selling_price' => $sellingPrice,
            'updated_at'    => now(),
        ]);
    }

    /**
     * Price-list rows a sync applies to: rows matching the unit (or carrying
     * no unit); if none match, every row of the product, so single-list
     * products stay in sync regardless of unit setup. No rows = no-op update.
     */
    private function targetRows(int $productId, ?int $unitTypeId): Builder
    {
        $base = DB::table(self::PIVOT_TABLE)->where('product_id', $productId);

        $scoped = $unitTypeId !== null
            ? (clone $base)->where(fn ($q) => $q->where('unit_type_id', $unitTypeId)->orWhereNull('unit_type_id'))
            : $base;

        return ($unitTypeId !== null && ! (clone $scoped)->exists()) ? $base : $scoped;
    }
}
