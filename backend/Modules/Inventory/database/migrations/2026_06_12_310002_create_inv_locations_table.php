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

            // Soft references — no hard FK constraints across module boundaries
            $table->unsignedBigInteger('company_id');           // required — inv_companies.id (soft link)
            $table->unsignedBigInteger('industry_id');          // required — inv_industries.id (soft link)
            $table->unsignedBigInteger('parent_location_id')->nullable(); // self-referential soft link

            // ── Basic Details ─────────────────────────────────────────────
            $table->string('location_code', 50)->unique();      // required
            $table->string('location_name', 100);               // required
            $table->string('location_type', 50)->nullable();    // e.g. Company Type
            $table->string('country', 100);                     // required — top-level country

            // ── Location Address ──────────────────────────────────────────
            $table->string('loc_street_address', 150);          // required
            $table->string('loc_city', 50);                     // required
            $table->string('loc_country', 100);                 // required
            $table->string('loc_state', 50);                    // required
            $table->string('loc_postal_zip_code', 20);          // required

            // ── Billing Address ───────────────────────────────────────────
            $table->boolean('billing_same_as_location')->default(false);
            $table->string('bill_street_address', 150)->nullable();
            $table->string('bill_city', 50)->nullable();        // required when not same
            $table->string('bill_country', 100)->nullable();    // required when not same
            $table->string('bill_state', 50)->nullable();
            $table->string('bill_postal_zip_code', 20)->nullable(); // required when not same

            // ── Contact Info ──────────────────────────────────────────────
            $table->string('company_email', 100)->nullable();
            $table->string('customer_facing_email', 100)->nullable();
            $table->string('company_phone', 30)->nullable();
            $table->string('mobile', 30)->nullable();
            $table->string('fax', 30)->nullable();
            $table->string('website', 255)->nullable();
            $table->decimal('longitude', 11, 8)->nullable();
            $table->decimal('latitude', 10, 8)->nullable();
            $table->string('map_url', 500)->nullable();

            // ── Advanced Settings ─────────────────────────────────────────
            $table->string('date_format', 30)->nullable()->default('M d, Y');
            $table->string('number_format', 30)->nullable()->default('#,###.##');
            $table->string('time_format', 30)->nullable()->default('H:i:s');
            $table->unsignedTinyInteger('float_precision')->nullable()->default(3);
            $table->string('base_currency', 10)->default('USD'); // required
            $table->string('time_zone', 100)->nullable();
            $table->string('financial_year', 50);               // required
            $table->time('open_hours_from')->nullable();
            $table->time('open_hours_to')->nullable();

            // ── Module & Inventory Settings ───────────────────────────────
            $table->json('available_modules')->nullable();       // ['HRM','Account','CRM','Inventory']
            $table->enum('stock_releasing_method', ['LIFO', 'FIFO', 'AVG']); // required

            // ── Media / Branding ──────────────────────────────────────────
            $table->string('logo_path', 500)->nullable();
            $table->string('header_path', 500)->nullable();
            $table->string('footer_path', 500)->nullable();

            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inv_locations');
    }
};
