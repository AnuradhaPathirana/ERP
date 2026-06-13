<?php

declare(strict_types=1);

namespace Modules\Inventory\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;
use Modules\Inventory\DTOs\AttributeData;
use Modules\Inventory\Http\Requests\AttributeRequest;
use Modules\Inventory\Http\Resources\AttributeResource;
use Modules\Inventory\Models\Attribute;
use Modules\Inventory\Services\AttributeService;

class AttributeController extends Controller
{
    public function __construct(private readonly AttributeService $service) {}

    public function index(): JsonResponse
    {
        $paginator = $this->service->paginate();

        return response()->json([
            'data' => collect($paginator->items())
                ->map(fn (Attribute $item) => (new AttributeResource($item))->toArray(request()))
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

    public function store(AttributeRequest $request): JsonResponse
    {
        $attribute = $this->service->create(AttributeData::fromRequest($request));

        return response()->json(
            ['data' => (new AttributeResource($attribute))->toArray(request())],
            201,
        );
    }

    public function show(Attribute $attribute): JsonResponse
    {
        $attribute->load('attributeType');

        return response()->json(
            ['data' => (new AttributeResource($attribute))->toArray(request())],
        );
    }

    public function update(AttributeRequest $request, Attribute $attribute): JsonResponse
    {
        $updated = $this->service->update($attribute, AttributeData::fromRequest($request));

        return response()->json(
            ['data' => (new AttributeResource($updated))->toArray(request())],
        );
    }

    public function destroy(Attribute $attribute): JsonResponse
    {
        $this->service->delete($attribute);

        return response()->json(null, 204);
    }

    /** Flat list for <select> dropdowns — no pagination. */
    public function all(): JsonResponse
    {
        $items = $this->service->all()
            ->map(fn (Attribute $a) => [
                'id'                => $a->id,
                'attribute_type_id' => $a->attribute_type_id,
                'attribute_name'    => $a->attribute_name,
            ])
            ->values()
            ->all();

        return response()->json(['data' => $items]);
    }
}
