<?php

declare(strict_types=1);

namespace Modules\Inventory\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GoodsReceivedNoteItem extends Model
{
    protected $table = 'inv_goods_received_note_items';

    protected $fillable = [
        'grn_id',
        'po_item_id',
        'product_id',
        'unit_id',
        'quantity_ordered',
        'quantity_received',
        'unit_price',
        'line_total',
        'batch_no',
        'expiry_date',
    ];

    protected $casts = [
        'grn_id'            => 'integer',
        'po_item_id'        => 'integer',
        'product_id'        => 'integer',
        'unit_id'           => 'integer',
        'quantity_ordered'  => 'decimal:4',
        'quantity_received' => 'decimal:4',
        'unit_price'        => 'decimal:4',
        'line_total'        => 'decimal:4',
        'expiry_date'       => 'date',
    ];

    public function grn(): BelongsTo
    {
        return $this->belongsTo(GoodsReceivedNote::class, 'grn_id');
    }

    public function poItem(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrderItem::class, 'po_item_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(UnitType::class, 'unit_id');
    }
}
