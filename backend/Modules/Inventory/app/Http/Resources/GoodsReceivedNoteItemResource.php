<?php

declare(strict_types=1);

namespace Modules\Inventory\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class GoodsReceivedNoteItemResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id'                => $this->id,
            'grn_id'            => $this->grn_id,
            'po_item_id'        => $this->po_item_id,
            'product_id'        => $this->product_id,
            'unit_id'           => $this->unit_id,
            'quantity_ordered'  => (float) $this->quantity_ordered,
            'quantity_received' => (float) $this->quantity_received,
            'unit_price'        => (float) $this->unit_price,
            'discount'          => (float) $this->discount,
            'tax'               => (float) $this->tax,
            'line_total'        => (float) $this->line_total,
            'batch_no'          => $this->batch_no,
            'expiry_date'       => $this->expiry_date?->toDateString(),

            'product' => $this->whenLoaded('product', fn () => [
                'id'           => $this->product->id,
                'name'         => $this->product->name,
                'product_code' => $this->product->product_code,
                'is_batch'     => $this->product->is_batch,
                'is_serial'    => $this->product->is_serial,
            ]),
            'unit' => $this->whenLoaded('unit', fn () => [
                'id'   => $this->unit->id,
                'name' => $this->unit->name,
            ]),
            'batch_assignments' => $this->whenLoaded('batchAssignments', fn () =>
                $this->batchAssignments->map(fn ($a) => [
                    'id'                 => $a->id,
                    'batch_id'           => $a->batch_id,
                    'quantity'           => (float) $a->quantity,
                    'unit_cost'          => (float) $a->unit_cost,
                    'batch_no'           => $a->batch?->batch_no,
                    'supplier_batch_no'  => $a->batch?->supplier_batch_no,
                    'mfg_date'           => $a->batch?->mfg_date?->toDateString(),
                    'expiry_date'        => $a->batch?->expiry_date?->toDateString(),
                    'status'             => $a->batch?->status?->value,
                    'status_label'       => $a->batch?->status?->label(),
                    'notes'              => $a->batch?->notes,
                ])
            ),
        ];
    }
}
