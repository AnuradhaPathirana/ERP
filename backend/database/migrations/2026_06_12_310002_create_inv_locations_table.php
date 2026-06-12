<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inv_locations', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('parent_location_id')->nullable();
            $table->string('location_type', 50)->nullable();
            $table->string('location_code', 50)->nullable()->unique();
            $table->string('location_name', 100);
            $table->string('country', 50)->nullable();
            $table->string('base_currency', 10)->nullable();
            $table->foreignId('company_id')
                ->constrained('inv_companies')
                ->restrictOnDelete();
            $table->timestamps();

            $table->foreign('parent_location_id')
                ->references('id')
                ->on('inv_locations')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inv_locations');
    }
};
