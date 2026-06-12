<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inv_locations', function (Blueprint $table): void {
            // ── Soft-reference columns ─────────────────────────────────────
            $table->unsignedBigInteger('industry_id')->after('company_id');

            // ── Location Address ──────────────────────────────────────────
            $table->string('loc_street_address', 150)->after('country');
            $table->string('loc_city', 50)->after('loc_street_address');
            $table->string('loc_country', 100)->after('loc_city');
            $table->string('loc_state', 50)->after('loc_country');
            $table->string('loc_postal_zip_code', 20)->after('loc_state');

            // ── Billing Address ───────────────────────────────────────────
            $table->boolean('billing_same_as_location')->default(false)->after('loc_postal_zip_code');
            $table->string('bill_street_address', 150)->nullable()->after('billing_same_as_location');
            $table->string('bill_city', 50)->nullable()->after('bill_street_address');
            $table->string('bill_country', 100)->nullable()->after('bill_city');
            $table->string('bill_state', 50)->nullable()->after('bill_country');
            $table->string('bill_postal_zip_code', 20)->nullable()->after('bill_state');

            // ── Contact Info ──────────────────────────────────────────────
            $table->string('company_email', 100)->nullable()->after('bill_postal_zip_code');
            $table->string('customer_facing_email', 100)->nullable()->after('company_email');
            $table->string('company_phone', 30)->nullable()->after('customer_facing_email');
            $table->string('mobile', 30)->nullable()->after('company_phone');
            $table->string('fax', 30)->nullable()->after('mobile');
            $table->string('website', 255)->nullable()->after('fax');
            $table->decimal('longitude', 11, 8)->nullable()->after('website');
            $table->decimal('latitude', 10, 8)->nullable()->after('longitude');
            $table->string('map_url', 500)->nullable()->after('latitude');

            // ── Advanced Settings ─────────────────────────────────────────
            $table->string('date_format', 30)->nullable()->default('M d, Y')->after('map_url');
            $table->string('number_format', 30)->nullable()->default('#,###.##')->after('date_format');
            $table->string('time_format', 30)->nullable()->default('H:i:s')->after('number_format');
            $table->unsignedTinyInteger('float_precision')->nullable()->default(3)->after('time_format');
            // base_currency already exists in the original table
            $table->string('time_zone', 100)->nullable()->after('base_currency');
            $table->string('financial_year', 50)->after('time_zone');
            $table->string('open_hours_from', 5)->nullable()->after('financial_year');
            $table->string('open_hours_to', 5)->nullable()->after('open_hours_from');

            // ── Module & Inventory ────────────────────────────────────────
            $table->json('available_modules')->nullable()->after('open_hours_to');
            $table->enum('stock_releasing_method', ['LIFO', 'FIFO', 'AVG'])->after('available_modules');

            // ── Branding / Media ──────────────────────────────────────────
            $table->string('logo_path', 500)->nullable()->after('stock_releasing_method');
            $table->string('header_path', 500)->nullable()->after('logo_path');
            $table->string('footer_path', 500)->nullable()->after('header_path');

            // ── Soft deletes ──────────────────────────────────────────────
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::table('inv_locations', function (Blueprint $table): void {
            $table->dropColumn([
                'industry_id',
                'loc_street_address', 'loc_city', 'loc_country', 'loc_state', 'loc_postal_zip_code',
                'billing_same_as_location',
                'bill_street_address', 'bill_city', 'bill_country', 'bill_state', 'bill_postal_zip_code',
                'company_email', 'customer_facing_email', 'company_phone', 'mobile', 'fax',
                'website', 'longitude', 'latitude', 'map_url',
                'date_format', 'number_format', 'time_format', 'float_precision',
                'time_zone', 'financial_year', 'open_hours_from', 'open_hours_to',
                'available_modules', 'stock_releasing_method',
                'logo_path', 'header_path', 'footer_path',
                'deleted_at',
            ]);
        });
    }
};
