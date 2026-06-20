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
            $table->unsignedBigInteger('batch_id')->nullable()->after('batch_no');
            $table->index('batch_id');
        });
    }

    public function down(): void
    {
        Schema::table('inv_stock_transactions', function (Blueprint $table): void {
            $table->dropIndex(['batch_id']);
            $table->dropColumn('batch_id');
        });
    }
};
