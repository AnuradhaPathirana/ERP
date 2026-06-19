<?php

declare(strict_types=1);

namespace Modules\Inventory\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateGoodsReceivedNoteRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'grn_date'    => ['required', 'date'],
            'store_id'    => ['required', 'integer', 'exists:inv_stores,id'],
            'location_id' => ['nullable', 'integer', 'exists:inv_locations,id'],
            'remarks'     => ['nullable', 'string'],

            'items'                       => ['required', 'array', 'min:1'],
            'items.*.po_item_id'          => ['required', 'integer', 'exists:inv_purchase_order_items,id'],
            'items.*.product_id'          => ['required', 'integer', 'exists:inv_products,id'],
            'items.*.unit_id'             => ['nullable', 'integer', 'exists:inv_unit_types,id'],
            'items.*.quantity_received'   => ['required', 'numeric', 'min:0.0001'],
            'items.*.unit_price'          => ['required', 'numeric', 'min:0'],
            'items.*.batch_no'            => ['nullable', 'string', 'max:100'],
            'items.*.expiry_date'         => ['nullable', 'date'],
        ];
    }
}
