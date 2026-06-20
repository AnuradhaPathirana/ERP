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
            'po_id'            => ['nullable', 'integer', 'exists:inv_purchase_orders,id'],
            'supplier_id'      => ['nullable', 'integer', 'exists:inv_supplier_masters,id'],
            'grn_date'         => ['required', 'date'],
            'transaction_date' => ['nullable', 'date'],
            'reference_no'     => ['nullable', 'string', 'max:100'],
            'store_id'         => ['required', 'integer', 'exists:inv_stores,id'],
            'location_id'      => ['required', 'integer', 'exists:inv_locations,id'],
            'remarks'          => ['nullable', 'string'],
            'payment_terms'    => ['nullable', 'string', 'max:100'],
            'attachments'      => ['nullable', 'array'],
            'attachments.*'    => ['nullable', 'string'],

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
            'supplier_id'               => 'supplier',
            'grn_date'                  => 'GRN date',
            'transaction_date'          => 'transaction date',
            'location_id'               => 'receiving location',
            'store_id'                  => 'receiving store',
            'items.*.po_item_id'        => 'PO item',
            'items.*.product_id'        => 'product',
            'items.*.quantity_received' => 'quantity received',
            'items.*.unit_price'        => 'unit price',
        ];
    }
}
