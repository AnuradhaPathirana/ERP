<?php

declare(strict_types=1);

namespace Modules\Inventory\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;
use Modules\Inventory\DTOs\AttributeTypeData;
use Modules\Inventory\Http\Requests\AttributeTypeRequest;
use Modules\Inventory\Http\Resources\AttributeTypeResource;
use Modules\Inventory\Models\AttributeType;
use Modules\Inventory\Services\AttributeTypeService;

class AttributeTypeController extends Controller
{
    public function __construct(private readonly AttributeTypeService $service) {}

    public function index(): JsonResponse
    {
        $paginator = $this->service->paginate();

        return response()->json([
            'data' => collect($paginator->items())
                ->map(fn (AttributeType $item) => (new AttributeTypeResource($item))->toArray(request()))
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

    public function store(AttributeTypeRequest $request): JsonResponse
    {
        $type = $this->service->create(AttributeTypeData::fromRequest($request));

        return response()->json(
            ['data' => (new AttributeTypeResource($type))->toArray(request())],
            201,
        );
    }

    public function show(AttributeType $attributeType): JsonResponse
    {
        $attributeType->load('category');

        return response()->json(
            ['data' => (new AttributeTypeResource($attributeType))->toArray(request())],
        );
    }

    public function update(AttributeTypeRequest $request, AttributeType $attributeType): JsonResponse
    {
        $type = $this->service->update($attributeType, AttributeTypeData::fromRequest($request));

        return response()->json(
            ['data' => (new AttributeTypeResource($type))->toArray(request())],
        );
    }

    public function destroy(AttributeType $attributeType): JsonResponse
    {
        $this->service->delete($attributeType);

        return response()->json(null, 204);
    }

    /** Flat list for <select> dropdowns — no pagination, id+attribute_type_name only. */
    public function all(): JsonResponse
    {
        $items = $this->service->all()
            ->map(fn (AttributeType $t) => ['id' => $t->id, 'attribute_type_name' => $t->attribute_type_name])
            ->values()
            ->all();

        return response()->json(['data' => $items]);
    }
}
