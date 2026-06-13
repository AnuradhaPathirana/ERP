<?php

declare(strict_types=1);

namespace Modules\Inventory\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AttributeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'attribute_type_id' => ['required', 'integer', 'exists:inv_attribute_types,id'],
            'attribute_name'    => ['required', 'string', 'max:100'],
        ];
    }

    /** @return array<string, string> */
    public function attributes(): array
    {
        return [
            'attribute_type_id' => 'attribute type',
            'attribute_name'    => 'attribute name',
        ];
    }
}
