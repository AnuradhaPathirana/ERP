<?php

declare(strict_types=1);

namespace Modules\Inventory\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Inventory\DTOs\InvoiceData;
use Modules\Inventory\Http\Requests\StoreInvoiceRequest;
use Modules\Inventory\Http\Requests\UpdateInvoiceRequest;
use Modules\Inventory\Http\Resources\InvoiceResource;
use Modules\Inventory\Models\Invoice;
use Modules\Inventory\Services\InvoiceService;

class InvoiceController extends Controller
{
    public function __construct(private readonly InvoiceService $service)
    {
        $this->middleware('permission:view_invoices')->only(['index', 'show']);
        $this->middleware('permission:create_invoices')
            ->only(['store', 'nextInvoiceNo', 'billingSourceForSo', 'billingSourceForDo']);
        $this->middleware('permission:edit_invoices')->only(['update', 'updateStatus']);
        $this->middleware('permission:delete_invoices')->only(['destroy']);
    }

    public function index(Request $request): JsonResponse
    {
        $filters   = $request->only(['search', 'status', 'customer_id', 'so_id', 'date_from', 'date_to']);
        $paginator = $this->service->paginate(50, $filters);

        return response()->json([
            'data' => InvoiceResource::collection($paginator->items()),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page'    => $paginator->lastPage(),
                'per_page'     => $paginator->perPage(),
                'total'        => $paginator->total(),
            ],
        ]);
    }

    public function store(StoreInvoiceRequest $request): JsonResponse
    {
        $invoice = $this->service->create(InvoiceData::fromRequest($request));

        return response()->json(['data' => new InvoiceResource($invoice)], 201);
    }

    public function show(Invoice $invoice): JsonResponse
    {
        return response()->json(['data' => new InvoiceResource($this->service->find($invoice->id))]);
    }

    public function update(UpdateInvoiceRequest $request, Invoice $invoice): JsonResponse
    {
        $updated = $this->service->update($invoice, InvoiceData::fromRequest($request));

        return response()->json(['data' => new InvoiceResource($updated)]);
    }

    public function destroy(Invoice $invoice): JsonResponse
    {
        $this->service->delete($invoice);

        return response()->json(null, 204);
    }

    /** PATCH /invoices/{invoice}/status — issued | paid | cancelled */
    public function updateStatus(Request $request, Invoice $invoice): JsonResponse
    {
        $validated = $request->validate(['status' => ['required', 'string']]);

        $updated = $this->service->updateStatus($invoice, $validated['status']);

        return response()->json(['data' => new InvoiceResource($updated)]);
    }

    /** GET /invoices/next-invoice-no — lock-free preview */
    public function nextInvoiceNo(): JsonResponse
    {
        return response()->json(['data' => $this->service->nextInvoiceNo()]);
    }

    /** GET /invoices/billing-source/so/{soId} — direct-SO billing preview */
    public function billingSourceForSo(int $soId): JsonResponse
    {
        return response()->json(['data' => $this->service->billingSourceForSo($soId)]);
    }

    /** GET /invoices/billing-source/do/{doId} — per-DO billing preview */
    public function billingSourceForDo(int $doId): JsonResponse
    {
        return response()->json(['data' => $this->service->billingSourceForDo($doId)]);
    }
}
