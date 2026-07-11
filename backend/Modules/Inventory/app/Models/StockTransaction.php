<?php

declare(strict_types=1);

namespace Modules\Inventory\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockTransaction extends Model
{
    protected $table = 'inv_stock_transactions';

    protected $fillable = [
        'transaction_date',
        'reference_type',
        'reference_id',
        'product_id',
        'store_id',
        'location_id',
        'batch_no',
        'batch_id',
        'expiry_date',
        'qty_in',
        'qty_out',
        'unit_id',
        'unit_price',
        'created_by',
    ];

    protected $casts = [
        'transaction_date' => 'datetime',
        'expiry_date'      => 'date',
        'qty_in'           => 'decimal:4',
        'qty_out'          => 'decimal:4',
        'unit_price'       => 'decimal:8',
        'reference_id'     => 'integer',
        'product_id'       => 'integer',
        'store_id'         => 'integer',
        'location_id'      => 'integer',
        'batch_id'         => 'integer',
        'unit_id'          => 'integer',
        'created_by'       => 'integer',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class, 'store_id');
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class, 'location_id');
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(Batch::class, 'batch_id');
    }
}
