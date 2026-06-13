<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inv_stores', function (Blueprint $table): void {
            // ── 1. Drop hard FK constraints (violates architecture golden rule) ──
            $table->dropForeign('inv_stores_store_type_id_foreign');
            $table->dropForeign('inv_stores_parent_store_id_foreign');
            $table->dropIndex('inv_stores_parent_store_id_foreign');
            $table->dropIndex('inv_stores_store_type_id_foreign');
        });

        Schema::table('inv_stores', function (Blueprint $table): void {
            // ── 2. Add store_code (unique identity) ───────────────────────
            $table->string('store_code', 50)->unique()->after('id');

            // ── 3. Add location_id soft link ──────────────────────────────
            $table->unsignedBigInteger('location_id')->nullable()->after('store_type_id');

            // ── 4. Extend store_name to 150 chars ─────────────────────────
            $table->string('store_name', 150)->change();

            // ── 5. Fix capacity type varchar → decimal ────────────────────
            $table->decimal('capacity', 15, 4)->nullable()->change();

            // ── 6. Add address fields ─────────────────────────────────────
            $table->string('address_line_1', 150)->nullable()->after('location_id');
            $table->string('address_line_2', 150)->nullable()->after('address_line_1');
            $table->string('city', 100)->nullable()->after('address_line_2');
            $table->string('state', 100)->nullable()->after('city');
            $table->string('country', 100)->nullable()->after('state');
            $table->string('postal_code', 20)->nullable()->after('country');

            // ── 7. Add contact fields ─────────────────────────────────────
            $table->renameColumn('store_contact_person', 'manager_name');
            $table->renameColumn('mobile', 'phone');
            $table->string('email', 100)->nullable()->after('phone');

            // ── 8. Add description, status, soft deletes ──────────────────
            $table->text('description')->nullable()->after('email');
            $table->boolean('is_active')->default(true)->after('description');
            $table->softDeletes()->after('is_active');
        });
    }

    public function down(): void
    {
        Schema::table('inv_stores', function (Blueprint $table): void {
            $table->dropSoftDeletes();
            $table->dropColumn(['is_active', 'description', 'email', 'postal_code', 'country', 'state', 'city', 'address_line_2', 'address_line_1', 'location_id', 'store_code']);
            $table->renameColumn('manager_name', 'store_contact_person');
            $table->renameColumn('phone', 'mobile');
            $table->string('capacity', 50)->nullable()->change();
            $table->string('store_name', 100)->change();
        });

        Schema::table('inv_stores', function (Blueprint $table): void {
            $table->foreign('store_type_id')->references('id')->on('inv_store_types');
            $table->foreign('parent_store_id')->references('id')->on('inv_stores')->nullOnDelete();
        });
    }
};
