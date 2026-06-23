<?php

declare(strict_types=1);

namespace Modules\Inventory\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdatePurchaseRequestRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'request_date'        => ['required', 'date'],
            'reference_no'        => ['nullable', 'string', 'max:50'],
            'purpose'             => ['nullable', 'string', 'max:200'],
            'source_location_id'  => ['nullable', 'integer', 'exists:inv_locations,id'],
            'source_store_id'     => ['nullable', 'integer', 'exists:inv_stores,id'],
            'target_location_id'  => ['nullable', 'integer', 'exists:inv_locations,id'],
            'target_store_id'     => ['nullable', 'integer', 'exists:inv_stores,id'],
            'customer_id'         => ['nullable', 'integer', 'exists:inv_customer_masters,id'],
            'required_date'       => ['nullable', 'date', 'after_or_equal:request_date'],
            'transport_mode'      => ['nullable', 'string', 'max:100'],
            'remarks'             => ['nullable', 'string'],
            'submit_for_approval' => ['nullable', 'boolean'],

            'items'                        => ['required', 'array', 'min:1'],
            'items.*.product_id'           => ['required', 'integer', 'exists:inv_products,id'],
            'items.*.unit_id'              => ['required', 'integer', 'exists:inv_unit_types,id'],
            'items.*.quantity'             => ['required', 'numeric', 'min:0.0001'],
            'items.*.estimated_unit_price' => ['nullable', 'numeric', 'min:0'],
            'items.*.remarks'              => ['nullable', 'string', 'max:255'],
        ];
    }
}
