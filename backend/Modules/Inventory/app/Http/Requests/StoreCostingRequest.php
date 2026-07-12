<?php

declare(strict_types=1);

namespace Modules\Inventory\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreCostingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'supplier_id'      => ['required', 'integer', 'min:1'],
            'costing_type'     => ['required', 'string', 'in:fob,cif'],
            'grn_ids'          => ['required', 'array', 'min:1'],
            'grn_ids.*'        => ['required', 'integer', 'min:1'],
            'bill_of_lading'   => ['nullable', 'string', 'max:100'],
            'expected_date'    => ['nullable', 'date'],
            'transaction_date' => ['nullable', 'date'],
            'note'             => ['nullable', 'string'],

            // Single total FOB/CIF charge for the shipment — apportioned across the
            // lines BY VALUE (see CostingService::computeBreakdown), which is the only
            // basis that holds when the lines are received in different units.
            // Preferred over itemised expense rows (kept for backward compat).
            'common_charge_amount' => ['nullable', 'numeric', 'min:0'],

            'default_margin_pct' => ['nullable', 'numeric', 'min:0', 'max:1000'],
            'apply_sscl'         => ['nullable', 'boolean'],
            'sscl_pct'           => ['nullable', 'numeric', 'min:0', 'max:100'],
            'apply_vat'          => ['nullable', 'boolean'],
            'vat_pct'            => ['nullable', 'numeric', 'min:0', 'max:100'],

            'expenses'                    => ['nullable', 'array'],
            'expenses.*.expense_type_id'  => ['required_with:expenses', 'integer', 'min:1'],
            'expenses.*.amount'           => ['required_with:expenses', 'numeric', 'min:0'],
            'expenses.*.note'             => ['nullable', 'string', 'max:255'],

            // Per-line overrides of the product breakdown (margin, or a typed price).
            // A typed price is quoted PER THE PRODUCT'S STOCKING UOM — the unit the
            // customer is invoiced in. Naming the field for its unit is the point: a
            // bare "selling_price" is what let a per-Roll figure be read as per-Kg.
            'items'                      => ['nullable', 'array'],
            'items.*.grn_item_id'        => ['required_with:items', 'integer', 'min:1'],
            'items.*.margin_pct'         => ['nullable', 'numeric', 'min:0', 'max:1000'],
            'items.*.selling_price_base' => ['nullable', 'numeric', 'min:0'],
        ];
    }

    /** @return array<string, string> */
    public function attributes(): array
    {
        return [
            'supplier_id'        => 'supplier',
            'costing_type'       => 'costing type',
            'grn_ids'            => 'GRN list',
            'grn_ids.*'          => 'GRN',
            'default_margin_pct' => 'default margin',
        ];
    }
}
