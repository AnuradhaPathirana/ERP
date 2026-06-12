<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inv_vehicle_drivers', function (Blueprint $table): void {
            $table->foreignId('vehicle_master_id')
                ->constrained('inv_vehicle_masters')
                ->cascadeOnDelete();
            $table->foreignId('driver_id')
                ->constrained('inv_drivers')
                ->restrictOnDelete();
            $table->primary(['vehicle_master_id', 'driver_id']);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inv_vehicle_drivers');
    }
};
