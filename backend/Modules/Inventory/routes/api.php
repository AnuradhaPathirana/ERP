<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;
use Modules\Inventory\Http\Controllers\SupplierMasterController;
use Modules\Inventory\Http\Controllers\UnitCategoryController;
use Modules\Inventory\Http\Controllers\UnitConversionController;
use Modules\Inventory\Http\Controllers\UnitTypeController;

Route::middleware(['auth:sanctum', 'module:inventory'])->prefix('v1')->group(function (): void {
    // Named route before apiResource so /unit-categories/all is not swallowed by {unit_category}
    Route::get('unit-categories/all', [UnitCategoryController::class, 'all'])
        ->name('inventory.unit-categories.all');

    Route::apiResource('unit-categories', UnitCategoryController::class)
        ->names('inventory.unit-categories');

    Route::apiResource('unit-types', UnitTypeController::class)
        ->names('inventory.unit-types');

    Route::apiResource('unit-conversions', UnitConversionController::class)
        ->names('inventory.unit-conversions');

    Route::get('supplier-masters/all', [SupplierMasterController::class, 'all'])
        ->name('inventory.supplier-masters.all');

    Route::apiResource('supplier-masters', SupplierMasterController::class)
        ->names('inventory.supplier-masters');
});
