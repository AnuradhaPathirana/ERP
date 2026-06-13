<?php

declare(strict_types=1);

namespace Modules\Inventory\Services;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Pagination\LengthAwarePaginator;
use Modules\Inventory\DTOs\AttributeData;
use Modules\Inventory\Models\Attribute;

class AttributeService
{
    public function paginate(int $perPage = 25): LengthAwarePaginator
    {
        return Attribute::with('attributeType')
            ->orderBy('attribute_name')
            ->paginate($perPage);
    }

    public function find(int $id): Attribute
    {
        return Attribute::with('attributeType')->findOrFail($id);
    }

    public function create(AttributeData $data): Attribute
    {
        $attribute = Attribute::create([
            'attribute_type_id' => $data->attribute_type_id,
            'attribute_name'    => $data->attribute_name,
        ]);

        return $attribute->load('attributeType');
    }

    public function update(Attribute $attribute, AttributeData $data): Attribute
    {
        $attribute->update([
            'attribute_type_id' => $data->attribute_type_id,
            'attribute_name'    => $data->attribute_name,
        ]);

        return $attribute->load('attributeType');
    }

    public function delete(Attribute $attribute): void
    {
        $attribute->delete();
    }

    /** Lightweight list for dropdowns — returns only id + attribute_name. */
    public function all(): Collection
    {
        return Attribute::orderBy('attribute_name')
            ->get(['id', 'attribute_type_id', 'attribute_name']);
    }
}
