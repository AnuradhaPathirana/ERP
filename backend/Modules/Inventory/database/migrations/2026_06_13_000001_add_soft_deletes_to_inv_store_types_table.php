<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inv_store_types', function (Blueprint $table): void {
            // The original migration used 'note' — migrate data to 'description' then drop
            $table->text('description')->nullable()->after('store_type_name');
            $table->boolean('is_active')->default(true)->after('description');
            $table->softDeletes()->after('is_active');
        });

        // Copy any existing note data into description
        DB::statement('UPDATE inv_store_types SET description = note WHERE note IS NOT NULL');

        Schema::table('inv_store_types', function (Blueprint $table): void {
            $table->dropColumn('note');
        });
    }

    public function down(): void
    {
        Schema::table('inv_store_types', function (Blueprint $table): void {
            $table->string('note', 255)->nullable()->after('store_type_name');
        });

        DB::statement('UPDATE inv_store_types SET note = description WHERE description IS NOT NULL');

        Schema::table('inv_store_types', function (Blueprint $table): void {
            $table->dropColumn(['description', 'is_active', 'deleted_at']);
        });
    }
};
