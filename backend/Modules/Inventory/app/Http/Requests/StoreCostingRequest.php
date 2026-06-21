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
            'material_cost'    => ['nullable', 'numeric', 'min:0'],
            'bill_of_lading'   => ['nullable', 'string', 'max:100'],
            'expected_date'    => ['nullable', 'date'],
            'transaction_date' => ['nullable', 'date'],
            'note'             => ['nullable', 'string'],

            'value_addition_pct' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'sscl_pct'           => ['nullable', 'numeric', 'min:0', 'max:100'],
            'vat_pct'            => ['nullable', 'numeric', 'min:0', 'max:100'],

            'expenses'                    => ['nullable', 'array'],
            'expenses.*.expense_type_id'  => ['required_with:expenses', 'integer', 'min:1'],
            'expenses.*.amount'           => ['required_with:expenses', 'numeric', 'min:0'],
            'expenses.*.note'             => ['nullable', 'string', 'max:255'],
        ];
    }

    /** @return array<string, string> */
    public function attributes(): array
    {
        return [
            'supplier_id'   => 'supplier',
            'costing_type'  => 'costing type',
            'grn_ids'       => 'GRN list',
            'grn_ids.*'     => 'GRN',
            'material_cost' => 'material cost',
        ];
    }
}
