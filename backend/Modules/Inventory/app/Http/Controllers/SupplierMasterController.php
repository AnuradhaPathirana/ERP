<?php

declare(strict_types=1);

namespace Modules\Inventory\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;
use Modules\Inventory\DTOs\SupplierMasterData;
use Modules\Inventory\Http\Requests\SupplierMasterRequest;
use Modules\Inventory\Http\Resources\SupplierMasterResource;
use Modules\Inventory\Models\SupplierMaster;
use Modules\Inventory\Services\SupplierMasterService;

class SupplierMasterController extends Controller
{
    public function __construct(private readonly SupplierMasterService $service) {}

    public function index(): JsonResponse
    {
        $paginator = $this->service->paginate();

        return response()->json([
            'data' => collect($paginator->items())
                ->map(fn (SupplierMaster $item) => (new SupplierMasterResource($item))->toArray(request()))
                ->values()
                ->all(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page'    => $paginator->lastPage(),
                'per_page'     => $paginator->perPage(),
                'total'        => $paginator->total(),
            ],
        ]);
    }

    public function store(SupplierMasterRequest $request): JsonResponse
    {
        $supplier = $this->service->create(SupplierMasterData::fromRequest($request));

        return response()->json(
            ['data' => (new SupplierMasterResource($supplier))->toArray(request())],
            201,
        );
    }

    public function show(SupplierMaster $supplierMaster): JsonResponse
    {
        return response()->json(
            ['data' => (new SupplierMasterResource($supplierMaster))->toArray(request())],
        );
    }

    public function update(SupplierMasterRequest $request, SupplierMaster $supplierMaster): JsonResponse
    {
        $supplier = $this->service->update($supplierMaster, SupplierMasterData::fromRequest($request));

        return response()->json(
            ['data' => (new SupplierMasterResource($supplier))->toArray(request())],
        );
    }

    public function destroy(SupplierMaster $supplierMaster): JsonResponse
    {
        $this->service->delete($supplierMaster);

        return response()->json(null, 204);
    }

    /** Flat list for <select> dropdowns — no pagination, id + name only. */
    public function all(): JsonResponse
    {
        $items = $this->service->all()
            ->map(fn (SupplierMaster $s) => ['id' => $s->id, 'name' => $s->supplier_name])
            ->values()
            ->all();

        return response()->json(['data' => $items]);
    }
}
