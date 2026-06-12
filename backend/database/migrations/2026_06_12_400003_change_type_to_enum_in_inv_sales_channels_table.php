<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Nullify any existing values that don't match the new enum
        DB::table('inv_sales_channels')
            ->whereNotIn('type', ['Wholesale', 'e-commerce', 'Retail'])
            ->update(['type' => null]);

        Schema::table('inv_sales_channels', function (Blueprint $table): void {
            $table->enum('type', ['Wholesale', 'e-commerce', 'Retail'])->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('inv_sales_channels', function (Blueprint $table): void {
            $table->string('type', 50)->nullable()->change();
        });
    }
};
