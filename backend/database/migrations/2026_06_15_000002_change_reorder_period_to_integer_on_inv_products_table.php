<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Clear any legacy string values before changing column type
        DB::statement("UPDATE inv_products SET reorder_period = NULL WHERE reorder_period REGEXP '[^0-9]'");
        DB::statement('ALTER TABLE inv_products MODIFY reorder_period SMALLINT UNSIGNED NULL DEFAULT NULL');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE inv_products MODIFY reorder_period VARCHAR(50) NULL DEFAULT NULL');
    }
};
