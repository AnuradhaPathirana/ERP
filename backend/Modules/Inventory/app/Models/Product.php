<?php

declare(strict_types=1);

namespace Modules\Inventory\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Modules\Inventory\Database\Factories\ProductFactory;
use Modules\Inventory\Models\Category;
use Modules\Inventory\Models\Location;
use Modules\Inventory\Models\ProductAttribute;
use Modules\Inventory\Models\ProductLocationStore;
use Modules\Inventory\Models\SalesChannel;
use Modules\Inventory\Models\SupplierMaster;

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
        'category_id',
        'location_id',
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
        'is_batch',
        'is_serial',
    ];

    protected $casts = [
        'category_id'               => 'integer',
        'location_id'               => 'integer',
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
        'is_batch'                  => 'boolean',
        'is_serial'                 => 'boolean',
    ];

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class, 'category_id');
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class, 'location_id');
    }

    public function locationStores(): HasMany
    {
        return $this->hasMany(ProductLocationStore::class, 'product_id');
    }

    public function suppliers(): BelongsToMany
    {
        return $this->belongsToMany(SupplierMaster::class, 'inv_product_supplier')
            ->withTimestamps();
    }

    public function productAttributes(): HasMany
    {
        return $this->hasMany(ProductAttribute::class, 'product_id');
    }

    public function salesChannels(): BelongsToMany
    {
        return $this->belongsToMany(SalesChannel::class, 'inv_product_sales_channels')
            ->withPivot([
                'uom',
                'num_of_units',
                'cost_price',
                'margin',
                'selling_price',
                'max_price',
                'min_price',
                'wholesale_price',
                'sale_privileges_discount',
                'purchasing_privileges_discount',
            ])
            ->withTimestamps();
    }

    protected static function newFactory(): ProductFactory
    {
        return ProductFactory::new();
    }
}
