<?php

declare(strict_types=1);

namespace Modules\Inventory\Services;

use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Modules\Inventory\DTOs\CostingData;
use Modules\Inventory\Enums\CostingStatus;
use Modules\Inventory\Enums\GrnStatus;
use Modules\Inventory\Models\Costing;
use Modules\Inventory\Models\CostingExpense;
use Modules\Inventory\Models\CostingGrn;
use Modules\Inventory\Models\CostingItem;
use Modules\Inventory\Models\CostingExpenseType;
use Modules\Inventory\Models\GoodsReceivedNote;
use Modules\Inventory\Models\GoodsReceivedNoteItem;

/**
 * GRN-based landed costing → per-product selling prices.
 *
 * The costing loads every item line of the selected GRNs (GRN unit_price =
 * PURCHASING price) and spreads the common charges evenly per unit:
 *
 *   portion            = Σ expense lines ÷ Σ quantity
 *   landed_unit_cost   = grn unit_price + portion
 *   selling_price      = landed + margin  → +SSCL% → +VAT%  (toggles cascade)
 *
 * The full per-unit build-up is stored on inv_costing_items so the user can
 * see exactly what happened to the price. Confirm keeps the one-GRN-per-
 * confirmed-costing lock and mirrors landed/selling onto the product price
 * list via ProductPricingService; sales orders price each roll from its own
 * shipment's confirmed costing (old stock at old price, new at new).
 */
class CostingService
{
    public function __construct(private readonly ProductPricingService $pricing)
    {
    }

