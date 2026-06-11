<?php

declare(strict_types=1);

namespace Modules\Inventory\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class UnitCategory extends Model
{
    protected $fillable = [
        'name',
        'description',
    ];

    public function unitTypes(): HasMany
    {
        return $this->hasMany(UnitType::class);
    }
}
