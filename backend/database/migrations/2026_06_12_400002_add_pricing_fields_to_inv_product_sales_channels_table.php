<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inv_product_sales_channels', function (Blueprint $table): void {
            $table->decimal('max_price', 15, 4)->nullable()->after('selling_price');
            $table->decimal('min_price', 15, 4)->nullable()->after('max_price');
            $table->decimal('wholesale_price', 15, 4)->nullable()->after('min_price');
            $table->decimal('purchasing_privileges_discount', 5, 2)->nullable()->after('sale_privileges_discount');
        });
    }

    public function down(): void
    {
        Schema::table('inv_product_sales_channels', function (Blueprint $table): void {
            $table->dropColumn([
                'max_price',
                'min_price',
                'wholesale_price',
                'purchasing_privileges_discount',
            ]);
        });
    }
};
