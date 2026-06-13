<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inv_products', function (Blueprint $table): void {
            $table->dropColumn('location');

            $table->unsignedBigInteger('location_id')->nullable()->after('category_id');
            $table->foreign('location_id')
                ->references('id')
                ->on('inv_locations')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('inv_products', function (Blueprint $table): void {
            $table->dropForeign(['location_id']);
            $table->dropColumn('location_id');

            $table->string('location', 100)->nullable()->after('category_id');
        });
    }
};
