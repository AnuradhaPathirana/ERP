<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// NOTE: This file documents the original stub schema.
// The full production schema is applied by 2026_06_13_310004_recreate_inv_vehicle_masters_table.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inv_vehicle_masters', function (Blueprint $table): void {
            $table->id();
            $table->string('vehicle_reg_no', 50)->unique();
            $table->string('note', 255)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inv_vehicle_masters');
    }
};
