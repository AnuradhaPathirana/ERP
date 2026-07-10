<?php

declare(strict_types=1);

namespace Modules\Inventory\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Per-product landed-cost breakdown line — full per-unit price build-up
 * (purchase → +charges → landed → +margin → ±SSCL/±VAT → selling).
 */
class CostingItemResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id'                  => $this->id,
            'grn_id'              => $this->grn_id,
            'grn_item_id'         => $this->grn_item_id,
            'product_id'          => $this->product_id,
            'attribute_id'        => $this->attribute_id,
            'unit_id'             => $this->unit_id,
            'quantity'            => (float) $this->quantity,
            'unit_price'          => (float) $this->unit_price,
            'charge_portion'      => (float) $this->charge_portion,
            'landed_unit_cost'    => (float) $this->landed_unit_cost,
            'margin_pct'          => $this->margin_pct !== null ? (float) $this->margin_pct : null,
            'margin_amount'       => (float) $this->margin_amount,
            'sscl_amount'         => (float) $this->sscl_amount,
            'vat_amount'          => (float) $this->vat_amount,
            'selling_price'       => (float) $this->selling_price,
            'is_price_overridden' => (bool) $this->is_price_overridden,

            'product_name'  => $this->whenLoaded('product', fn () => $this->product?->name),
            'product_code'  => $this->whenLoaded('product', fn () => $this->product?->product_code),
            'color'         => $this->whenLoaded('attribute', fn () => $this->attribute?->attribute_name),
            'grn_no'        => $this->whenLoaded('grn', fn () => $this->grn?->grn_no),
            'unit_symbol'   => $this->whenLoaded('unit', fn () => $this->unit?->symbol),
            'unit_position' => $this->whenLoaded('unit', fn () => $this->unit?->unit_position),
        ];
    }
}
