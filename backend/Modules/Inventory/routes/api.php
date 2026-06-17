<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;
use Modules\Inventory\Http\Controllers\AttributeController;
use Modules\Inventory\Http\Controllers\AttributeTypeController;
use Modules\Inventory\Http\Controllers\CategoryController;
use Modules\Inventory\Http\Controllers\CompanyController;
use Modules\Inventory\Http\Controllers\CustomerAttachmentController;
use Modules\Inventory\Http\Controllers\CustomerController;
use Modules\Inventory\Http\Controllers\IndustryController;
use Modules\Inventory\Http\Controllers\LocationController;
use Modules\Inventory\Http\Controllers\ProductController;
use Modules\Inventory\Http\Controllers\SalesChannelController;
use Modules\Inventory\Http\Controllers\StoreController;
use Modules\Inventory\Http\Controllers\StoreTypeController;
use Modules\Inventory\Http\Controllers\SupplierMasterController;
use Modules\Inventory\Http\Controllers\DriverController;
use Modules\Inventory\Http\Controllers\VehicleController;
use Modules\Inventory\Http\Controllers\UnitCategoryController;
use Modules\Inventory\Http\Controllers\UnitConversionController;
use Modules\Inventory\Http\Controllers\UnitTypeController;

Route::middleware(['auth:sanctum', 'module:inventory'])->prefix('v1')->group(function (): void {
    // Named routes before apiResource so static segments are not swallowed by {unit_category}
    Route::get('unit-categories/all', [UnitCategoryController::class, 'all'])
        ->name('inventory.unit-categories.all');
    Route::post('unit-categories/bulk', [UnitCategoryController::class, 'bulkStore'])
        ->name('inventory.unit-categories.bulk-store');

    Route::apiResource('unit-categories', UnitCategoryController::class)
        ->names('inventory.unit-categories');

    Route::get('unit-types/all', [UnitTypeController::class, 'all'])
        ->name('inventory.unit-types.all');

    Route::apiResource('unit-types', UnitTypeController::class)
        ->names('inventory.unit-types');

    // Named routes before apiResource so they are not swallowed by {unit_conversion}
    Route::get('unit-conversions/by-category/{categoryId}', [UnitConversionController::class, 'byCategory'])
        ->name('inventory.unit-conversions.by-category');

    Route::post('unit-conversions/save-rates', [UnitConversionController::class, 'saveRates'])
        ->name('inventory.unit-conversions.save-rates');

    // Products — per-action permission middleware applied in ProductController constructor
    Route::get('products/check-code', [ProductController::class, 'checkCode'])
        ->name('inventory.products.check-code');

    Route::apiResource('products', ProductController::class)
        ->names('inventory.products');

    Route::get('supplier-masters/all', [SupplierMasterController::class, 'all'])
        ->name('inventory.supplier-masters.all');

    Route::get('supplier-masters/check-code', [SupplierMasterController::class, 'checkCode'])
        ->name('inventory.supplier-masters.check-code');

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

    Route::get('companies/all', [CompanyController::class, 'all'])
        ->name('inventory.companies.all');

    Route::apiResource('companies', CompanyController::class)
        ->names('inventory.companies');

    Route::get('locations/all', [LocationController::class, 'all'])
        ->name('inventory.locations.all');

    Route::apiResource('locations', LocationController::class)
        ->names('inventory.locations');

    Route::get('categories/all', [CategoryController::class, 'all'])
        ->name('inventory.categories.all');

    Route::apiResource('categories', CategoryController::class)
        ->names('inventory.categories');

    Route::get('attribute-types/all', [AttributeTypeController::class, 'all'])
        ->name('inventory.attribute-types.all');

    Route::apiResource('attribute-types', AttributeTypeController::class)
        ->names('inventory.attribute-types');

    Route::get('attributes/all', [AttributeController::class, 'all'])
        ->name('inventory.attributes.all');

    Route::apiResource('attributes', AttributeController::class)
        ->names('inventory.attributes');

    Route::get('customer-masters/all', [CustomerController::class, 'all'])
        ->name('inventory.customer-masters.all');

    Route::get('customer-masters/check-code', [CustomerController::class, 'checkCode'])
        ->name('inventory.customer-masters.check-code');

    Route::apiResource('customer-masters', CustomerController::class)
        ->names('inventory.customer-masters');

    Route::post('customer-masters/{customer_master}/attachments', [CustomerAttachmentController::class, 'store'])
        ->name('inventory.customer-masters.attachments.store');

    Route::delete('customer-masters/{customer_master}/attachments/{attachment}', [CustomerAttachmentController::class, 'destroy'])
        ->name('inventory.customer-masters.attachments.destroy');

    Route::get('store-types/all', [StoreTypeController::class, 'all'])
        ->name('inventory.store-types.all');

    Route::apiResource('store-types', StoreTypeController::class)
        ->names('inventory.store-types');

    Route::get('stores/all', [StoreController::class, 'all'])
        ->name('inventory.stores.all');

    Route::apiResource('stores', StoreController::class)
        ->names('inventory.stores');

    Route::get('drivers/all', [DriverController::class, 'all'])
        ->name('inventory.drivers.all');

    Route::apiResource('drivers', DriverController::class)
        ->names('inventory.drivers');

    Route::get('vehicle-masters/all', [VehicleController::class, 'all'])
        ->name('inventory.vehicle-masters.all');

    Route::apiResource('vehicle-masters', VehicleController::class)
        ->names('inventory.vehicle-masters');
});
