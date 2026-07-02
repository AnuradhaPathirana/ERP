<?php

declare(strict_types=1);

namespace Modules\Inventory\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GrnItemPiece extends Model
{
    protected $table = 'inv_grn_item_pieces';

    protected $fillable = [
        'grn_item_id',
        'grn_id',
        'product_id',
        'batch_id',
        'store_id',
        'location_id',
        'piece_no',
        'piece_code',
        'status',
        'printed_at',
        'created_by',
    ];

    protected $casts = [
        'grn_item_id' => 'integer',
        'grn_id'      => 'integer',
        'product_id'  => 'integer',
        'batch_id'    => 'integer',
        'store_id'    => 'integer',
        'location_id' => 'integer',
        'piece_no'    => 'integer',
        'printed_at'  => 'datetime',
        'created_by'  => 'integer',
    ];

    public function grnItem(): BelongsTo
    {
        return $this->belongsTo(GoodsReceivedNoteItem::class, 'grn_item_id');
    }

    public function grn(): BelongsTo
    {
        return $this->belongsTo(GoodsReceivedNote::class, 'grn_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(Batch::class, 'batch_id');
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class, 'store_id');
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class, 'location_id');
    }
}
