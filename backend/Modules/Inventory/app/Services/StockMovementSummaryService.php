<?php

declare(strict_types=1);

namespace Modules\Inventory\Services;

use Carbon\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Modules\Inventory\Models\Location;
use Modules\Inventory\Models\StockReferenceType;

class StockMovementSummaryService
{
    /**
     * Hard ceiling on product rows returned in one report — protects the JSON payload
     * and DomPDF rendering. Hit only when the catalogue is huge and unfiltered.
     */
    private const MAX_ROWS = 5000;

    /**
     * Build the full movement summary dataset (header block, per-product rows with
     * opening / purchase / sales / closing qty+value, grand totals). Shared by the
     * JSON, PDF and CSV endpoints so the aggregation logic exists exactly once.
     *
     * Closing = opening + ALL period movement (qty_in - qty_out across every
     * reference type), so it always reconciles with the Bin Card even when future
     * ledger writers (adjustments, transfers, returns) come online. Purchase and
     * Sales stay type-specific breakouts.
     *
     * @param array{date_from?:string|null, date_to?:string|null, location_id?:int|null, store_id?:int|null, category_id?:int|null} $filters
     * @return array<string, mixed>
     */
    public function build(array $filters): array
    {
        $locationId = !empty($filters['location_id']) ? (int) $filters['location_id'] : null;
        $storeId    = !empty($filters['store_id']) ? (int) $filters['store_id'] : null;
        $categoryId = !empty($filters['category_id']) ? (int) $filters['category_id'] : null;
        $dateFrom   = $filters['date_from'] ?? null;
        $dateTo     = $filters['date_to'] ?? null;

        // Sargable datetime bounds (never DATE(col)): [fromStart, toExclusive)
        $fromStart   = $dateFrom ? Carbon::parse($dateFrom)->startOfDay()->toDateTimeString() : null;
        $toExclusive = $dateTo ? Carbon::parse($dateTo)->addDay()->startOfDay()->toDateTimeString() : null;

        [$periodSql, $periodBindings] = $this->periodCondition($fromStart, $toExclusive);

        $openingSql      = $fromStart ? 'SUM(CASE WHEN st.transaction_date < ? THEN st.qty_in - st.qty_out ELSE 0 END)' : 'SUM(0)';
        $openingBindings = $fromStart ? [$fromStart] : [];

        $aggregates = DB::table('inv_stock_transactions as st')
            ->join('inv_products as p', 'p.id', '=', 'st.product_id')
            ->leftJoin('inv_categories as c', 'c.id', '=', 'p.category_id')
            ->selectRaw(
                "st.product_id,
                 p.product_code,
                 p.name as product_name,
                 c.category_name,
                 {$openingSql} as opening_qty,
                 SUM(CASE WHEN {$periodSql} AND st.reference_type = ? THEN st.qty_in ELSE 0 END) as purchase_qty,
                 SUM(CASE WHEN {$periodSql} AND st.reference_type = ? THEN st.qty_out ELSE 0 END) as sales_qty,
                 SUM(CASE WHEN {$periodSql} THEN st.qty_in - st.qty_out ELSE 0 END) as period_net",
                [
                    ...$openingBindings,
                    ...$periodBindings, StockReferenceType::CODE_GRN,
                    ...$periodBindings, StockReferenceType::CODE_INVOICE,
                    ...$periodBindings,
                ]
            )
            ->when($locationId, fn ($q) => $q->where('st.location_id', $locationId))
            ->when($storeId, fn ($q) => $q->where('st.store_id', $storeId))
            ->when($categoryId, fn ($q) => $q->where('p.category_id', $categoryId))
            ->when($toExclusive, fn ($q) => $q->where('st.transaction_date', '<', $toExclusive))
            ->groupBy('st.product_id', 'p.product_code', 'p.name', 'c.category_name')
            ->havingRaw('opening_qty <> 0 OR purchase_qty <> 0 OR sales_qty <> 0 OR period_net <> 0')
            ->orderBy('p.name')
            ->limit(self::MAX_ROWS + 1)
            ->get();

        if ($aggregates->count() > self::MAX_ROWS) {
            abort(422, 'The selected filters return too many products — narrow the filters.');
        }

        $costs = $this->latestGrnCosts($aggregates->pluck('product_id')->all());

        $rows    = [];
        $summary = array_fill_keys([
            'opening_qty', 'opening_value', 'purchase_qty', 'purchase_value',
            'sales_qty', 'sales_value', 'closing_qty', 'closing_value',
        ], 0.0);

        foreach ($aggregates as $agg) {
            $cost       = $costs[$agg->product_id] ?? null;
            $price      = (float) ($cost->unit_price ?? 0);
            $openingQty = (float) $agg->opening_qty;
            $closingQty = $openingQty + (float) $agg->period_net;

            $row = [
                'product_id'     => $agg->product_id,
                'product_code'   => $agg->product_code,
                'product_name'   => $agg->product_name,
                'category_name'  => $agg->category_name,
                'unit'           => $cost->unit_name ?? $cost->unit_symbol ?? null,
                'price'          => $price,
                'opening_qty'    => $openingQty,
                'opening_value'  => $openingQty * $price,
                'purchase_qty'   => (float) $agg->purchase_qty,
                'purchase_value' => (float) $agg->purchase_qty * $price,
                'sales_qty'      => (float) $agg->sales_qty,
                'sales_value'    => (float) $agg->sales_qty * $price,
                'closing_qty'    => $closingQty,
                'closing_value'  => $closingQty * $price,
            ];

            foreach ($summary as $key => $total) {
                $summary[$key] = $total + $row[$key];
            }

            $rows[] = $row;
        }

        return [
            'header'  => $this->buildHeader($locationId, $storeId, $categoryId, $dateFrom, $dateTo, $summary),
            'rows'    => $rows,
            'summary' => $summary,
        ];
    }

