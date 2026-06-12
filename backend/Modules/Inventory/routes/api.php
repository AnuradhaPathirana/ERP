<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;
use Modules\Inventory\Http\Controllers\CompanyController;
use Modules\Inventory\Http\Controllers\IndustryController;
use Modules\Inventory\Http\Controllers\LocationController;
use Modules\Inventory\Http\Controllers\ProductController;
use Modules\Inventory\Http\Controllers\SalesChannelController;
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

    Route::get('unit-types/all', [UnitTypeController::class, 'all'])
        ->name('inventory.unit-types.all');

    Route::apiResource('unit-types', UnitTypeController::class)
        ->names('inventory.unit-types');

    Route::apiResource('unit-conversions', UnitConversionController::class)
        ->names('inventory.unit-conversions');

    // Products — per-action permission middleware applied in ProductController constructor
    Route::apiResource('products', ProductController::class)
        ->names('inventory.products');

    Route::get('supplier-masters/all', [SupplierMasterController::class, 'all'])
        ->name('inventory.supplier-masters.all');

    Route::apiResource('supplier-masters', SupplierMasterController::class)
        ->names('inventory.supplier-masters');

    Route::get('sales-channels/all', [SalesChannelController::class, 'all'])
        ->name('inventory.sales-channels.all');

    Route::apiResource('sales-channels', SalesChannelController::class)
        ->names('inventory.sales-channels');

    Route::get('industries/all', [IndustryController::class, 'all'])
        ->name('inventory.industries.all');

    Route::apiResource('industries', IndustryController::class)
        ->names('inventory.industries');

    Route::apiResource('companies', CompanyController::class)
        ->names('inventory.companies');

    Route::get('locations/all', [LocationController::class, 'all'])
        ->name('inventory.locations.all');

    Route::apiResource('locations', LocationController::class)
        ->names('inventory.locations');
});
