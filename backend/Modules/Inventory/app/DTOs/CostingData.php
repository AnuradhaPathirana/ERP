<?php

declare(strict_types=1);

namespace Modules\Inventory\DTOs;

use Modules\Inventory\Http\Requests\StoreCostingRequest;
use Modules\Inventory\Http\Requests\UpdateCostingRequest;

final class CostingData
{
    /**
     * @param array<int>   $grnIds
     * @param array<array{expense_type_id:int, amount:float, note:?string}> $expenses
     */
    public function __construct(
        public readonly int     $supplierId,
        public readonly string  $costingType,
        public readonly array   $grnIds,
        public readonly float   $materialCost,
        public readonly ?string $billOfLading,
        public readonly ?string $expectedDate,
        public readonly ?string $transactionDate,
        public readonly ?string $note,
        public readonly float   $valueAdditionPct,
        public readonly float   $ssclPct,
        public readonly float   $vatPct,
        public readonly array   $expenses,
    ) {}

    public static function fromRequest(
        StoreCostingRequest|UpdateCostingRequest $request,
    ): self {
        return new self(
            supplierId:       (int) $request->validated('supplier_id'),
            costingType:      $request->validated('costing_type'),
            grnIds:           array_map('intval', (array) ($request->validated('grn_ids') ?? [])),
            materialCost:     (float) ($request->validated('material_cost') ?? 0),
            billOfLading:     $request->validated('bill_of_lading'),
            expectedDate:     $request->validated('expected_date'),
            transactionDate:  $request->validated('transaction_date'),
            note:             $request->validated('note'),
            valueAdditionPct: (float) ($request->validated('value_addition_pct') ?? 10),
            ssclPct:          (float) ($request->validated('sscl_pct') ?? 2.5),
            vatPct:           (float) ($request->validated('vat_pct') ?? 18),
            expenses:         (array) ($request->validated('expenses') ?? []),
        );
    }
}
