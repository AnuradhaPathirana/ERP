<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;
use Modules\Inventory\Http\Controllers\UnitCategoryController;
use Modules\Inventory\Http\Controllers\UnitConversionController;
use Modules\Inventory\Http\Controllers\UnitTypeController;

Route::middleware(['auth:sanctum'])->prefix('v1')->group(function (): void {
    Route::apiResource('unit-categories', UnitCategoryController::class)
        ->names('inventory.unit-categories');

    Route::apiResource('unit-types', UnitTypeController::class)
        ->names('inventory.unit-types');

    Route::apiResource('unit-conversions', UnitConversionController::class)
        ->names('inventory.unit-conversions');
});
