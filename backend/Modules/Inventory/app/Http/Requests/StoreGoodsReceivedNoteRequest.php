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
            'supplier_id'      => ['required', 'integer', 'exists:inv_supplier_masters,id'],
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
            'items.*.po_item_id'          => ['nullable', 'integer', 'exists:inv_purchase_order_items,id'],
            'items.*.product_id'          => ['required', 'integer', 'exists:inv_products,id'],
            'items.*.unit_id'             => ['required', 'integer', 'exists:inv_unit_types,id'],
            'items.*.quantity_received'   => ['required', 'numeric', 'min:0.0001'],
            'items.*.no_of_pieces'        => ['required', 'integer', 'min:0'],
            'items.*.unit_price'          => ['required', 'numeric', 'min:0'],
            'items.*.discount'            => ['nullable', 'numeric', 'min:0', 'max:100'],
            'items.*.tax'                 => ['nullable', 'numeric', 'min:0', 'max:100'],
            'items.*.batch_no'            => ['nullable', 'string', 'max:100'],
            'items.*.expiry_date'         => ['nullable', 'date'],

            'items.*.batches'                         => ['nullable', 'array'],
            'items.*.batches.*.batch_no'              => ['required_with:items.*.batches', 'string', 'max:100'],
            'items.*.batches.*.quantity'              => ['required_with:items.*.batches', 'numeric', 'min:0.0001'],
            'items.*.batches.*.mfg_date'              => ['nullable', 'date'],
            'items.*.batches.*.expiry_date'           => ['nullable', 'date'],
            'items.*.batches.*.supplier_batch_no'     => ['nullable', 'string', 'max:100'],
            'items.*.batches.*.status'                => ['nullable', 'string', 'in:active,quarantine,on_hold'],
            'items.*.batches.*.country_of_origin'     => ['nullable', 'string', 'max:100'],
            'items.*.batches.*.notes'                 => ['nullable', 'string', 'max:500'],
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
            'items.*.po_item_id'        => 'PO item',
            'items.*.product_id'        => 'product',
            'items.*.unit_id'           => 'unit of measure',
            'items.*.quantity_received' => 'quantity received',
            'items.*.no_of_pieces'      => 'no. of pieces',
            'items.*.unit_price'        => 'unit price',
        ];
    }
}
