<?php

declare(strict_types=1);

namespace Modules\Inventory\Services;

use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Modules\Inventory\Models\Location;
use Modules\Inventory\Models\ProductLocationStore;
use Modules\Inventory\Models\StockReferenceType;

class BinCardService
{
    /**
     * Hard ceiling on ledger rows returned in one report — protects the JSON payload
     * and DomPDF rendering. A bin card is always scoped to a single product, so this
     * is only ever hit by pathological date ranges.
     */
    private const MAX_ROWS = 5000;

    /**
     * Where each reference type's human document number lives. Extend with one line
     * when a new stock ledger writer (invoice, transfer, …) is developed.
     * Types absent here fall back to the raw reference_id.
     */
    private const DOC_NO_SOURCES = [
        StockReferenceType::CODE_GRN            => ['table' => 'inv_goods_received_notes', 'column' => 'grn_no'],
        StockReferenceType::CODE_SALES_DELIVERY => ['table' => 'inv_delivery_orders',      'column' => 'do_no'],
    ];

    /**
     * Build the full bin card dataset (header block, opening balance, chronological
     * ledger rows with running balance, totals). Shared by the JSON, PDF and CSV
     * endpoints so the balance logic exists exactly once.
     *
     * @param array{product_id:int, location_id?:int|null, store_id?:int|null, date_from?:string|null, date_to?:string|null} $filters
     * @return array<string, mixed>
     */
    public function build(array $filters): array
    {
        $productId  = (int) $filters['product_id'];
        $locationId = !empty($filters['location_id']) ? (int) $filters['location_id'] : null;
        $storeId    = !empty($filters['store_id']) ? (int) $filters['store_id'] : null;
        $dateFrom   = $filters['date_from'] ?? null;
        $dateTo     = $filters['date_to'] ?? null;

        $openingBalance = $dateFrom ? $this->openingBalance($productId, $locationId, $storeId, $dateFrom) : 0.0;

        $query = DB::table('inv_stock_transactions')
            ->where('product_id', $productId)
            ->when($locationId, fn ($q) => $q->where('location_id', $locationId))
            ->when($storeId, fn ($q) => $q->where('store_id', $storeId))
            ->when($dateFrom, fn ($q) => $q->whereDate('transaction_date', '>=', $dateFrom))
            ->when($dateTo, fn ($q) => $q->whereDate('transaction_date', '<=', $dateTo));

        if ((clone $query)->count() > self::MAX_ROWS) {
            abort(422, 'The selected filters return too many transactions — narrow the date range.');
        }

        $transactions = $query
            ->orderBy('transaction_date')
            ->orderBy('id')
            ->get(['id', 'transaction_date', 'reference_type', 'reference_id', 'batch_no', 'qty_in', 'qty_out']);

        $labels     = DB::table('inv_stock_reference_types')->pluck('label', 'code');
        $docNumbers = $this->resolveDocumentNumbers($transactions);

        $rows     = [];
        $balance  = $openingBalance;
        $totalIn  = 0.0;
        $totalOut = 0.0;

        foreach ($transactions as $t) {
            $qtyIn  = (float) $t->qty_in;
            $qtyOut = (float) $t->qty_out;

            $balance  += $qtyIn - $qtyOut;
            $totalIn  += $qtyIn;
            $totalOut += $qtyOut;

            $rows[] = [
                'id'          => $t->id,
                'date'        => Str::substr((string) $t->transaction_date, 0, 10),
                'description' => $labels[$t->reference_type] ?? Str::headline($t->reference_type),
                'document_no' => $docNumbers[$t->reference_type][$t->reference_id] ?? (string) $t->reference_id,
                'batch_no'    => $t->batch_no,
                'qty_in'      => $qtyIn,
                'qty_out'     => $qtyOut,
                'balance'     => $balance,
            ];
        }

        return [
            'header'  => $this->buildHeader($productId, $locationId, $storeId, $dateFrom, $dateTo),
            'opening' => [
                'show'    => (bool) $dateFrom,
                'balance' => $openingBalance,
            ],
            'rows'    => $rows,
            'summary' => [
                'total_in'        => $totalIn,
                'total_out'       => $totalOut,
                'closing_balance' => $balance,
            ],
        ];
    }

    /** Balance brought forward: every movement strictly before the report period. */
    private function openingBalance(int $productId, ?int $locationId, ?int $storeId, string $dateFrom): float
    {
        return (float) DB::table('inv_stock_transactions')
            ->where('product_id', $productId)
            ->when($locationId, fn ($q) => $q->where('location_id', $locationId))
            ->when($storeId, fn ($q) => $q->where('store_id', $storeId))
            ->whereDate('transaction_date', '<', $dateFrom)
            ->selectRaw('COALESCE(SUM(qty_in - qty_out), 0) as bal')
            ->value('bal');
    }

    /**
     * Batched per-type document number lookup — one whereIn query per reference type
     * present in the result set, never per row.
     *
     * @param \Illuminate\Support\Collection<int, object> $transactions
     * @return array<string, \Illuminate\Support\Collection<int|string, string>>
     */
    private function resolveDocumentNumbers($transactions): array
    {
        $map = [];

        foreach ($transactions->groupBy('reference_type') as $type => $group) {
            $source = self::DOC_NO_SOURCES[$type] ?? null;
            if (!$source) {
                continue;
            }

            $map[$type] = DB::table($source['table'])
                ->whereIn('id', $group->pluck('reference_id')->unique()->all())
                ->pluck($source['column'], 'id');
        }

        return $map;
    }

    /** @return array<string, mixed> */
    private function buildHeader(int $productId, ?int $locationId, ?int $storeId, ?string $dateFrom, ?string $dateTo): array
    {
        $product = DB::table('inv_products')
            ->where('id', $productId)
            ->first(['id', 'product_code', 'name', 'reorder_level', 'reorder_qty', 'reorder_period']);

        // Stock in hand from the running balance cache, scoped like the ledger query.
        // This is current stock (as of now), not as of date_to.
        $stockInHand = (float) ProductLocationStore::where('product_id', $productId)
            ->when($locationId, fn ($q) => $q->where('location_id', $locationId))
            ->when($storeId, fn ($q) => $q->where('store_id', $storeId))
            ->sum('current_stock');

        $location = $locationId ? Location::with('company')->find($locationId) : null;
        $store    = $storeId ? DB::table('inv_stores')->where('id', $storeId)->first(['store_name']) : null;

        // Single-tenant deployment: without a location filter, fall back to the primary company.
        $company = $location?->company
            ?? DB::table('inv_companies')->orderBy('id')->first();

        return [
            'company_name'    => $company->company_name ?? null,
            'company_address' => $company
                ? collect([$company->street_address, $company->city, $company->state, $company->postal_zip_code])->filter()->implode(', ')
                : null,
            'company_email'   => $company->company_email ?? null,
            'product_code'    => $product->product_code ?? null,
            'product_name'    => $product->name ?? null,
            'location_name'   => $location?->location_name,
            'store_name'      => $store->store_name ?? null,
            'stock_in_hand'   => $stockInHand,
            'reorder_level'   => (float) ($product->reorder_level ?? 0),
            'reorder_qty'     => (float) ($product->reorder_qty ?? 0),
            'reorder_period'  => $product->reorder_period ?? null,
            'date_from'       => $dateFrom,
            'date_to'         => $dateTo,
            'generated_by'    => Auth::user()?->name,
            'generated_at'    => now()->toDateTimeString(),
        ];
    }
}
