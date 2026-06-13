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

            // Soft references — no hard FK constraints across module boundaries
            $table->unsignedBigInteger('store_type_id');                    // required — inv_store_types.id (soft link)
            $table->unsignedBigInteger('location_id')->nullable();          // optional — inv_locations.id (soft link)

            // ── Identity ──────────────────────────────────────────────────
            $table->string('store_code', 50)->unique();                     // required
            $table->string('store_name', 150);                              // required

            // ── Capacity ──────────────────────────────────────────────────
            $table->string('uom', 50);                                      // required — unit of measure for capacity
            $table->decimal('capacity', 15, 4);                             // required

            // ── Address ───────────────────────────────────────────────────
            $table->string('address_line_1', 150)->nullable();
            $table->string('address_line_2', 150)->nullable();
            $table->string('city', 100)->nullable();
            $table->string('state', 100)->nullable();
            $table->string('country', 100)->nullable();
            $table->string('postal_code', 20)->nullable();

            // ── Contact ───────────────────────────────────────────────────
            $table->string('manager_name', 100)->nullable();
            $table->string('phone', 30)->nullable();
            $table->string('email', 100)->nullable();

            // ── Misc ──────────────────────────────────────────────────────
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);

            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inv_stores');
    }
};
