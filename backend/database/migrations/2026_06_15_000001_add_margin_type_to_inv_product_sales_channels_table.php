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
            $table->enum('margin_type', ['percentage', 'amount'])
                  ->default('percentage')
                  ->after('margin');
        });
    }

    public function down(): void
    {
        Schema::table('inv_product_sales_channels', function (Blueprint $table): void {
            $table->dropColumn('margin_type');
        });
    }
};
