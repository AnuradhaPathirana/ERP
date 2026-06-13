<?php

declare(strict_types=1);

namespace Modules\Inventory\Services;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Pagination\LengthAwarePaginator;
use Modules\Inventory\DTOs\AttributeTypeData;
use Modules\Inventory\Models\AttributeType;

class AttributeTypeService
{
    public function paginate(int $perPage = 25): LengthAwarePaginator
    {
        return AttributeType::with('category')
            ->withCount('attributes')
            ->orderBy('attribute_type_name')
            ->paginate($perPage);
    }

    public function find(int $id): AttributeType
    {
        return AttributeType::with('category')
            ->withCount('attributes')
            ->findOrFail($id);
    }

    public function create(AttributeTypeData $data): AttributeType
    {
        $type = AttributeType::create([
            'category_id'          => $data->category_id,
            'product_service_type' => $data->product_service_type,
            'attribute_type_name'  => $data->attribute_type_name,
            'description'          => $data->description,
        ]);

        return $type->load('category');
    }

    public function update(AttributeType $type, AttributeTypeData $data): AttributeType
    {
        $type->update([
            'category_id'          => $data->category_id,
            'product_service_type' => $data->product_service_type,
            'attribute_type_name'  => $data->attribute_type_name,
            'description'          => $data->description,
        ]);

        return $type->load('category')->loadCount('attributes');
    }

    public function delete(AttributeType $type): void
    {
        $type->delete();
    }

    /** Lightweight list for dropdowns — returns only id + attribute_type_name. */
    public function all(): Collection
    {
        return AttributeType::orderBy('attribute_type_name')
            ->get(['id', 'attribute_type_name']);
    }
}
