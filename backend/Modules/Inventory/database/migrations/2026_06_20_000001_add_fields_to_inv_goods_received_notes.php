<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inv_goods_received_notes', function (Blueprint $table): void {
            $table->date('transaction_date')->nullable()->after('grn_date');
            $table->string('reference_no', 100)->nullable()->after('grn_no');
            $table->string('payment_terms', 100)->nullable()->after('remarks');
            $table->json('attachments')->nullable()->after('payment_terms');
        });
    }

    public function down(): void
    {
        Schema::table('inv_goods_received_notes', function (Blueprint $table): void {
            $table->dropColumn(['transaction_date', 'reference_no', 'payment_terms', 'attachments']);
        });
    }
};
