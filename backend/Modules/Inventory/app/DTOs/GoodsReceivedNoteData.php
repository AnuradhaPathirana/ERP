<?php

declare(strict_types=1);

namespace Modules\Inventory\DTOs;

use Modules\Inventory\Http\Requests\StoreGoodsReceivedNoteRequest;
use Modules\Inventory\Http\Requests\UpdateGoodsReceivedNoteRequest;

final class GoodsReceivedNoteData
{
    /** @param array<array{po_item_id:int, product_id:int, unit_id:?int, quantity_received:float, unit_price:float, batch_no:?string, expiry_date:?string}> $items */
    public function __construct(
        public readonly int     $poId,
        public readonly string  $grnDate,
        public readonly int     $storeId,
        public readonly ?int    $locationId,
        public readonly ?string $remarks,
        public readonly array   $items,
    ) {}

    public static function fromRequest(
        StoreGoodsReceivedNoteRequest|UpdateGoodsReceivedNoteRequest $request,
    ): self {
        return new self(
            poId:       (int) $request->validated('po_id'),
            grnDate:    $request->validated('grn_date'),
            storeId:    (int) $request->validated('store_id'),
            locationId: $request->validated('location_id') !== null
                            ? (int) $request->validated('location_id')
                            : null,
            remarks:    $request->validated('remarks'),
            items:      (array) ($request->validated('items') ?? []),
        );
    }
}
