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
            // Drop the nullOnDelete FK so we can make the column NOT NULL
            $table->dropForeign(['category_id']);

            // Make the column required
            $table->unsignedBigInteger('category_id')->nullable(false)->change();

            // Re-add FK with restrictOnDelete — cannot delete a category that has products
            $table->foreign('category_id')
                ->references('id')
                ->on('inv_categories')
                ->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('inv_products', function (Blueprint $table): void {
            $table->dropForeign(['category_id']);
            $table->unsignedBigInteger('category_id')->nullable()->change();
            $table->foreign('category_id')
                ->references('id')
                ->on('inv_categories')
                ->nullOnDelete();
        });
    }
};
