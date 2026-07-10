<?php

declare(strict_types=1);

namespace Modules\Inventory\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Per-product landed-cost breakdown line of a costing. Monetary values are
 * PER UNIT: unit_price (GRN purchase) + charge_portion = landed_unit_cost,
 * + margin_amount (±SSCL/±VAT when toggled) = selling_price.
 */
class CostingItem extends Model
{
    protected $table = 'inv_costing_items';

    protected $fillable = [
        'costing_id',
        'grn_id',
        'grn_item_id',
        'product_id',
        'attribute_id',
        'unit_id',
        'quantity',
        'unit_price',
        'charge_portion',
        'landed_unit_cost',
        'margin_pct',
        'margin_amount',
        'sscl_amount',
        'vat_amount',
        'selling_price',
        'is_price_overridden',
    ];

    protected $casts = [
        'costing_id'          => 'integer',
        'grn_id'              => 'integer',
        'grn_item_id'         => 'integer',
        'product_id'          => 'integer',
        'attribute_id'        => 'integer',
        'unit_id'             => 'integer',
        'quantity'            => 'decimal:4',
        'unit_price'          => 'decimal:4',
        'charge_portion'      => 'decimal:4',
        'landed_unit_cost'    => 'decimal:4',
        'margin_pct'          => 'decimal:4',
        'margin_amount'       => 'decimal:4',
        'sscl_amount'         => 'decimal:4',
        'vat_amount'          => 'decimal:4',
        'selling_price'       => 'decimal:4',
        'is_price_overridden' => 'boolean',
    ];

    public function costing(): BelongsTo
    {
        return $this->belongsTo(Costing::class, 'costing_id');
    }

    public function grn(): BelongsTo
    {
        return $this->belongsTo(GoodsReceivedNote::class, 'grn_id');
    }

    public function grnItem(): BelongsTo
    {
        return $this->belongsTo(GoodsReceivedNoteItem::class, 'grn_item_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
    }

    public function attribute(): BelongsTo
    {
        return $this->belongsTo(Attribute::class, 'attribute_id');
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(UnitType::class, 'unit_id');
    }
}
