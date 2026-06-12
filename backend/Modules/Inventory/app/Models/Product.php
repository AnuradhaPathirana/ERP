<?php

declare(strict_types=1);

namespace Modules\Inventory\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Product extends Model
{
    use HasFactory;

    protected $table = 'inv_products';

    protected $fillable = [
        'product_code',
        'reference_no',
        'ean_13',
        'name',
        'display_name',
        'product_type',
        'description',
        'category',
        'location',
        'reorder_level',
        'reorder_qty',
        'reorder_period',
        'stock_releasing_method',
        'tracking_type',
        'lock_purchase',
        'allow_complimentary_items',
        'free_issue',
        'allow_minus',
        'not_allow_direct_sale',
        'non_returnable',
        'is_empty',
        'service_charge',
        'loyalty',
    ];

    protected $casts = [
        'reorder_level'             => 'decimal:4',
        'reorder_qty'               => 'decimal:4',
        'lock_purchase'             => 'boolean',
        'allow_complimentary_items' => 'boolean',
        'free_issue'                => 'boolean',
        'allow_minus'               => 'boolean',
        'not_allow_direct_sale'     => 'boolean',
        'non_returnable'            => 'boolean',
        'is_empty'                  => 'boolean',
        'service_charge'            => 'boolean',
        'loyalty'                   => 'boolean',
    ];

    public function suppliers(): BelongsToMany
    {
        return $this->belongsToMany(SupplierMaster::class, 'inv_product_supplier')
            ->withTimestamps();
    }
}
