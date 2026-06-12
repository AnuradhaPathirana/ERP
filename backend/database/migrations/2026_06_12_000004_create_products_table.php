<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inv_products', function (Blueprint $table): void {
            $table->id();
            $table->string('product_code', 50)->nullable()->unique();
            $table->string('reference_no', 50)->nullable();
            $table->string('ean_13', 50)->nullable();
            $table->string('name', 100);
            $table->string('display_name', 100)->nullable();
            $table->string('product_type', 50)->nullable();
            $table->text('description')->nullable();
            $table->string('category', 100)->nullable();
            $table->string('location', 100)->nullable();
            $table->decimal('reorder_level', 15, 4)->nullable();
            $table->decimal('reorder_qty', 15, 4)->nullable();
            $table->string('reorder_period', 50)->nullable();
            $table->string('stock_releasing_method', 50)->nullable();
            $table->enum('tracking_type', ['Batch', 'Serial'])->nullable();
            $table->boolean('lock_purchase')->default(false);
            $table->boolean('allow_complimentary_items')->default(false);
            $table->boolean('free_issue')->default(false);
            $table->boolean('allow_minus')->default(false);
            $table->boolean('not_allow_direct_sale')->default(false);
            $table->boolean('non_returnable')->default(false);
            $table->boolean('is_empty')->default(false);
            $table->boolean('service_charge')->default(false);
            $table->boolean('loyalty')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inv_products');
    }
};
