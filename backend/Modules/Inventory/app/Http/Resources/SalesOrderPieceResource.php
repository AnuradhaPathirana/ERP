<?php

declare(strict_types=1);

namespace Modules\Inventory\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SalesOrderPieceResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id'             => $this->id,
            'piece_id'       => $this->piece_id,
            'piece_code'     => $this->piece_code,
            'weight'         => (float) $this->weight,
            'grn_unit_price' => (float) $this->grn_unit_price,
            'roll_no'        => $this->whenLoaded('piece', fn () => $this->piece?->roll_no),
            'delivered'      => $this->whenLoaded('piece', fn () => $this->piece?->status === \Modules\Inventory\Models\GrnItemPiece::STATUS_DELIVERED),
        ];
    }
}
