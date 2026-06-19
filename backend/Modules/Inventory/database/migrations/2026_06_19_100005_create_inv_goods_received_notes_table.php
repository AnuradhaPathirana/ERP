<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inv_goods_received_notes', function (Blueprint $table): void {
            $table->id();

            // Auto-generated document number (e.g. GRN-2026-0001)
            $table->string('grn_no', 30)->unique();

            // Linked PO — soft link
            $table->unsignedBigInteger('po_id');

            // Supplier (denormalized from PO for reporting speed) — soft link
            $table->unsignedBigInteger('supplier_id');

            // Receiving dates
            $table->date('grn_date');

            // Destination store & location where stock lands — user-selected on GRN form
            $table->unsignedBigInteger('store_id');
            $table->unsignedBigInteger('location_id')->nullable();

            // Workflow status
            $table->string('status', 20)->default('draft');
            // Values: draft | confirmed

            // Financial total
            $table->decimal('total_amount', 15, 4)->default(0);

            // Notes
            $table->text('remarks')->nullable();

            // Audit — soft link to users
            $table->unsignedBigInteger('received_by')->nullable();
            $table->timestamp('confirmed_at')->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->index('po_id');
            $table->index('supplier_id');
            $table->index('store_id');
            $table->index('status');
            $table->index('grn_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inv_goods_received_notes');
    }
};
