<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inv_purchase_orders', function (Blueprint $table): void {
            $table->unsignedBigInteger('location_id')->nullable()->after('store_id');
            $table->index('location_id');
        });
    }

    public function down(): void
    {
        Schema::table('inv_purchase_orders', function (Blueprint $table): void {
            $table->dropIndex(['location_id']);
            $table->dropColumn('location_id');
        });
    }
};
