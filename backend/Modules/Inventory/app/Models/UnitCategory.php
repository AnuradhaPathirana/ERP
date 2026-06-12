<?php

declare(strict_types=1);

namespace Modules\Inventory\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Modules\Inventory\Database\Factories\UnitCategoryFactory;

class UnitCategory extends Model
{
    use HasFactory;

    protected $table = 'inv_unit_categories';

    protected $fillable = [
        'name',
        'description',
    ];

    public function unitTypes(): HasMany
    {
        return $this->hasMany(UnitType::class);
    }

    protected static function newFactory(): UnitCategoryFactory
    {
        return UnitCategoryFactory::new();
    }
}
