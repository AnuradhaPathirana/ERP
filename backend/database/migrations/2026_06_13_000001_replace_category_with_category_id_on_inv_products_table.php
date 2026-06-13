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
            $table->dropColumn('category');

            $table->unsignedBigInteger('category_id')->nullable()->after('description');
            $table->foreign('category_id')
                ->references('id')
                ->on('inv_categories')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('inv_products', function (Blueprint $table): void {
            $table->dropForeign(['category_id']);
            $table->dropColumn('category_id');

            $table->string('category', 100)->nullable()->after('description');
        });
    }
};
