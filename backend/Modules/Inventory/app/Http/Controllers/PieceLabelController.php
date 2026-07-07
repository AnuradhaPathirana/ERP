<?php

declare(strict_types=1);

namespace Modules\Inventory\Http\Controllers;

use Barryvdh\DomPDF\Facade\Pdf;
use Endroid\QrCode\QrCode;
use Endroid\QrCode\Writer\PngWriter;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Collection;
use Modules\Inventory\Enums\GrnStatus;
use Modules\Inventory\Models\GoodsReceivedNote;
use Modules\Inventory\Models\GrnItemPiece;

/**
 * Cross-GRN piece label lookup — filter sealed pieces by product / shipping
 * code / color and print their QR labels (see GrnPieceLabelPdfController for
 * the per-GRN variant).
 */
class PieceLabelController extends Controller
{
    private const MAX_LABELS = 500;

    public function __construct()
    {
        $this->middleware('permission:view_grns');
    }

    /** GET /piece-labels?product_id=&shipping_code=&attribute_id= — labels with QR data URIs */
    public function index(Request $request): JsonResponse
    {
        $filters = $this->validateFilters($request);

        $pieces = $this->pieceQuery($filters)->limit(self::MAX_LABELS + 1)->get();

        $truncated = $pieces->count() > self::MAX_LABELS;
        $labels    = $this->buildLabels($pieces->take(self::MAX_LABELS));

        return response()->json([
            'data' => [
                'labels'    => $labels,
                'truncated' => $truncated,
            ],
        ]);
    }

    /** GET /piece-labels/pdf — printable PDF for the same filters */
    public function pdf(Request $request)
    {
        $filters = $this->validateFilters($request);

        $pieces = $this->pieceQuery($filters)->limit(self::MAX_LABELS)->get();
        abort_if($pieces->isEmpty(), 404, 'No pieces found for the selected filters.');

        $pdf = Pdf::loadView('inventory::pdf.piece-labels-filtered', [
            'labels'  => $this->buildLabels($pieces),
            'filters' => $this->filterSummary($filters, $pieces),
        ])->setPaper('a4', 'portrait')
          ->setOptions([
              'defaultFont'          => 'DejaVu Sans',
              'isHtml5ParserEnabled' => true,
              'isPhpEnabled'         => false,
              'dpi'                  => 150,
          ]);

        GrnItemPiece::whereIn('id', $pieces->pluck('id'))
            ->whereNull('printed_at')
            ->update(['printed_at' => now()]);

        return $pdf->download('Piece_Labels.pdf');
    }

    /** GET /piece-labels/shipping-codes — distinct codes of confirmed GRNs for the filter dropdown */
    public function shippingCodes(): JsonResponse
    {
        $codes = GoodsReceivedNote::query()
            ->where('status', GrnStatus::Confirmed)
            ->whereNotNull('shipping_code')
            ->where('shipping_code', '!=', '')
            ->orderByDesc('id')
            ->pluck('shipping_code')
            ->unique()
            ->values();

        return response()->json(['data' => $codes]);
    }

    /** @return array{product_id?: int, shipping_code?: string, attribute_id?: int} */
    private function validateFilters(Request $request): array
    {
        return $request->validate([
            'product_id'    => ['nullable', 'integer', 'exists:inv_products,id', 'required_without_all:shipping_code,attribute_id'],
            'shipping_code' => ['nullable', 'string', 'max:100', 'required_without_all:product_id,attribute_id'],
            'attribute_id'  => ['nullable', 'integer', 'exists:inv_attributes,id', 'required_without_all:product_id,shipping_code'],
        ]);
    }

    /** Sealed pieces of confirmed GRNs matching the given filters. */
    private function pieceQuery(array $filters): Builder
    {
        return GrnItemPiece::query()
            ->whereNotNull('piece_code')
            ->whereHas('grn', function (Builder $query) use ($filters): void {
                $query->where('status', GrnStatus::Confirmed);
                if (!empty($filters['shipping_code'])) {
                    $query->where('shipping_code', $filters['shipping_code']);
                }
            })
            ->when(!empty($filters['product_id']), fn (Builder $query) => $query->where('product_id', (int) $filters['product_id']))
            ->when(!empty($filters['attribute_id']), fn (Builder $query) => $query->whereHas(
                'grnItem',
                fn (Builder $itemQuery) => $itemQuery->where('attribute_id', (int) $filters['attribute_id'])
            ))
            ->with([
                'product:id,name,product_code',
                'batch:id,batch_no',
                'grn:id,grn_no,shipping_code',
                'grnItem:id,attribute_id',
                'grnItem.attribute:id,attribute_name',
            ])
            ->orderBy('grn_id')
            ->orderBy('grn_item_id')
            ->orderBy('piece_no');
    }

    /** @return Collection<int, array<string, mixed>> */
    private function buildLabels(Collection $pieces): Collection
    {
        $frontendUrl = config('app.frontend_url');
        $writer      = new PngWriter();

        return $pieces->map(fn (GrnItemPiece $piece) => [
            'id'            => $piece->id,
            'piece_code'    => $piece->piece_code,
            'product_code'  => $piece->product?->product_code,
            'product_name'  => $piece->product?->name,
            'color'         => $piece->grnItem?->attribute?->attribute_name,
            'batch_no'      => $piece->batch?->batch_no,
            'roll_no'       => $piece->roll_no,
            'weight'        => $piece->weight,
            'grn_no'        => $piece->grn?->grn_no,
            'shipping_code' => $piece->grn?->shipping_code,
            'printed_at'    => $piece->printed_at?->toDateTimeString(),
            'qr_data_uri'   => $writer->write(
                new QrCode(
                    data:   "{$frontendUrl}/inventory/pieces/{$piece->piece_code}",
                    size:   180,
                    margin: 4,
                )
            )->getDataUri(),
        ])->values();
    }

    /** Human-readable filter summary shown in the PDF title area. */
    private function filterSummary(array $filters, Collection $pieces): string
    {
        $parts = [];
        if (!empty($filters['product_id'])) {
            $parts[] = 'Product: ' . ($pieces->first()?->product?->name ?? $filters['product_id']);
        }
        if (!empty($filters['shipping_code'])) {
            $parts[] = 'Shipping Code: ' . $filters['shipping_code'];
        }
        if (!empty($filters['attribute_id'])) {
            $parts[] = 'Color: ' . ($pieces->first()?->grnItem?->attribute?->attribute_name ?? $filters['attribute_id']);
        }

        return implode('  |  ', $parts);
    }
}
