<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Backfill any existing rows that have no reference_no before enforcing uniqueness
        $prefix = 'Ref-';
        DB::table('inv_purchase_requests')
            ->whereNull('reference_no')
            ->orderBy('id')
            ->each(function (object $row) use ($prefix): void {
                $last = DB::table('inv_purchase_requests')
                    ->where('reference_no', 'like', $prefix . '%')
                    ->orderByDesc('id')
                    ->value('reference_no');

                $next = $last ? (int) substr($last, strlen($prefix)) + 1 : 1;
                $refNo = $prefix . str_pad((string) $next, 4, '0', STR_PAD_LEFT);

                DB::table('inv_purchase_requests')
                    ->where('id', $row->id)
                    ->update(['reference_no' => $refNo]);
            });

        Schema::table('inv_purchase_requests', function (Blueprint $table): void {
            $table->string('reference_no', 50)->nullable(false)->unique()->change();
        });
    }

    public function down(): void
    {
        Schema::table('inv_purchase_requests', function (Blueprint $table): void {
            $table->dropUnique(['reference_no']);
            $table->string('reference_no', 50)->nullable()->change();
        });
    }
};
