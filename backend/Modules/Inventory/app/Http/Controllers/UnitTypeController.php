<?php

declare(strict_types=1);

namespace Modules\Inventory\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Inventory\DTOs\UnitTypeData;
use Modules\Inventory\Http\Requests\UnitTypeRequest;
use Modules\Inventory\Http\Resources\UnitTypeResource;
use Modules\Inventory\Models\UnitCategory;
use Modules\Inventory\Models\UnitType;
use Modules\Inventory\Services\UnitTypeService;

class UnitTypeController extends Controller
{
    public function __construct(private readonly UnitTypeService $service)
    {
        $this->middleware('permission:view_unit_types')->only(['index', 'show', 'all']);
        $this->middleware('permission:create_unit_types')->only(['store']);
        $this->middleware('permission:edit_unit_types')->only(['update']);
        $this->middleware('permission:delete_unit_types')->only(['destroy']);
    }

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

    /**
     * Flat list for dropdowns. Pass `unit_category_id` to scope to a specific category
     * (e.g. cascading Unit Category → UOM selects); otherwise falls back to the default category.
     */
    public function all(Request $request): JsonResponse
    {
        $categoryId = $request->query('unit_category_id');

        $query = UnitType::orderBy('name')->select(['id', 'name', 'symbol', 'unit_category_id']);

        if ($categoryId) {
            $query->where('unit_category_id', (int) $categoryId);
        } else {
            $defaultCategory = UnitCategory::where('is_default', true)->value('id');
            if ($defaultCategory) {
                $query->where('unit_category_id', $defaultCategory);
            }
        }

        $items = $query->get()
            ->map(fn (UnitType $u) => [
                'id'               => $u->id,
                'unit_category_id' => $u->unit_category_id,
                'name'             => $u->name,
                'symbol'           => $u->symbol,
            ])
            ->values()
            ->all();

        return response()->json(['data' => $items]);
    }
}
