<?php

declare(strict_types=1);

namespace Modules\Inventory\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;
use Modules\Inventory\DTOs\UnitCategoryData;
use Modules\Inventory\Http\Requests\UnitCategoryRequest;
use Modules\Inventory\Http\Resources\UnitCategoryResource;
use Modules\Inventory\Models\UnitCategory;
use Modules\Inventory\Services\UnitCategoryService;

class UnitCategoryController extends Controller
{
    public function __construct(private readonly UnitCategoryService $service) {}

    public function index(): JsonResponse
    {
        $paginator = $this->service->paginate();

        return response()->json([
            'data' => collect($paginator->items())
                ->map(fn (UnitCategory $item) => (new UnitCategoryResource($item))->toArray(request()))
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

    public function store(UnitCategoryRequest $request): JsonResponse
    {
        $category = $this->service->create(UnitCategoryData::fromRequest($request));

        return response()->json(
            ['data' => (new UnitCategoryResource($category))->toArray(request())],
            201,
        );
    }

    public function show(UnitCategory $unitCategory): JsonResponse
    {
        return response()->json(
            ['data' => (new UnitCategoryResource($unitCategory))->toArray(request())],
        );
    }

    public function update(UnitCategoryRequest $request, UnitCategory $unitCategory): JsonResponse
    {
        $category = $this->service->update($unitCategory, UnitCategoryData::fromRequest($request));

        return response()->json(
            ['data' => (new UnitCategoryResource($category))->toArray(request())],
        );
    }

    public function destroy(UnitCategory $unitCategory): JsonResponse
    {
        $this->service->delete($unitCategory);

        return response()->json(null, 204);
    }

    /** Flat list for <select> dropdowns — no pagination, id+name only. */
    public function all(): JsonResponse
    {
        $items = $this->service->all()
            ->map(fn (UnitCategory $cat) => ['id' => $cat->id, 'name' => $cat->name])
            ->values()
            ->all();

        return response()->json(['data' => $items]);
    }
}
