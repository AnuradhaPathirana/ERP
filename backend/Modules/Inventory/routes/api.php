<?php

declare(strict_types=1);

use App\Http\Middleware\InitializeTenancyByUser;
use Illuminate\Support\Facades\Route;
use Modules\Inventory\Http\Controllers\UnitCategoryController;
use Modules\Inventory\Http\Controllers\UnitConversionController;
use Modules\Inventory\Http\Controllers\UnitTypeController;

Route::middleware(['auth:sanctum', InitializeTenancyByUser::class])->prefix('v1')->group(function (): void {
    // Named route before apiResource so /unit-categories/all is not swallowed by {unit_category}
    Route::get('unit-categories/all', [UnitCategoryController::class, 'all'])
        ->name('inventory.unit-categories.all');

    Route::apiResource('unit-categories', UnitCategoryController::class)
        ->names('inventory.unit-categories');

    Route::apiResource('unit-types', UnitTypeController::class)
        ->names('inventory.unit-types');

    Route::apiResource('unit-conversions', UnitConversionController::class)
        ->names('inventory.unit-conversions');
});
