<?php

declare(strict_types=1);

namespace Modules\Inventory\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;
use Modules\Inventory\DTOs\UnitTypeData;
use Modules\Inventory\Http\Requests\UnitTypeRequest;
use Modules\Inventory\Http\Resources\UnitTypeResource;
use Modules\Inventory\Models\UnitType;
use Modules\Inventory\Services\UnitTypeService;

class UnitTypeController extends Controller
{
    public function __construct(private readonly UnitTypeService $service) {}

    public function index(): JsonResponse
    {
        $paginator = $this->service->paginate();

        return response()->json([
            'data' => collect($paginator->items())
                ->map(fn (UnitType $item) => (new UnitTypeResource($item))->toArray(request()))
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

    public function store(UnitTypeRequest $request): JsonResponse
    {
        $unitType = $this->service->create(UnitTypeData::fromRequest($request));

        return response()->json(
            ['data' => (new UnitTypeResource($unitType))->toArray(request())],
            201,
        );
    }

    public function show(UnitType $unitType): JsonResponse
    {
        $unitType->loadMissing('category');

        return response()->json(
            ['data' => (new UnitTypeResource($unitType))->toArray(request())],
        );
    }

    public function update(UnitTypeRequest $request, UnitType $unitType): JsonResponse
    {
        $unitType = $this->service->update($unitType, UnitTypeData::fromRequest($request));

        return response()->json(
            ['data' => (new UnitTypeResource($unitType))->toArray(request())],
        );
    }

    public function destroy(UnitType $unitType): JsonResponse
    {
        $this->service->delete($unitType);

        return response()->json(null, 204);
    }

    /** Flat list for dropdowns — id + name + symbol. */
    public function all(): JsonResponse
    {
        $items = UnitType::orderBy('name')
            ->get(['id', 'name', 'symbol'])
            ->map(fn (UnitType $u) => [
                'id'     => $u->id,
                'name'   => $u->name,
                'symbol' => $u->symbol,
            ])
            ->values()
            ->all();

        return response()->json(['data' => $items]);
    }
}
