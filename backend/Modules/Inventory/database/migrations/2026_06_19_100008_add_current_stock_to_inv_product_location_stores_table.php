<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Add a denormalized current_stock column to the product-location-store pivot.
     * This is updated atomically whenever a stock transaction is posted,
     * avoiding a full ledger re-scan on every "stock in hand" read.
     */
    public function up(): void
    {
        Schema::table('inv_product_location_stores', function (Blueprint $table): void {
            $table->decimal('current_stock', 15, 4)->default(0)->after('store_id');
        });
    }

    public function down(): void
    {
        Schema::table('inv_product_location_stores', function (Blueprint $table): void {
            $table->dropColumn('current_stock');
        });
    }
};
