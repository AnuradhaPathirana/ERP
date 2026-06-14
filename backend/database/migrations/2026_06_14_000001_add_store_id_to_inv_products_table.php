<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// This migration is intentionally a no-op.
// store_id was removed from inv_products — location+store pairs
// are stored in inv_product_location_stores instead.
return new class extends Migration
{
    public function up(): void {}
    public function down(): void {}
};
