<?php

declare(strict_types=1);

namespace Modules\Inventory\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreGoodsReceivedNoteRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'po_id'       => ['required', 'integer', 'exists:inv_purchase_orders,id'],
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

    /** @return array<string, string> */
    public function attributes(): array
    {
        return [
            'po_id'                     => 'purchase order',
            'grn_date'                  => 'GRN date',
            'store_id'                  => 'store',
            'items.*.po_item_id'        => 'PO item',
            'items.*.product_id'        => 'product',
            'items.*.quantity_received' => 'quantity received',
            'items.*.unit_price'        => 'unit price',
        ];
    }
}
