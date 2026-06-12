<?php

declare(strict_types=1);

namespace Modules\Inventory\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        $productId = $this->route('product')?->getKey();

        return [
            // Required identifiers
            'product_code'           => ['required', 'string', 'max:50', Rule::unique('inv_products', 'product_code')->ignore($productId)],
            'display_name'           => ['required', 'string', 'max:100'],
            'product_type'           => ['required', 'string', 'max:50'],
            'supplier_ids'           => ['required', 'array', 'min:1'],
            'supplier_ids.*'         => ['integer', 'exists:inv_supplier_masters,id'],

            // Optional identifiers
            'reference_no'           => ['nullable', 'string', 'max:50'],
            'ean_13'                 => ['nullable', 'string', 'max:50'],

            // Core
            'name'                   => ['required', 'string', 'max:100'],
            'description'            => ['nullable', 'string'],

            // Classification
            'category'               => ['nullable', 'string', 'max:100'],
            'location'               => ['nullable', 'string', 'max:100'],

            // Reorder
            'reorder_level'          => ['nullable', 'numeric', 'min:0'],
            'reorder_qty'            => ['nullable', 'numeric', 'min:0'],
            'reorder_period'         => ['nullable', 'string', 'max:50'],

            // Stock control
            'stock_releasing_method' => ['nullable', 'string', 'max:50'],
            'tracking_type'          => ['nullable', 'string', Rule::in(['Batch', 'Serial'])],

            // Flags
            'lock_purchase'             => ['nullable', 'boolean'],
            'allow_complimentary_items' => ['nullable', 'boolean'],
            'free_issue'                => ['nullable', 'boolean'],
            'allow_minus'               => ['nullable', 'boolean'],
            'not_allow_direct_sale'     => ['nullable', 'boolean'],
            'non_returnable'            => ['nullable', 'boolean'],
            'is_empty'                  => ['nullable', 'boolean'],
            'service_charge'            => ['nullable', 'boolean'],
            'loyalty'                   => ['nullable', 'boolean'],
            'is_batch'                  => ['nullable', 'boolean'],
            'is_serial'                 => ['nullable', 'boolean'],

            // Cost details per sales channel
            'cost_details'                                  => ['nullable', 'array'],
            'cost_details.*.sales_channel_id'               => ['required', 'integer', 'exists:inv_sales_channels,id'],
            'cost_details.*.uom'                            => ['nullable', 'string', 'max:50'],
            'cost_details.*.num_of_units'                   => ['nullable', 'numeric', 'min:0'],
            'cost_details.*.cost_price'                     => ['nullable', 'numeric', 'min:0'],
            'cost_details.*.margin'                         => ['nullable', 'numeric'],
            'cost_details.*.selling_price'                  => ['nullable', 'numeric', 'min:0'],
            'cost_details.*.max_price'                      => ['nullable', 'numeric', 'min:0'],
            'cost_details.*.min_price'                      => ['nullable', 'numeric', 'min:0'],
            'cost_details.*.wholesale_price'                => ['nullable', 'numeric', 'min:0'],
            'cost_details.*.sale_privileges_discount'       => ['nullable', 'numeric', 'min:0', 'max:100'],
            'cost_details.*.purchasing_privileges_discount' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ];
    }

    /** @return array<string, string> */
    public function attributes(): array
    {
        return [
            'product_code'                          => 'product code',
            'reference_no'                          => 'reference number',
            'ean_13'                                => 'EAN / barcode',
            'display_name'                          => 'display name',
            'product_type'                          => 'product type',
            'supplier_ids'                          => 'supplier',
            'reorder_level'                         => 'reorder level',
            'reorder_qty'                           => 'reorder quantity',
            'reorder_period'                        => 'reorder period',
            'stock_releasing_method'                => 'stock releasing method',
            'tracking_type'                         => 'tracking type',
            'cost_details.*.sales_channel_id'       => 'sales channel',
            'cost_details.*.uom'                    => 'unit of measure',
            'cost_details.*.num_of_units'           => 'number of units',
            'cost_details.*.cost_price'             => 'cost price',
            'cost_details.*.margin'                 => 'margin',
            'cost_details.*.selling_price'          => 'selling price',
            'cost_details.*.sale_privileges_discount' => 'privileges discount',
        ];
    }
}
