<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inv_stores', function (Blueprint $table): void {
            $table->id();
            $table->string('store_name', 100);
            $table->unsignedBigInteger('parent_store_id')->nullable();
            $table->string('uom', 50)->nullable();
            $table->string('capacity', 50)->nullable();
            $table->string('store_contact_person', 100)->nullable();
            $table->string('mobile', 20)->nullable();
            $table->foreignId('store_type_id')
                ->constrained('inv_store_types')
                ->restrictOnDelete();
            $table->timestamps();

            $table->foreign('parent_store_id')
                ->references('id')
                ->on('inv_stores')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inv_stores');
    }
};