    /** @param array<string, mixed> $filters */
    public function paginate(int $perPage = 50, array $filters = []): LengthAwarePaginator
    {
        $query = Costing::with(['supplier'])
            ->orderByDesc('id');

        if (!empty($filters['search'])) {
            $term = '%' . $filters['search'] . '%';
            $query->where(function ($q) use ($term): void {
                $q->where('document_no', 'like', $term)
                  ->orWhere('reference_no', 'like', $term)
                  ->orWhere('bill_of_lading', 'like', $term);
            });
        }

        if (!empty($filters['supplier_id'])) {
            $query->where('supplier_id', (int) $filters['supplier_id']);
        }

        if (!empty($filters['costing_type'])) {
            $query->where('costing_type', $filters['costing_type']);
        }

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['date_from'])) {
            $query->whereDate('transaction_date', '>=', $filters['date_from']);
        }

        if (!empty($filters['date_to'])) {
            $query->whereDate('transaction_date', '<=', $filters['date_to']);
        }

        return $query->paginate($perPage);
    }

    public function find(int $id): Costing
    {
        return Costing::with([
            'supplier',
            'costingGrns.grn.items',
            'expenses.expenseType',
            'items.product:id,name,product_code',
            'items.attribute:id,attribute_name',
            'items.unit:id,symbol,unit_position',
            'items.grn:id,grn_no',
        ])->findOrFail($id);
    }

    public function create(CostingData $data): Costing
    {
        return DB::transaction(function () use ($data): Costing {
            $grns      = $this->loadGrns($data->grnIds);
            $breakdown = $this->computeBreakdown($grns, $data);

            $costing = Costing::create(array_merge(
                [
                    'document_no'  => $this->generateDocumentNo(),
                    'reference_no' => $this->generateReferenceNo(),
                    'status'       => CostingStatus::Draft,
                    'created_by'   => auth()->id(),
                ],
                $this->headerAttributes($data, $breakdown['summary']),
            ));

            $this->syncGrns($costing, $grns);
            $this->syncExpenses($costing, $data->expenses);
            $this->syncItems($costing, $breakdown['items']);

            return $this->find($costing->id);
        });
    }

    public function update(Costing $costing, CostingData $data): Costing
    {
        if ($costing->status !== CostingStatus::Draft) {
            abort(422, 'Only draft costings can be edited.');
        }

        return DB::transaction(function () use ($costing, $data): Costing {
            $grns      = $this->loadGrns($data->grnIds);
            $breakdown = $this->computeBreakdown($grns, $data);

            $costing->update($this->headerAttributes($data, $breakdown['summary']));

            $this->syncGrns($costing, $grns);
            $this->syncExpenses($costing, $data->expenses);
            $this->syncItems($costing, $breakdown['items']);

            return $this->find($costing->id);
        });
    }

    public function confirm(Costing $costing): Costing
    {
        return DB::transaction(function () use ($costing): Costing {
            // Re-fetch with a row lock so two concurrent confirm requests can't both pass
            $locked = Costing::lockForUpdate()->findOrFail($costing->id);

            if ($locked->status !== CostingStatus::Draft) {
                abort(422, 'Only draft costings can be confirmed.');
            }

            // Collect the GRN IDs attached to this costing
            $grnIds = CostingGrn::where('costing_id', $locked->id)->pluck('grn_id');

            if ($grnIds->isNotEmpty()) {
                // Find any of those GRNs that are already locked in a different confirmed costing
                $conflicting = CostingGrn::whereIn('grn_id', $grnIds)
                    ->where('costing_id', '!=', $locked->id)
                    ->whereIn(
                        'costing_id',
                        Costing::where('status', CostingStatus::Confirmed)->select('id'),
                    )
                    ->with('grn:id,grn_no')
                    ->get();

                if ($conflicting->isNotEmpty()) {
                    $grnNos = $conflicting->map(fn (CostingGrn $cg) => $cg->grn?->grn_no ?? "GRN#{$cg->grn_id}")
                        ->unique()
                        ->join(', ');

                    abort(422, "Cannot confirm: the following GRNs are already costed in another confirmed costing — {$grnNos}.");
                }
            }

            $locked->update([
                'status'       => CostingStatus::Confirmed,
                'confirmed_at' => now(),
            ]);

            // Price-list write-back: newest costed shipment wins. Iterate in id
            // order so, when one product appears on several lines, the last
            // line's price lands on the price list; individual rolls still
            // price from their own line via resolvePieceSellingPrice().
            CostingItem::where('costing_id', $locked->id)
                ->orderBy('id')
                ->get()
                ->each(fn (CostingItem $item) => $this->pricing->syncFromCosting(
                    (int) $item->product_id,
                    $item->unit_id !== null ? (int) $item->unit_id : null,
                    (float) $item->landed_unit_cost,
                    (float) $item->selling_price,
                ));

            return $this->find($locked->id);
        });
    }

    public function delete(Costing $costing): void
    {
        if ($costing->status !== CostingStatus::Draft) {
            abort(422, 'Only draft costings can be deleted.');
        }

        $costing->delete();
    }

    /** Preview next document number (lock-free, display only) */
    public function nextDocumentNo(): string
    {
        $year   = now()->year;
        $prefix = "CST-{$year}-";

        $last = Costing::withTrashed()
            ->where('document_no', 'like', $prefix . '%')
            ->orderByDesc('id')
            ->value('document_no');

        $next = $last ? (int) substr($last, strlen($prefix)) + 1 : 1;

        return $prefix . str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }

    /** Preview next reference number (lock-free, display only) */
    public function nextReferenceNo(): string
    {
        $prefix = 'CRef-';

        $last = Costing::withTrashed()
            ->where('reference_no', 'like', $prefix . '%')
            ->orderByDesc('id')
            ->value('reference_no');

        $next = $last ? (int) substr($last, strlen($prefix)) + 1 : 1;

        return $prefix . str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }

    /**
     * Returns confirmed GRNs for a supplier that are not yet attached to a confirmed costing.
     *
     * @return array<int, mixed>
     */
    public function getGrnsBySupplier(int $supplierId): array
    {
        // IDs of GRNs already locked in confirmed costings
        $usedGrnIds = CostingGrn::whereIn(
            'costing_id',
            Costing::where('status', CostingStatus::Confirmed)->select('id'),
        )->pluck('grn_id')->all();

        $grns = GoodsReceivedNote::with([
            'items.product:id,name,product_code',
            'items.attribute:id,attribute_name',
            'items.unit:id,symbol,unit_position',
            'purchaseOrder',
        ])
            ->where('supplier_id', $supplierId)
            ->where('status', GrnStatus::Confirmed)
            ->whereNotIn('id', $usedGrnIds)
            ->orderByDesc('grn_date')
            ->get();

        return $grns->map(fn (GoodsReceivedNote $grn) => [
            'id'           => $grn->id,
            'grn_no'       => $grn->grn_no,
            'grn_date'     => $grn->grn_date?->toDateString(),
            'po_no'        => $grn->purchaseOrder?->po_no,
            'total_amount' => (float) $grn->total_amount,
            'total_items'  => $grn->items->sum('quantity_received'),
            // Item lines feed the client-side product breakdown (live math)
            'items'        => $grn->items->map(fn ($item) => [
                'id'            => $item->id,
                'product_id'    => $item->product_id,
                'product_name'  => $item->product?->name,
                'product_code'  => $item->product?->product_code,
                'color'         => $item->attribute?->attribute_name,
                'quantity'      => (float) $item->quantity_received,
                'unit_price'    => (float) $item->unit_price,
                'unit_symbol'   => $item->unit?->symbol,
                'unit_position' => $item->unit?->unit_position,
            ])->values()->all(),
        ])->all();
    }

    /**
     * Expense types filtered by costing type.
     *
     * @return array<int, mixed>
     */
    public function getExpenseTypes(string $costingType): array
    {
        return CostingExpenseType::active()
            ->forType($costingType)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get()
            ->map(fn (CostingExpenseType $t) => [
                'id'           => $t->id,
                'name'         => $t->name,
                'costing_type' => $t->costing_type->value,
                'sort_order'   => $t->sort_order,
            ])->all();
    }

    /**
     * Stateless breakdown preview for the form's live math — same compute
     * path as create/update, nothing persisted.
     *
     * @param array<string, mixed> $input
     * @return array{items: array<int, array<string, mixed>>, summary: array<string, float>}
     */
    public function preview(array $input): array
    {
        $grns = $this->loadGrns(array_map('intval', (array) ($input['grn_ids'] ?? [])));

        return $this->computeBreakdown($grns, null, [
            'expenses'             => (array) ($input['expenses'] ?? []),
            'common_charge_amount' => isset($input['common_charge_amount']) && $input['common_charge_amount'] !== ''
                ? (float) $input['common_charge_amount'] : null,
            'default_margin_pct' => (float) ($input['default_margin_pct'] ?? 0),
            'apply_sscl'         => (bool) ($input['apply_sscl'] ?? false),
            'sscl_pct'           => (float) ($input['sscl_pct'] ?? 2.5),
            'apply_vat'          => (bool) ($input['apply_vat'] ?? false),
            'vat_pct'            => (float) ($input['vat_pct'] ?? 18),
            'items'              => (array) ($input['items'] ?? []),
        ]);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Single source of truth for the costing formula. Builds the per-product
     * breakdown from the selected GRNs' item lines plus the header totals.
     *
     * @param array<string, mixed>|null $raw preview-mode inputs when no DTO
     * @return array{items: array<int, array<string, mixed>>, summary: array<string, float>}
     */
    private function computeBreakdown(Collection $grns, ?CostingData $data, ?array $raw = null): array
    {
        $expenses         = $data?->expenses         ?? $raw['expenses'];
        $commonCharge     = $data !== null ? $data->commonChargeAmount : $raw['common_charge_amount'];
        $defaultMarginPct = $data?->defaultMarginPct ?? $raw['default_margin_pct'];
        $applySscl        = $data?->applySscl        ?? $raw['apply_sscl'];
        $ssclPct          = $data?->ssclPct          ?? $raw['sscl_pct'];
        $applyVat         = $data?->applyVat         ?? $raw['apply_vat'];
        $vatPct           = $data?->vatPct           ?? $raw['vat_pct'];
        $overrides        = collect($data?->items ?? $raw['items'])->keyBy('grn_item_id');

        /** @var Collection<int, GoodsReceivedNoteItem> $grnItems */
        $grnItems = $grns->flatMap(fn (GoodsReceivedNote $grn) => $grn->items);

        $totalQty      = (float) $grnItems->sum('quantity_received');
        // One typed total FOB/CIF charge wins; itemised expense rows are the
        // legacy fallback so older drafts keep computing.
        $totalExpenses = $commonCharge !== null
            ? (float) $commonCharge
            : (float) collect($expenses)->sum('amount');

        if ($totalExpenses > 0 && $totalQty <= 0) {
            abort(422, 'Cannot apportion charges: the selected GRNs have no received quantity.');
        }

        // The user's apportionment rule: every unit of every product carries
        // an equal share of the common charges.
        $portion = $totalQty > 0 ? $totalExpenses / $totalQty : 0.0;

        // Tax multiplier for back-computing a typed (final) selling price
        $multiplier = ($applySscl ? 1 + $ssclPct / 100 : 1) * ($applyVat ? 1 + $vatPct / 100 : 1);

        $items = $grnItems->map(function (GoodsReceivedNoteItem $item) use (
            $portion, $defaultMarginPct, $applySscl, $ssclPct, $applyVat, $vatPct, $multiplier, $overrides,
        ): array {
            $unitPrice = (float) $item->unit_price;
            $landed    = $unitPrice + $portion;

            $override     = $overrides->get($item->id, []);
            $linePct      = isset($override['margin_pct']) && $override['margin_pct'] !== null && $override['margin_pct'] !== ''
                ? (float) $override['margin_pct'] : null;
            $typedSelling = isset($override['selling_price']) && $override['selling_price'] !== null && $override['selling_price'] !== ''
                ? (float) $override['selling_price'] : null;

            if ($typedSelling !== null) {
                // User typed the FINAL selling price — back-compute the pieces
                $selling      = $typedSelling;
                $base         = $multiplier > 0 ? $selling / $multiplier : $selling;
                $marginAmount = $base - $landed;
                $ssclAmount   = $applySscl ? $base * ($ssclPct / 100) : 0.0;
                $vatAmount    = $applyVat ? ($base + $ssclAmount) * ($vatPct / 100) : 0.0;
                $overridden   = true;
            } else {
                $pct          = $linePct ?? $defaultMarginPct;
                $marginAmount = $landed * ($pct / 100);
                $base         = $landed + $marginAmount;
                $ssclAmount   = $applySscl ? $base * ($ssclPct / 100) : 0.0;
                $afterSscl    = $base + $ssclAmount;
                $vatAmount    = $applyVat ? $afterSscl * ($vatPct / 100) : 0.0;
                $selling      = $afterSscl + $vatAmount;
                $overridden   = false;
            }

            return [
                // Persisted columns (per unit)
                'grn_id'              => (int) $item->grn_id,
                'grn_item_id'         => (int) $item->id,
                'product_id'          => (int) $item->product_id,
                'attribute_id'        => $item->attribute_id !== null ? (int) $item->attribute_id : null,
                'unit_id'             => $item->unit_id !== null ? (int) $item->unit_id : null,
                'quantity'            => (float) $item->quantity_received,
                'unit_price'          => round($unitPrice, 4),
                'charge_portion'      => round($portion, 4),
                'landed_unit_cost'    => round($landed, 4),
                'margin_pct'          => $linePct,
                'margin_amount'       => round($marginAmount, 4),
                'sscl_amount'         => round($ssclAmount, 4),
                'vat_amount'          => round($vatAmount, 4),
                'selling_price'       => round($selling, 4),
                'is_price_overridden' => $overridden,
                // Display-only extras (preview payload; stripped before insert)
                'product_name'        => $item->product?->name,
                'product_code'        => $item->product?->product_code,
                'color'               => $item->attribute?->attribute_name,
                'grn_no'              => $item->grn?->grn_no,
                'unit_symbol'         => $item->unit?->symbol,
                'unit_position'       => $item->unit?->unit_position,
            ];
        })->values();

        $sum = fn (string $key): float => (float) $items->sum(fn (array $i) => $i['quantity'] * $i[$key]);

        $summary = [
            'total_items'               => $totalQty,
            // Legacy columns, now derived: material cost = Σ GRN line values
            'material_cost'             => $sum('unit_price'),
            'raw_material_cost'         => $sum('unit_price'),
            'total_additional_expenses' => $totalExpenses,
            'total_landed_cost'         => $sum('landed_unit_cost'),
            'value_addition_pct'        => 0.0,
            'value_addition_amount'     => 0.0,
            // Pre-tax selling value (landed + margin)
            'fob_cif_cost'              => $sum('landed_unit_cost') + $sum('margin_amount'),
            'sscl_amount'               => $sum('sscl_amount'),
            'gross_fob_cif_value'       => $sum('landed_unit_cost') + $sum('margin_amount') + $sum('sscl_amount'),
            'vat_amount'                => $sum('vat_amount'),
            'total_price_with_vat'      => $sum('selling_price'),
        ];

        return ['items' => $items->all(), 'summary' => $summary];
    }

    /**
     * Header column values shared by create/update.
     *
     * @param array<string, float> $summary
     * @return array<string, mixed>
     */
    private function headerAttributes(CostingData $data, array $summary): array
    {
        return array_merge($summary, [
            'supplier_id'        => $data->supplierId,
            'costing_type'       => $data->costingType,
            'bill_of_lading'     => $data->billOfLading,
            'expected_date'      => $data->expectedDate,
            'transaction_date'   => $data->transactionDate,
            'note'               => $data->note,
            'default_margin_pct' => $data->defaultMarginPct,
            'apply_sscl'         => $data->applySscl,
            'sscl_pct'           => $data->ssclPct,
            'apply_vat'          => $data->applyVat,
            'vat_pct'            => $data->vatPct,
        ]);
    }

    /** Atomically generate the next document number (must be called inside a DB transaction) */
    private function generateDocumentNo(): string
    {
        $year   = now()->year;
        $prefix = "CST-{$year}-";

        $last = Costing::withTrashed()
            ->where('document_no', 'like', $prefix . '%')
            ->orderByDesc('id')
            ->lockForUpdate()
            ->value('document_no');

        $next = $last ? (int) substr($last, strlen($prefix)) + 1 : 1;

        return $prefix . str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }

    /** Atomically generate the next reference number (must be called inside a DB transaction) */
    private function generateReferenceNo(): string
    {
        $prefix = 'CRef-';

        $last = Costing::withTrashed()
            ->where('reference_no', 'like', $prefix . '%')
            ->orderByDesc('id')
            ->lockForUpdate()
            ->value('reference_no');

        $next = $last ? (int) substr($last, strlen($prefix)) + 1 : 1;

        return $prefix . str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }

    /** @param array<int> $grnIds */
    private function loadGrns(array $grnIds): Collection
    {
        return GoodsReceivedNote::with([
            'items.product:id,name,product_code',
            'items.attribute:id,attribute_name',
            'items.unit:id,symbol,unit_position',
        ])
            ->whereIn('id', $grnIds)
            ->get();
    }

    private function syncGrns(Costing $costing, Collection $grns): void
    {
        CostingGrn::where('costing_id', $costing->id)->delete();

        $rows = $grns->map(fn (GoodsReceivedNote $grn) => [
            'costing_id' => $costing->id,
            'grn_id'     => $grn->id,
            'grn_total'  => (float) $grn->total_amount,
            'created_at' => now(),
            'updated_at' => now(),
        ])->all();

        if (!empty($rows)) {
            CostingGrn::insert($rows);
        }
    }

    /**
     * @param array<array{expense_type_id:int, amount:float, note:?string}> $expenses
     */
    private function syncExpenses(Costing $costing, array $expenses): void
    {
        CostingExpense::where('costing_id', $costing->id)->delete();

        $rows = collect($expenses)
            ->filter(fn (array $e) => !empty($e['expense_type_id']))
            ->map(fn (array $e) => [
                'costing_id'      => $costing->id,
                'expense_type_id' => (int) $e['expense_type_id'],
                'amount'          => (float) ($e['amount'] ?? 0),
                'note'            => $e['note'] ?? null,
                'created_at'      => now(),
                'updated_at'      => now(),
            ])->values()->all();

        if (!empty($rows)) {
            CostingExpense::insert($rows);
        }
    }

    /**
     * Delete-and-reinsert the per-product breakdown rows (draft edits rebuild).
     *
     * @param array<int, array<string, mixed>> $items computeBreakdown() output
     */
    private function syncItems(Costing $costing, array $items): void
    {
        CostingItem::where('costing_id', $costing->id)->delete();

        $columns = [
            'grn_id', 'grn_item_id', 'product_id', 'attribute_id', 'unit_id',
            'quantity', 'unit_price', 'charge_portion', 'landed_unit_cost',
            'margin_pct', 'margin_amount', 'sscl_amount', 'vat_amount',
            'selling_price', 'is_price_overridden',
        ];

        $rows = collect($items)->map(fn (array $item) => array_merge(
            array_intersect_key($item, array_flip($columns)),
            ['costing_id' => $costing->id, 'created_at' => now(), 'updated_at' => now()],
        ))->all();

        if (!empty($rows)) {
            CostingItem::insert($rows);
        }
    }
}
