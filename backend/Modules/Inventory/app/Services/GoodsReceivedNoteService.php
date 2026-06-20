<?php

declare(strict_types=1);

namespace Modules\Inventory\Services;

use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Modules\Inventory\DTOs\GoodsReceivedNoteData;
use Modules\Inventory\Enums\GrnStatus;
use Modules\Inventory\Enums\PurchaseOrderStatus;
use Modules\Inventory\Models\GoodsReceivedNote;
use Modules\Inventory\Models\GoodsReceivedNoteItem;
use Modules\Inventory\Models\ProductLocationStore;
use Modules\Inventory\Models\PurchaseOrder;
use Modules\Inventory\Models\PurchaseOrderItem;
use Modules\Inventory\Models\StockTransaction;

class GoodsReceivedNoteService
{
    /** @param array<string, mixed> $filters */
    public function paginate(int $perPage = 25, array $filters = []): LengthAwarePaginator
    {
        $query = GoodsReceivedNote::with(['purchaseOrder', 'supplier', 'store'])
            ->orderByDesc('grn_date')
            ->orderByDesc('id');

        if (!empty($filters['search'])) {
            $term = '%' . $filters['search'] . '%';
            $query->where(function ($q) use ($term): void {
                $q->where('grn_no', 'like', $term)
                  ->orWhereHas('purchaseOrder', fn ($po) => $po->where('po_no', 'like', $term));
            });
        }

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['store_id'])) {
            $query->where('store_id', (int) $filters['store_id']);
        }

        if (!empty($filters['supplier_id'])) {
            $query->where('supplier_id', (int) $filters['supplier_id']);
        }

        if (!empty($filters['date_from'])) {
            $query->whereDate('grn_date', '>=', $filters['date_from']);
        }

        if (!empty($filters['date_to'])) {
            $query->whereDate('grn_date', '<=', $filters['date_to']);
        }

        return $query->paginate($perPage);
    }

    public function find(int $id): GoodsReceivedNote
    {
        return GoodsReceivedNote::with([
            'items.product',
            'items.unit',
            'items.poItem',
            'purchaseOrder.items.product',
            'supplier',
            'store',
            'location',
        ])->findOrFail($id);
    }

    /**
     * Return outstanding items for a single PO.
     * @return array<array<string, mixed>>
     */
    public function getPoOutstandingItems(int $poId): array
    {
        $po = PurchaseOrder::with(['items.product', 'items.unit', 'supplier'])->findOrFail($poId);

        if (!$po->status->canReceiveGoods()) {
            abort(422, 'Purchase order must be confirmed before creating a GRN.');
        }

        return $po->items
            ->filter(fn (PurchaseOrderItem $item) => $item->remaining_qty > 0)
            ->map(fn (PurchaseOrderItem $item) => [
                'po_id'            => $po->id,
                'po_no'            => $po->po_no,
                'po_item_id'       => $item->id,
                'product_id'       => $item->product_id,
                'unit_id'          => $item->unit_id,
                'quantity_ordered'  => (float) $item->quantity_ordered,
                'quantity_received' => (float) $item->quantity_received,
                'remaining_qty'    => $item->remaining_qty,
                'unit_price'       => (float) $item->unit_price,
                'discount'         => (float) $item->discount,
                'tax'              => (float) $item->tax,
                'product'          => [
                    'id'           => $item->product->id,
                    'name'         => $item->product->name,
                    'product_code' => $item->product->product_code,
                    'is_batch'     => $item->product->is_batch,
                    'is_serial'    => $item->product->is_serial,
                ],
            ])
            ->values()
            ->all();
    }

    /**
     * Return outstanding items for multiple POs in one call.
     * @param array<int> $poIds
     * @return array<array<string, mixed>>
     */
    public function getPoOutstandingItemsForMultiple(array $poIds): array
    {
        if (empty($poIds)) {
            return [];
        }

        $pos = PurchaseOrder::with(['items.product', 'items.unit'])
            ->whereIn('id', $poIds)
            ->get();

        $results = [];

        foreach ($pos as $po) {
            if (!$po->status->canReceiveGoods()) {
                continue;
            }

            foreach ($po->items->filter(fn (PurchaseOrderItem $i) => $i->remaining_qty > 0) as $item) {
                $results[] = [
                    'po_id'            => $po->id,
                    'po_no'            => $po->po_no,
                    'po_item_id'       => $item->id,
                    'product_id'       => $item->product_id,
                    'unit_id'          => $item->unit_id,
                    'quantity_ordered'  => (float) $item->quantity_ordered,
                    'quantity_received' => (float) $item->quantity_received,
                    'remaining_qty'    => $item->remaining_qty,
                    'unit_price'       => (float) $item->unit_price,
                    'discount'         => (float) $item->discount,
                    'tax'              => (float) $item->tax,
                    'product'          => [
                        'id'           => $item->product->id,
                        'name'         => $item->product->name,
                        'product_code' => $item->product->product_code,
                        'is_batch'     => $item->product->is_batch,
                        'is_serial'    => $item->product->is_serial,
                    ],
                ];
            }
        }

        return $results;
    }

    public function nextGrnNo(): string
    {
        return $this->generateGrnNo();
    }

    /** @return array{grn_date: ?string, total_amount: float}|null */
    public function lastGrn(): ?array
    {
        $last = GoodsReceivedNote::with([
                'items' => fn ($q) => $q->select('grn_id', 'quantity_received', 'unit_price'),
            ])
            ->where('status', GrnStatus::Confirmed->value)
            ->orderByDesc('grn_date')
            ->orderByDesc('id')
            ->first(['id', 'grn_date']);

        if (!$last) {
            return null;
        }

        $total = $last->items->sum(
            fn (GoodsReceivedNoteItem $item) => (float) $item->quantity_received * (float) $item->unit_price
        );

        return [
            'grn_date'     => $last->grn_date?->toDateString(),
            'total_amount' => $total,
        ];
    }

    public function create(GoodsReceivedNoteData $data): GoodsReceivedNote
    {
        return DB::transaction(function () use ($data): GoodsReceivedNote {
            // Derive supplier from explicit field or from PO
            $supplierId = $data->supplierId;
            if (!$supplierId && $data->poId) {
                $po         = PurchaseOrder::findOrFail($data->poId);
                $supplierId = $po->supplier_id;
            }

            $grn = GoodsReceivedNote::create([
                'grn_no'           => $this->generateGrnNo(),
                'reference_no'     => $data->referenceNo,
                'po_id'            => $data->poId,
                'supplier_id'      => $supplierId,
                'grn_date'         => $data->grnDate,
                'transaction_date' => $data->transactionDate,
                'store_id'         => $data->storeId,
                'location_id'      => $data->locationId,
                'status'           => GrnStatus::Draft,
                'remarks'          => $data->remarks,
                'payment_terms'    => $data->paymentTerms,
                'attachments'      => $data->attachments,
                'total_amount'     => 0,
                'received_by'      => auth()->id(),
            ]);

            $this->syncItems($grn, $data->items);
            $this->recalculateTotal($grn);

            return $grn->load(['items.product', 'items.unit', 'purchaseOrder', 'supplier', 'store', 'location']);
        });
    }

    public function update(GoodsReceivedNote $grn, GoodsReceivedNoteData $data): GoodsReceivedNote
    {
        if ($grn->status !== GrnStatus::Draft) {
            abort(422, 'Only draft GRNs can be edited.');
        }

        return DB::transaction(function () use ($grn, $data): GoodsReceivedNote {
            $grn->update([
                'grn_date'         => $data->grnDate,
                'transaction_date' => $data->transactionDate,
                'reference_no'     => $data->referenceNo,
                'supplier_id'      => $data->supplierId ?? $grn->supplier_id,
                'store_id'         => $data->storeId,
                'location_id'      => $data->locationId,
                'remarks'          => $data->remarks,
                'payment_terms'    => $data->paymentTerms,
                'attachments'      => $data->attachments,
            ]);

            $this->syncItems($grn, $data->items);
            $this->recalculateTotal($grn);

            return $grn->load(['items.product', 'items.unit', 'purchaseOrder', 'supplier', 'store', 'location']);
        });
    }

    /**
     * Confirm GRN: post stock into inv_product_location_stores and inv_stock_transactions.
     * Stock posting is skipped when no store is assigned (items still update PO quantities).
     */
    public function confirm(GoodsReceivedNote $grn): GoodsReceivedNote
    {
        if ($grn->status !== GrnStatus::Draft) {
            abort(422, 'Only draft GRNs can be confirmed.');
        }

        return DB::transaction(function () use ($grn): GoodsReceivedNote {
            $grn->load('items.product');

            // Collect affected PO IDs from items (supports multi-PO GRNs)
            $poItemIds     = $grn->items->pluck('po_item_id')->filter()->unique()->values();
            $affectedPoIds = PurchaseOrderItem::whereIn('id', $poItemIds)
                ->pluck('po_id')
                ->unique()
                ->values();

            foreach ($grn->items as $item) {
                // 1. Post stock transaction ledger entry (always, even without store)
                StockTransaction::create([
                    'transaction_date' => now(),
                    'reference_type'   => 'grn',
                    'reference_id'     => $grn->id,
                    'product_id'       => $item->product_id,
                    'store_id'         => $grn->store_id,
                    'location_id'      => $grn->location_id,
                    'batch_no'         => $item->batch_no,
                    'expiry_date'      => $item->expiry_date,
                    'qty_in'           => $item->quantity_received,
                    'qty_out'          => 0,
                    'unit_id'          => $item->unit_id,
                    'unit_price'       => $item->unit_price,
                    'created_by'       => auth()->id(),
                ]);

                // 2. Update denormalized stock balance only if store is assigned
                if ($grn->store_id) {
                    $pivot = ProductLocationStore::firstOrCreate(
                        [
                            'product_id'  => $item->product_id,
                            'store_id'    => $grn->store_id,
                            'location_id' => $grn->location_id,
                        ],
                        ['current_stock' => 0]
                    );

                    $pivot->increment('current_stock', (float) $item->quantity_received);
                }

                // 3. Update quantity_received on the linked PO item
                PurchaseOrderItem::where('id', $item->po_item_id)
                    ->increment('quantity_received', (float) $item->quantity_received);
            }

            // 4. Mark GRN as confirmed
            $grn->update([
                'status'       => GrnStatus::Confirmed,
                'confirmed_at' => now(),
            ]);

            // 5. Recompute status for all affected POs
            foreach ($affectedPoIds as $poId) {
                $this->syncPoStatusAfterGrn($poId);
            }

            return $grn->fresh(['items.product', 'items.unit', 'purchaseOrder', 'supplier', 'store', 'location']);
        });
    }

    public function delete(GoodsReceivedNote $grn): void
    {
        if ($grn->status !== GrnStatus::Draft) {
            abort(422, 'Only draft GRNs can be deleted.');
        }

        $grn->delete();
    }

    private function syncPoStatusAfterGrn(int $poId): void
    {
        $po = PurchaseOrder::with('items')->find($poId);
        if (!$po) {
            return;
        }

        $hasOutstanding = $po->items->some(
            fn (PurchaseOrderItem $item) => $item->remaining_qty > 0
        );

        $newStatus = $hasOutstanding
            ? PurchaseOrderStatus::PartiallyReceived
            : PurchaseOrderStatus::Completed;

        $po->update(['status' => $newStatus]);
    }

    private function generateGrnNo(): string
    {
        $year   = now()->year;
        $prefix = "GRN-{$year}-";

        $last = GoodsReceivedNote::withTrashed()
            ->where('grn_no', 'like', $prefix . '%')
            ->orderByDesc('id')
            ->lockForUpdate()
            ->value('grn_no');

        $next = $last
            ? (int) substr($last, strlen($prefix)) + 1
            : 1;

        return $prefix . str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }

    /**
     * @param array<array{po_item_id:int, product_id:int, unit_id:?int, quantity_received:float, unit_price:float, discount:?float, tax:?float, batch_no:?string, expiry_date:?string}> $items
     */
    private function syncItems(GoodsReceivedNote $grn, array $items): void
    {
        $grn->items()->delete();

        $poItem = PurchaseOrderItem::whereIn(
            'id',
            collect($items)->pluck('po_item_id')->filter()->unique()->values()
        )->get()->keyBy('id');

        $rows = collect($items)
            ->filter(fn (array $row) => !empty($row['po_item_id']) && ($row['quantity_received'] ?? 0) > 0)
            ->map(function (array $row) use ($grn, $poItem): array {
                $ordered    = (float) ($poItem[$row['po_item_id']]?->quantity_ordered ?? 0);
                $qtyRcv     = (float) $row['quantity_received'];
                $unitPrice  = (float) ($row['unit_price'] ?? 0);
                $discountPct = (float) ($row['discount'] ?? 0);
                $taxPct      = (float) ($row['tax'] ?? 0);

                $gross      = $qtyRcv * $unitPrice;
                $discAmt    = $gross * ($discountPct / 100);
                $taxAmt     = $gross * ($taxPct / 100);
                $lineTotal  = $gross - $discAmt + $taxAmt;

                return [
                    'grn_id'            => $grn->id,
                    'po_item_id'        => (int) $row['po_item_id'],
                    'product_id'        => (int) $row['product_id'],
                    'unit_id'           => !empty($row['unit_id']) ? (int) $row['unit_id'] : null,
                    'quantity_ordered'  => $ordered,
                    'quantity_received' => $qtyRcv,
                    'unit_price'        => $unitPrice,
                    'discount'          => $discountPct,
                    'tax'               => $taxPct,
                    'line_total'        => $lineTotal,
                    'batch_no'          => $row['batch_no'] ?? null,
                    'expiry_date'       => !empty($row['expiry_date']) ? $row['expiry_date'] : null,
                    'created_at'        => now(),
                    'updated_at'        => now(),
                ];
            })
            ->values()
            ->all();

        if (!empty($rows)) {
            GoodsReceivedNoteItem::insert($rows);
        }
    }

    private function recalculateTotal(GoodsReceivedNote $grn): void
    {
        $grn->refresh();
        $total = $grn->items()->sum('line_total');
        $grn->update(['total_amount' => $total]);
    }
}
