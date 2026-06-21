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
use Modules\Inventory\Models\CostingExpenseType;
use Modules\Inventory\Models\GoodsReceivedNote;

class CostingService
{
    /** @param array<string, mixed> $filters */
    public function paginate(int $perPage = 25, array $filters = []): LengthAwarePaginator
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
        ])->findOrFail($id);
    }

    public function create(CostingData $data): Costing
    {
        return DB::transaction(function () use ($data): Costing {
            $grns    = $this->loadGrns($data->grnIds);
            $summary = $this->calculateSummaryFromData($data, $grns);

            $costing = Costing::create([
                'document_no'               => $this->generateDocumentNo(),
                'reference_no'              => $this->generateReferenceNo(),
                'supplier_id'               => $data->supplierId,
                'costing_type'              => $data->costingType,
                'total_items'               => $this->sumTotalItems($grns),
                'material_cost'             => $data->materialCost,
                'bill_of_lading'            => $data->billOfLading,
                'expected_date'             => $data->expectedDate,
                'transaction_date'          => $data->transactionDate,
                'note'                      => $data->note,
                'total_additional_expenses' => $summary['total_additional_expenses'],
                'raw_material_cost'         => $summary['raw_material_cost'],
                'total_landed_cost'         => $summary['total_landed_cost'],
                'value_addition_pct'        => $data->valueAdditionPct,
                'value_addition_amount'     => $summary['value_addition_amount'],
                'fob_cif_cost'              => $summary['fob_cif_cost'],
                'sscl_pct'                  => $data->ssclPct,
                'sscl_amount'               => $summary['sscl_amount'],
                'gross_fob_cif_value'       => $summary['gross_fob_cif_value'],
                'vat_pct'                   => $data->vatPct,
                'vat_amount'                => $summary['vat_amount'],
                'total_price_with_vat'      => $summary['total_price_with_vat'],
                'status'                    => CostingStatus::Draft,
                'created_by'                => auth()->id(),
            ]);

            $this->syncGrns($costing, $grns);
            $this->syncExpenses($costing, $data->expenses);

            return $costing->load(['supplier', 'costingGrns.grn.items', 'expenses.expenseType']);
        });
    }

    public function update(Costing $costing, CostingData $data): Costing
    {
        if ($costing->status !== CostingStatus::Draft) {
            abort(422, 'Only draft costings can be edited.');
        }

        return DB::transaction(function () use ($costing, $data): Costing {
            $grns    = $this->loadGrns($data->grnIds);
            $summary = $this->calculateSummaryFromData($data, $grns);

            $costing->update([
                'supplier_id'               => $data->supplierId,
                'costing_type'              => $data->costingType,
                'total_items'               => $this->sumTotalItems($grns),
                'material_cost'             => $data->materialCost,
                'bill_of_lading'            => $data->billOfLading,
                'expected_date'             => $data->expectedDate,
                'transaction_date'          => $data->transactionDate,
                'note'                      => $data->note,
                'total_additional_expenses' => $summary['total_additional_expenses'],
                'raw_material_cost'         => $summary['raw_material_cost'],
                'total_landed_cost'         => $summary['total_landed_cost'],
                'value_addition_pct'        => $data->valueAdditionPct,
                'value_addition_amount'     => $summary['value_addition_amount'],
                'fob_cif_cost'              => $summary['fob_cif_cost'],
                'sscl_pct'                  => $data->ssclPct,
                'sscl_amount'               => $summary['sscl_amount'],
                'gross_fob_cif_value'       => $summary['gross_fob_cif_value'],
                'vat_pct'                   => $data->vatPct,
                'vat_amount'                => $summary['vat_amount'],
                'total_price_with_vat'      => $summary['total_price_with_vat'],
            ]);

            $this->syncGrns($costing, $grns);
            $this->syncExpenses($costing, $data->expenses);

            return $costing->load(['supplier', 'costingGrns.grn.items', 'expenses.expenseType']);
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

            return $locked->load(['supplier', 'costingGrns.grn.items', 'expenses.expenseType']);
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

        $grns = GoodsReceivedNote::with(['items', 'purchaseOrder'])
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
     * Stateless summary calculation — used by the preview endpoint.
     *
     * @param array<string, mixed> $input
     * @return array<string, float>
     */
    public function calculateSummary(array $input): array
    {
        $rawMaterialCost      = (float) ($input['raw_material_cost'] ?? 0);
        $totalAdditionalExp   = (float) ($input['total_additional_expenses'] ?? 0);
        $valueAdditionPct     = (float) ($input['value_addition_pct'] ?? 10);
        $ssclPct              = (float) ($input['sscl_pct'] ?? 2.5);
        $vatPct               = (float) ($input['vat_pct'] ?? 18);

        return self::compute($rawMaterialCost, $totalAdditionalExp, $valueAdditionPct, $ssclPct, $vatPct);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

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
        return GoodsReceivedNote::with('items')
            ->whereIn('id', $grnIds)
            ->get();
    }

    private function sumTotalItems(Collection $grns): float
    {
        return (float) $grns->sum(fn (GoodsReceivedNote $grn) => $grn->items->sum('quantity_received'));
    }

    /**
     * @param array<array{expense_type_id:int, amount:float, note:?string}> $expenses
     * @return array<string, float>
     */
    private function calculateSummaryFromData(CostingData $data, Collection $grns): array
    {
        // material_cost is the user-editable raw material cost (auto-filled from GRN totals
        // but overridable). It drives raw_material_cost stored in the DB.
        $rawMaterialCost    = $data->materialCost;
        $totalAdditionalExp = (float) collect($data->expenses)->sum('amount');

        return self::compute(
            $rawMaterialCost,
            $totalAdditionalExp,
            $data->valueAdditionPct,
            $data->ssclPct,
            $data->vatPct,
        );
    }

    /**
     * Core calculation — single source of truth for the costing formula.
     *
     * @return array<string, float>
     */
    private static function compute(
        float $rawMaterialCost,
        float $totalAdditionalExp,
        float $valueAdditionPct,
        float $ssclPct,
        float $vatPct,
    ): array {
        $totalLandedCost     = $rawMaterialCost + $totalAdditionalExp;
        $valueAdditionAmount = $totalLandedCost * ($valueAdditionPct / 100);
        $fobCifCost          = $totalLandedCost + $valueAdditionAmount;
        $ssclAmount          = $fobCifCost * ($ssclPct / 100);
        $grossFobCifValue    = $fobCifCost + $ssclAmount;
        $vatAmount           = $grossFobCifValue * ($vatPct / 100);
        $totalPriceWithVat   = $grossFobCifValue + $vatAmount;

        return [
            'raw_material_cost'         => $rawMaterialCost,
            'total_additional_expenses' => $totalAdditionalExp,
            'total_landed_cost'         => $totalLandedCost,
            'value_addition_amount'     => $valueAdditionAmount,
            'fob_cif_cost'              => $fobCifCost,
            'sscl_amount'               => $ssclAmount,
            'gross_fob_cif_value'       => $grossFobCifValue,
            'vat_amount'                => $vatAmount,
            'total_price_with_vat'      => $totalPriceWithVat,
        ];
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
}
