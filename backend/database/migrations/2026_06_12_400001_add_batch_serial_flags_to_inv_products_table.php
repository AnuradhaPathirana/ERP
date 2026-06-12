<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inv_products', function (Blueprint $table): void {
            $table->boolean('is_batch')->default(false)->after('loyalty');
            $table->boolean('is_serial')->default(false)->after('is_batch');
        });
    }

    public function down(): void
    {
        Schema::table('inv_products', function (Blueprint $table): void {
            $table->dropColumn(['is_batch', 'is_serial']);
        });
    }
};
