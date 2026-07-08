<?php

declare(strict_types=1);

namespace Modules\Inventory\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SalesOrderResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id'               => $this->id,
            'so_no'            => $this->so_no,
            'reference_no'     => $this->reference_no,
            'customer_id'      => $this->customer_id,
            'sales_person_id'  => $this->sales_person_id,
            'order_taken_by'   => $this->order_taken_by,
            'customer_type'    => $this->customer_type,
            'order_date'       => $this->order_date?->toDateString(),
            'expected_date'    => $this->expected_date?->toDateString(),
            'transaction_date' => $this->transaction_date?->toDateString(),
            'order_source'     => $this->order_source,
            'delivery_address' => $this->delivery_address,
            'status'           => $this->status->value,
            'status_label'     => $this->status->label(),
            'subtotal'         => (float) $this->subtotal,
            'transport_charge' => (float) $this->transport_charge,
            'grand_total'      => (float) $this->grand_total,
            'remarks'          => $this->remarks,

            'total_quantity' => $this->when(
                $this->total_quantity !== null || $this->resource->relationLoaded('items'),
                fn () => (float) ($this->total_quantity ?? $this->items->sum('quantity')),
            ),

            'customer' => $this->whenLoaded('customer', fn () => [
                'id'            => $this->customer->id,
                'customer_code' => $this->customer->customer_code,
                'name'          => $this->customer->customer_name,
                'customer_type' => $this->customer->customer_type,
            ]),
            'sales_person' => $this->whenLoaded('salesPerson', fn () => $this->salesPerson ? [
                'id'   => $this->salesPerson->id,
                'name' => $this->salesPerson->name,
            ] : null),
            'order_taken_by_user' => $this->whenLoaded('orderTakenBy', fn () => $this->orderTakenBy ? [
                'id'   => $this->orderTakenBy->id,
                'name' => $this->orderTakenBy->name,
            ] : null),

            'items' => $this->when(
                $this->resource->relationLoaded('items'),
                fn () => SalesOrderItemResource::collection($this->items),
            ),

            'created_at' => $this->created_at?->toDateTimeString(),
            'updated_at' => $this->updated_at?->toDateTimeString(),
        ];
    }
}
