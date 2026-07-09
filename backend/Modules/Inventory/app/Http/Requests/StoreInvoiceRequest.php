<?php

declare(strict_types=1);

namespace Modules\Inventory\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreInvoiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            // Source is exactly one of the two: a confirmed DO or a sales order (advance billing)
            'so_id'            => ['nullable', 'required_without:do_id', 'prohibits:do_id', 'integer', 'exists:inv_sales_orders,id'],
            'do_id'            => ['nullable', 'required_without:so_id', 'integer', 'exists:inv_delivery_orders,id'],
            'invoice_date'     => ['required', 'date'],
            'due_date'         => ['nullable', 'date', 'after_or_equal:invoice_date'],
            'transport_charge' => ['nullable', 'numeric', 'min:0'],
            'delivery_address' => ['nullable', 'string', 'max:2000'],
            'remarks'          => ['nullable', 'string', 'max:2000'],

            // Draft-stage re-pricing only — quantities always come from the DO/SO
            'items'              => ['nullable', 'array'],
            'items.*.so_item_id' => ['required', 'integer'],
            'items.*.unit_price' => ['nullable', 'numeric', 'min:0'],
            'items.*.discount'   => ['nullable', 'numeric', 'min:0', 'max:100'],
            'items.*.tax'        => ['nullable', 'numeric', 'min:0', 'max:100'],
            'items.*.remarks'    => ['nullable', 'string', 'max:255'],
        ];
    }

    /** @return array<string, string> */
    public function attributes(): array
    {
        return [
            'so_id'            => 'sales order',
            'do_id'            => 'delivery order',
            'invoice_date'     => 'invoice date',
            'due_date'         => 'due date',
            'transport_charge' => 'transport charge',
        ];
    }
}
