<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inv_stock_transactions', function (Blueprint $table): void {
            $table->unsignedBigInteger('store_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('inv_stock_transactions', function (Blueprint $table): void {
            $table->unsignedBigInteger('store_id')->nullable(false)->change();
        });
    }
};
