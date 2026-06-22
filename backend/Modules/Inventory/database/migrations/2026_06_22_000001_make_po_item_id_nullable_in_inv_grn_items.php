<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inv_goods_received_note_items', function (Blueprint $table): void {
            $table->unsignedBigInteger('po_item_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('inv_goods_received_note_items', function (Blueprint $table): void {
            $table->unsignedBigInteger('po_item_id')->nullable(false)->change();
        });
    }
};
