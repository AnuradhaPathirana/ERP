<?php

declare(strict_types=1);

namespace Modules\Inventory\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Modules\Inventory\Enums\PurchaseOrderStatus;

class StorePurchaseOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'po_no'                  => ['required', 'string', 'max:30', 'unique:inv_purchase_orders,po_no'],
            'pr_id'                  => ['nullable', 'integer', 'exists:inv_purchase_requests,id'],
            'supplier_id'            => ['required', 'integer', 'exists:inv_supplier_masters,id'],
            'store_id'               => ['required', 'integer', 'exists:inv_stores,id'],
            'location_id'            => ['required', 'integer', 'exists:inv_locations,id'],
            'order_date'             => ['required', 'date'],
            'expected_delivery_date' => ['nullable', 'date', 'after_or_equal:order_date'],
            'reference_no'           => ['nullable', 'string', 'max:100'],
            'payment_terms'          => ['nullable', 'string', 'max:100'],
            'contact_person_name'    => ['required', 'string', 'max:100'],
            'contact_person_phone'   => ['required', 'string', 'max:30'],
            'is_consignment'         => ['nullable', 'boolean'],
            'billing_address'        => ['required', 'string', 'max:500'],
            'shipping_address'       => ['nullable', 'string', 'max:500'],
            'remarks'                => ['nullable', 'string', 'max:1000'],
            'status'                 => ['nullable', 'string', Rule::in(array_column(PurchaseOrderStatus::cases(), 'value'))],

            'items'                      => ['required', 'array', 'min:1'],
            'items.*.product_id'         => ['required', 'integer', 'exists:inv_products,id'],
            'items.*.unit_id'            => ['nullable', 'integer', 'exists:inv_unit_types,id'],
            'items.*.pr_item_id'         => ['nullable', 'integer', 'exists:inv_purchase_request_items,id'],
            'items.*.quantity_ordered'   => ['required', 'numeric', 'min:0.0001'],
            'items.*.unit_price'         => ['required', 'numeric', 'min:0'],
            'items.*.discount'           => ['nullable', 'numeric', 'min:0', 'max:100'],
            'items.*.tax'                => ['nullable', 'numeric', 'min:0', 'max:100'],
            'items.*.remarks'            => ['nullable', 'string', 'max:255'],
        ];
    }

    /** @return array<string, string> */
    public function attributes(): array
    {
        return [
            'po_no'                    => 'PO number',
            'supplier_id'              => 'supplier',
            'store_id'                 => 'store',
            'location_id'              => 'location',
            'order_date'               => 'transaction date',
            'expected_delivery_date'   => 'expected delivery date',
            'contact_person_name'      => 'contact person',
            'contact_person_phone'     => 'contact phone',
            'billing_address'          => 'billing address',
            'items.*.product_id'       => 'product',
            'items.*.quantity_ordered' => 'quantity',
            'items.*.unit_price'       => 'unit price',
        ];
    }
}
