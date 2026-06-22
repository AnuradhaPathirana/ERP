<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inv_purchase_requests', function (Blueprint $table): void {
            // Soft link to inv_customer_masters — nullable, no hard FK (architecture rule)
            $table->unsignedBigInteger('customer_id')->nullable()->after('target_store_id');
            $table->index('customer_id');
        });
    }

    public function down(): void
    {
        Schema::table('inv_purchase_requests', function (Blueprint $table): void {
            $table->dropIndex(['customer_id']);
            $table->dropColumn('customer_id');
        });
    }
};
