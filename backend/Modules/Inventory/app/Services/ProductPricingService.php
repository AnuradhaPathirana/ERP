<?php

declare(strict_types=1);

namespace Modules\Inventory\Services;

use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;
use Modules\Inventory\Enums\CostingStatus;
use Modules\Inventory\Enums\GrnStatus;
use Modules\Inventory\Models\GoodsReceivedNoteItem;
use Modules\Inventory\Models\GrnItemPiece;
use Modules\Inventory\Models\Product;

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

    public function __construct(private readonly UnitConversionService $units)
    {
    }

    /**
     * Default selling price for a product — the primary (first) price-list row,
     * expressed PER THE PRODUCT'S STOCKING UOM. Null when the product has no channel
     * pricing, or when its price is filed in a unit that cannot be converted.
     *
     * Every price this class returns is per the base UOM, because a price is meaningless
     * without its unit: a list price of 400 filed against "m" is not 400 per yard, and
     * handing that number to a yard-denominated sales line overcharges by 9%.
     */
    public function sellingPriceFor(int $productId): ?float
    {
        $row = DB::table(self::PIVOT_TABLE)
            ->where('product_id', $productId)
            ->orderBy('id')
            ->first(['selling_price', 'unit_type_id']);

        return $this->toBasePrice(
            $productId,
            $row?->unit_type_id !== null ? (int) $row->unit_type_id : null,
            $row?->selling_price !== null ? (float) $row->selling_price : null,
        );
    }

    /** Latest confirmed-GRN purchase cost (last-cost method), per the stocking UOM. */
    public function lastCostFor(int $productId): ?float
    {
        $line = GoodsReceivedNoteItem::where('product_id', $productId)
            ->whereHas('grn', fn ($q) => $q->where('status', GrnStatus::Confirmed->value))
            ->orderByDesc('id')
            ->first(['unit_price', 'unit_id']);

        return $this->toBasePrice(
            $productId,
            $line?->unit_id !== null ? (int) $line->unit_id : null,
            $line?->unit_price !== null ? (float) $line->unit_price : null,
        );
    }

    /**
     * Re-express a stored price per the product's stocking UOM.
     *
     * A price is always filed against the unit its document used (a GRN line's receiving
     * unit, a price-list row's unit). Converting it is the exact mirror of what the stock
     * ledger does with the quantity — 250 per Kg is 0.25 per g — so that a price and a
     * quantity can always be multiplied together and mean something.
     *
     * Returns null when there is no rate: better no default than a confidently wrong one.
     */
    private function toBasePrice(int $productId, ?int $unitId, ?float $price): ?float
    {
        if ($price === null) {
            return null;
        }

        $baseUnitId = Product::where('id', $productId)->value('base_unit_type_id');

        // No stocking UOM, or a price with no unit recorded (pre-dates the UOM work):
        // there is nothing to convert from, so it is already in whatever base means here.
        if ($baseUnitId === null || $unitId === null || $unitId === (int) $baseUnitId) {
            return $price;
        }

        $factor = $this->units->tryFactor($unitId, (int) $baseUnitId);

        return $factor !== null ? $this->units->priceToBase($price, $factor) : null;
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
        $row = DB::table('inv_costing_items')
            ->join('inv_costings', 'inv_costings.id', '=', 'inv_costing_items.costing_id')
            ->where('inv_costing_items.grn_item_id', $grnItemId)
            ->where('inv_costings.status', CostingStatus::Confirmed->value)
            ->whereNull('inv_costings.deleted_at')
            ->orderByDesc('inv_costing_items.id')
            ->first([
                'inv_costing_items.selling_price',
                'inv_costing_items.unit_id',
                'inv_costing_items.product_id',
            ]);

        if ($row === null) {
            return null;
        }

        // Costed per the shipment's receiving unit — rebase it like any other price.
        return $this->toBasePrice(
            (int) $row->product_id,
            $row->unit_id !== null ? (int) $row->unit_id : null,
            $row->selling_price !== null ? (float) $row->selling_price : null,
        );
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