    /**
     * SQL fragment (and bindings) deciding whether a ledger row falls inside the
     * report period. With no dates at all, every row counts as period movement.
     *
     * @return array{0: string, 1: list<string>}
     */
    private function periodCondition(?string $fromStart, ?string $toExclusive): array
    {
        $parts    = [];
        $bindings = [];

        if ($fromStart) {
            $parts[]    = 'st.transaction_date >= ?';
            $bindings[] = $fromStart;
        }

        if ($toExclusive) {
            $parts[]    = 'st.transaction_date < ?';
            $bindings[] = $toExclusive;
        }

        return [$parts ? implode(' AND ', $parts) : '1 = 1', $bindings];
    }

    /**
     * Latest GRN receipt price + unit per product — one batched query, never per row.
     * Products never received fall back to price 0 and no unit.
     *
     * @param list<int> $productIds
     * @return array<int, object>
     */
    private function latestGrnCosts(array $productIds): array
    {
        if ($productIds === []) {
            return [];
        }

        $latestReceipt = DB::table('inv_stock_transactions')
            ->selectRaw('product_id, MAX(id) as max_id')
            ->where('reference_type', StockReferenceType::CODE_GRN)
            ->where('qty_in', '>', 0)
            ->whereIn('product_id', $productIds)
            ->groupBy('product_id');

        return DB::table('inv_stock_transactions as st')
            ->joinSub($latestReceipt, 'latest', 'latest.max_id', '=', 'st.id')
            ->leftJoin('inv_unit_types as u', 'u.id', '=', 'st.unit_id')
            ->get(['st.product_id', 'st.unit_price', 'u.name as unit_name', 'u.symbol as unit_symbol'])
            ->keyBy('product_id')
            ->all();
    }

    /**
     * @param array<string, float> $summary
     * @return array<string, mixed>
     */
    private function buildHeader(?int $locationId, ?int $storeId, ?int $categoryId, ?string $dateFrom, ?string $dateTo, array $summary): array
    {
        $location = $locationId ? Location::with('company')->find($locationId) : null;
        $store    = $storeId ? DB::table('inv_stores')->where('id', $storeId)->first(['store_name']) : null;
        $category = $categoryId ? DB::table('inv_categories')->where('id', $categoryId)->first(['category_name']) : null;

        // Single-tenant deployment: without a location filter, fall back to the primary company.
        $company = $location?->company
            ?? DB::table('inv_companies')->orderBy('id')->first();

        return [
            'company_name'    => $company->company_name ?? null,
            'company_address' => $company
                ? collect([$company->street_address, $company->city, $company->state, $company->postal_zip_code])->filter()->implode(', ')
                : null,
            'company_email'   => $company->company_email ?? null,
            'location_name'   => $location?->location_name,
            'store_name'      => $store->store_name ?? null,
            'category_name'   => $category->category_name ?? null,
            'opening_qty'     => $summary['opening_qty'],
            'opening_value'   => $summary['opening_value'],
            'closing_qty'     => $summary['closing_qty'],
            'closing_value'   => $summary['closing_value'],
            'date_from'       => $dateFrom,
            'date_to'         => $dateTo,
            'generated_by'    => Auth::user()?->name,
            'generated_at'    => now()->toDateTimeString(),
        ];
    }
}
