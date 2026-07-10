<?php

declare(strict_types=1);

namespace Modules\Inventory\Services;

use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Modules\Inventory\DTOs\SalesOrderData;
use Modules\Inventory\Enums\SalesOrderStatus;
use Modules\Inventory\Models\GrnItemPiece;
use Modules\Inventory\Models\Product;
use Modules\Inventory\Models\SalesOrder;
use Modules\Inventory\Models\SalesOrderItem;
use Modules\Inventory\Models\SalesOrderPiece;

/**
 * Sales orders are commitment documents only — no stock transactions are
 * posted here. QR-scanned pieces are reserved (status 'allocated') via
 * inv_sales_order_pieces; the future Delivery feature will post qty_out
 * rows to inv_stock_transactions (new 'sales_delivery' reference type)
 * and move pieces out of stock.
 */
class SalesOrderService
{
    public function __construct(private readonly ProductPricingService $pricing)
    {
    }

    /** @param array<string, mixed> $filters */
    public function paginate(int $perPage = 50, array $filters = []): LengthAwarePaginator
    {
        $query = SalesOrder::with(['customer', 'salesPerson'])
            ->withSum('items as total_quantity', 'quantity')
            ->orderByDesc('order_date')
            ->orderByDesc('id');

        if (!empty($filters['search'])) {
            $term = '%' . $filters['search'] . '%';
            $query->where(function ($q) use ($term): void {
                $q->where('so_no', 'like', $term)
                  ->orWhere('reference_no', 'like', $term)
                  ->orWhereHas('customer', fn ($c) => $c->where('customer_name', 'like', $term));
            });
        }

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['customer_id'])) {
            $query->where('customer_id', (int) $filters['customer_id']);
        }

        if (!empty($filters['sales_person_id'])) {
            $query->where('sales_person_id', (int) $filters['sales_person_id']);
        }

        if (!empty($filters['date_from'])) {
            $query->whereDate('order_date', '>=', $filters['date_from']);
        }

        if (!empty($filters['date_to'])) {
            $query->whereDate('order_date', '<=', $filters['date_to']);
        }

        return $query->paginate($perPage);
    }

    public function find(int $id): SalesOrder
    {
        return SalesOrder::with([
            'items.product',
            'items.unit',
            'items.attribute',
            'items.pieces.piece',
            'customer',
            'salesPerson',
            'orderTakenBy',
            'deliveryOrders',
            'invoices',
        ])->findOrFail($id);
    }

    /** Lock-free preview for the form; the real number is generated inside the create transaction. */
    public function nextSoNo(): string
    {
        return $this->buildSoNo(lock: false);
    }

    public function create(SalesOrderData $data): SalesOrder
    {
        return DB::transaction(function () use ($data): SalesOrder {
            $so = SalesOrder::create([
                'so_no'            => $this->buildSoNo(lock: true),
                'reference_no'     => $data->referenceNo,
                'customer_id'      => $data->customerId,
                'sales_person_id'  => $data->salesPersonId,
                'order_taken_by'   => $data->orderTakenBy,
                'customer_type'    => $data->customerType,
                'order_date'       => $data->orderDate,
                'expected_date'    => $data->expectedDate,
                'transaction_date' => $data->transactionDate,
                'order_source'     => $data->orderSource,
                'delivery_address' => $data->deliveryAddress,
                'transport_charge' => $data->transportCharge,
                'status'           => $data->status
                                          ? SalesOrderStatus::from($data->status)
                                          : SalesOrderStatus::Draft,
                'remarks'          => $data->remarks,
                'created_by'       => Auth::id(),
                'subtotal'         => 0,
                'grand_total'      => 0,
            ]);

            $this->syncItems($so, $data->items);
            $this->recalculateTotals($so);

            return $this->find($so->id);
        });
    }

    public function update(SalesOrder $so, SalesOrderData $data): SalesOrder
    {
        return DB::transaction(function () use ($so, $data): SalesOrder {
            // Apply status transition first if a new status is provided and differs from current
            if ($data->status !== null) {
                $newStatus = SalesOrderStatus::from($data->status);
                if ($newStatus !== $so->status) {
                    $this->updateStatus($so, $data->status);
                    $so->refresh();
                }
            }

            // Update form fields only while the SO is still in an editable state
            if ($so->status->isEditable()) {
                $so->update([
                    'reference_no'     => $data->referenceNo,
                    'customer_id'      => $data->customerId,
                    'sales_person_id'  => $data->salesPersonId,
                    'order_taken_by'   => $data->orderTakenBy,
                    'customer_type'    => $data->customerType,
                    'order_date'       => $data->orderDate,
                    'expected_date'    => $data->expectedDate,
                    'transaction_date' => $data->transactionDate,
                    'order_source'     => $data->orderSource,
                    'delivery_address' => $data->deliveryAddress,
                    'transport_charge' => $data->transportCharge,
                    'remarks'          => $data->remarks,
                ]);

                $this->syncItems($so, $data->items);
                $this->recalculateTotals($so);
            }

            return $this->find($so->id);
        });
    }

    public function updateStatus(SalesOrder $so, string $status): SalesOrder
    {
        $newStatus = SalesOrderStatus::from($status);

        $allowedTransitions = [
            SalesOrderStatus::Draft->value     => [SalesOrderStatus::Confirmed, SalesOrderStatus::Cancelled],
            SalesOrderStatus::Confirmed->value => [SalesOrderStatus::Completed, SalesOrderStatus::Cancelled],
        ];

        $allowed = $allowedTransitions[$so->status->value] ?? [];
        if (!in_array($newStatus, $allowed)) {
            abort(422, "Cannot transition sales order from {$so->status->label()} to {$newStatus->label()}.");
        }

        return DB::transaction(function () use ($so, $newStatus): SalesOrder {
            if ($newStatus === SalesOrderStatus::Cancelled) {
                $this->releaseAllPieces($so);
            }

            $so->update(['status' => $newStatus]);

            return $so;
        });
    }

    public function delete(SalesOrder $so): void
    {
        if ($so->status !== SalesOrderStatus::Draft) {
            abort(422, 'Only draft sales orders can be deleted.');
        }

        DB::transaction(function () use ($so): void {
            $this->releaseAllPieces($so);
            $so->delete();
        });
    }

    /**
     * Resolve a scanned piece QR for the sales order form (read-only).
     *
     * @return array<string, mixed>
     */
    public function scanPiece(string $pieceCode): array
    {
        $piece = GrnItemPiece::with(['product', 'grnItem.unit', 'grnItem.attribute'])
            ->where('piece_code', $pieceCode)
            ->firstOrFail();

        $product   = $piece->product;
        $available = $piece->status === GrnItemPiece::STATUS_IN_STOCK;
        $resolved  = $this->pricing->resolvePieceSellingPrice($piece);

        $reason = null;
        if (!$available) {
            $reason = $piece->status === GrnItemPiece::STATUS_ALLOCATED
                ? 'Piece is already allocated to another sales order.'
                : "Piece is not in stock (status: {$piece->status}).";
        } elseif ((float) ($piece->weight ?? 0) <= 0) {
            $available = false;
            $reason    = 'Piece has no recorded weight.';
        } elseif ($product?->not_allow_direct_sale) {
            $available = false;
            $reason    = 'Product is not allowed for direct sale.';
        }

        return [
            'piece' => [
                'id'           => $piece->id,
                'piece_code'   => $piece->piece_code,
                'roll_no'      => $piece->roll_no,
                'weight'       => (float) ($piece->weight ?? 0),
                'status'       => $piece->status,
                'attribute_id' => $piece->grnItem?->attribute_id,
                'color'        => $piece->grnItem?->attribute?->attribute_name,
            ],
            'product' => $product ? [
                'id'                    => $product->id,
                'name'                  => $product->name,
                'product_code'          => $product->product_code,
                'not_allow_direct_sale' => (bool) $product->not_allow_direct_sale,
                'unit'                  => $piece->grnItem?->unit ? [
                    'id'   => $piece->grnItem->unit->id,
                    'name' => $piece->grnItem->unit->name,
                ] : null,
            ] : null,
            // Cost of this roll's shipment — snapshot basis, NOT the sale price.
            'grn_unit_price'     => (float) ($piece->grnItem?->unit_price ?? 0),
            // Shipment-specific sale price: confirmed-costing price for this
            // roll's GRN line, price-list fallback (null = neither configured).
            'selling_price'      => $resolved['price'] ?? null,
            'price_source'       => $resolved['source'] ?? null,
            'available'          => $available,
            'unavailable_reason' => $reason,
        ];
    }

    /**
     * All in-stock, sealed, weighted rolls of a product — FIFO order — for the
     * roll picker on manual (non-scanned) sales order lines.
     *
     * @return array{pieces: array<int, array<string, mixed>>, count: int, total_weight: float}
     */
    public function availablePieces(int $productId): array
    {
        // Rolls of the same GRN line share a price — resolve once per grn_item.
        $priceCache = [];
        $resolve = function (GrnItemPiece $piece) use (&$priceCache): array {
            $key = (string) ($piece->grn_item_id ?? '0');
            return $priceCache[$key] ??= $this->pricing->resolvePieceSellingPrice($piece);
        };

        $pieces = GrnItemPiece::with(['grnItem.attribute', 'grn', 'store', 'location'])
            ->where('product_id', $productId)
            ->where('status', GrnItemPiece::STATUS_IN_STOCK)
            ->whereNotNull('piece_code')
            ->where('weight', '>', 0)
            ->orderBy('id')
            ->get()
            ->map(fn (GrnItemPiece $piece) => [
                'id'             => $piece->id,
                'piece_code'     => $piece->piece_code,
                'roll_no'        => $piece->roll_no,
                'weight'         => (float) $piece->weight,
                'grn_no'         => $piece->grn?->grn_no,
                'store'          => $piece->store?->store_name,
                'location'       => $piece->location?->location_name ?? $piece->location?->name,
                'grn_unit_price' => (float) ($piece->grnItem?->unit_price ?? 0),
                // Shipment-specific sale price (confirmed costing → price list)
                'selling_price'  => $resolve($piece)['price'],
                'price_source'   => $resolve($piece)['source'],
                'attribute_id'   => $piece->grnItem?->attribute_id,
                'color'          => $piece->grnItem?->attribute?->attribute_name,
            ])
            ->values();

        return [
            'pieces'        => $pieces->all(),
            'count'         => $pieces->count(),
            'total_weight'  => (float) $pieces->sum('weight'),
            // Price-list sale price (per product) — fallback shown when a roll
            // has no confirmed costing.
            'selling_price' => $this->pricing->sellingPriceFor($productId),
        ];
    }

    /**
     * Prices for a manual product pick — selling_price as the sale-price
     * default, cost_price (latest confirmed GRN) for the below-cost guard.
     *
     * @return array{selling_price: ?float, cost_price: ?float}
     */
    public function productPricing(int $productId): array
    {
        return $this->pricing->pricingFor($productId);
    }

    private function buildSoNo(bool $lock): string
    {
        $year   = now()->year;
        $prefix = "SO-{$year}-";

        $query = SalesOrder::withTrashed()
            ->where('so_no', 'like', $prefix . '%')
            ->orderByDesc('id');

        if ($lock) {
            $query->lockForUpdate();
        }

        $last = $query->value('so_no');
        $next = $last ? (int) substr($last, strlen($prefix)) + 1 : 1;

        return $prefix . str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }

    /**
     * Release-then-reallocate: frees every piece currently held by this SO
     * before rebuilding items, so edits that keep the same pieces re-allocate
     * them cleanly and removed lines release theirs.
     *
     * @param array<array{product_id:int, unit_id:?int, attribute_id:?int, quantity:?float, unit_price:float, discount:float, tax:float, remarks:?string, piece_codes:?array<string>}> $items
     */
    private function syncItems(SalesOrder $so, array $items): void
    {
        $this->releaseAllPieces($so);
        $so->items()->delete();

        $this->rejectManualLinesForRollTrackedProducts($items);

        foreach ($items as $row) {
            if (empty($row['product_id'])) {
                continue;
            }

            $pieceCodes = array_values(array_filter((array) ($row['piece_codes'] ?? [])));
            $isScanned  = $pieceCodes !== [];
            $qty        = (float) ($row['quantity'] ?? 0);

            if (!$isScanned && $qty <= 0) {
                continue;
            }

            $item = SalesOrderItem::create([
                'so_id'      => $so->id,
                'product_id' => (int) $row['product_id'],
                'unit_id'    => !empty($row['unit_id']) ? (int) $row['unit_id'] : null,
                'attribute_id' => !empty($row['attribute_id']) ? (int) $row['attribute_id'] : null,
                'is_scanned' => $isScanned,
                'quantity'   => $qty,
                'unit_price' => (float) ($row['unit_price'] ?? 0),
                'discount'   => (float) ($row['discount'] ?? 0),
                'tax'        => (float) ($row['tax'] ?? 0),
                'line_total' => 0,
                'remarks'    => $row['remarks'] ?? null,
            ]);

            if ($isScanned) {
                // Quantity for scanned lines is derived from piece weights server-side.
                $this->allocatePieces($so, $item, $pieceCodes);
            }

            $this->recalculateLineTotal($item);
        }
    }

    /**
     * A plain typed-quantity line is only allowed for products with no in-stock
     * rolls — otherwise the specific rolls must be attached (scan or picker) so
     * the warehouse knows exactly which rolls are sold.
     *
     * @param array<array<string, mixed>> $items
     */
    private function rejectManualLinesForRollTrackedProducts(array $items): void
    {
        $manualProductIds = collect($items)
            ->filter(fn (array $row) => !empty($row['product_id'])
                && array_filter((array) ($row['piece_codes'] ?? [])) === []
                && (float) ($row['quantity'] ?? 0) > 0)
            ->pluck('product_id')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        if ($manualProductIds->isEmpty()) {
            return;
        }

        $blockedProductId = GrnItemPiece::whereIn('product_id', $manualProductIds)
            ->where('status', GrnItemPiece::STATUS_IN_STOCK)
            ->value('product_id');

        if ($blockedProductId !== null) {
            $name = Product::where('id', $blockedProductId)->value('name') ?? "Product #{$blockedProductId}";
            abort(422, "{$name} has rolls in stock — select the rolls for this line instead of typing a quantity.");
        }
    }

    /** @param array<string> $codes */
    private function allocatePieces(SalesOrder $so, SalesOrderItem $item, array $codes): void
    {
        $codes  = array_values(array_unique($codes));
        $pieces = GrnItemPiece::with('grnItem')
            ->whereIn('piece_code', $codes)
            ->lockForUpdate()
            ->get();

        if ($pieces->count() !== count($codes)) {
            $missing = array_diff($codes, $pieces->pluck('piece_code')->all());
            abort(422, 'Piece not found: ' . implode(', ', $missing));
        }

        foreach ($pieces as $piece) {
            if ($piece->status !== GrnItemPiece::STATUS_IN_STOCK) {
                abort(422, "Piece {$piece->piece_code} is not available (status: {$piece->status}).");
            }
            if ((int) $piece->product_id !== (int) $item->product_id) {
                abort(422, "Piece {$piece->piece_code} does not belong to the selected product.");
            }
            if ((float) ($piece->weight ?? 0) <= 0) {
                abort(422, "Piece {$piece->piece_code} has no recorded weight.");
            }
        }

        // One colour per line — a client orders a product in a specific colour
        if ($pieces->map(fn (GrnItemPiece $piece) => $piece->grnItem?->attribute_id)->unique()->count() > 1) {
            abort(422, 'Rolls of different colours cannot be mixed on one line — split them into separate lines.');
        }

        SalesOrderPiece::insert($pieces->map(fn (GrnItemPiece $piece) => [
            'so_id'          => $so->id,
            'so_item_id'     => $item->id,
            'piece_id'       => $piece->id,
            'piece_code'     => $piece->piece_code,
            'weight'         => (float) $piece->weight,
            'grn_unit_price' => (float) ($piece->grnItem?->unit_price ?? 0),
            'created_by'     => Auth::id(),
            'created_at'     => now(),
            'updated_at'     => now(),
        ])->all());

        GrnItemPiece::whereIn('id', $pieces->pluck('id'))
            ->update(['status' => GrnItemPiece::STATUS_ALLOCATED]);

        // Quantity and colour are both derived from the allocated rolls
        $item->quantity     = $pieces->sum(fn (GrnItemPiece $piece) => (float) $piece->weight);
        $item->attribute_id = $pieces->first()->grnItem?->attribute_id;
    }

    private function releaseAllPieces(SalesOrder $so): void
    {
        $pieceIds = $so->pieces()->pluck('piece_id');

        if ($pieceIds->isEmpty()) {
            return;
        }

        GrnItemPiece::whereIn('id', $pieceIds)
            ->where('status', GrnItemPiece::STATUS_ALLOCATED)
            ->update(['status' => GrnItemPiece::STATUS_IN_STOCK]);

        $so->pieces()->delete();
    }

    private function recalculateLineTotal(SalesOrderItem $item): void
    {
        $gross = (float) $item->quantity * (float) $item->unit_price;

        $item->line_total = $gross
            - ($gross * (float) $item->discount / 100)
            + ($gross * (float) $item->tax / 100);

        $item->save();
    }

    private function recalculateTotals(SalesOrder $so): void
    {
        $so->refresh();
        $subtotal   = (float) $so->items()->sum(DB::raw('quantity * unit_price'));
        $lineTotals = (float) $so->items()->sum(DB::raw('line_total'));

        $so->update([
            'subtotal'    => $subtotal,
            'grand_total' => $lineTotals + (float) $so->transport_charge,
        ]);
    }
}
