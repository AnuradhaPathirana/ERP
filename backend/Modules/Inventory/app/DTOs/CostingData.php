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
     * @param array<array{grn_item_id:int, margin_pct:?float, selling_price_base:?float}> $items
     *        Per-line overrides for the product breakdown: a line margin that
     *        differs from the default, or a directly-typed selling price — the
     *        latter quoted per the product's STOCKING UOM, not the receiving unit.
     */
    public function __construct(
        public readonly int     $supplierId,
        public readonly string  $costingType,
        public readonly array   $grnIds,
        public readonly ?string $billOfLading,
        public readonly ?string $expectedDate,
        public readonly ?string $transactionDate,
        public readonly ?string $note,
        public readonly ?float  $commonChargeAmount,
        public readonly float   $defaultMarginPct,
        public readonly bool    $applySscl,
        public readonly float   $ssclPct,
        public readonly bool    $applyVat,
        public readonly float   $vatPct,
        public readonly array   $expenses,
        public readonly array   $items,
    ) {}

    public static function fromRequest(
        StoreCostingRequest|UpdateCostingRequest $request,
    ): self {
        return new self(
            supplierId:       (int) $request->validated('supplier_id'),
            costingType:      $request->validated('costing_type'),
            grnIds:           array_map('intval', (array) ($request->validated('grn_ids') ?? [])),
            billOfLading:     $request->validated('bill_of_lading'),
            expectedDate:     $request->validated('expected_date'),
            transactionDate:  $request->validated('transaction_date'),
            note:             $request->validated('note'),
            commonChargeAmount: $request->validated('common_charge_amount') !== null
                ? (float) $request->validated('common_charge_amount') : null,
            defaultMarginPct: (float) ($request->validated('default_margin_pct') ?? 0),
            applySscl:        (bool) ($request->validated('apply_sscl') ?? false),
            ssclPct:          (float) ($request->validated('sscl_pct') ?? 2.5),
            applyVat:         (bool) ($request->validated('apply_vat') ?? false),
            vatPct:           (float) ($request->validated('vat_pct') ?? 18),
            expenses:         (array) ($request->validated('expenses') ?? []),
            items:            (array) ($request->validated('items') ?? []),
        );
    }
}
