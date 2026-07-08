<?php

declare(strict_types=1);

namespace Modules\Inventory\Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Modules\Inventory\Models\Category;
use Modules\Inventory\Models\Product;

class ProductFactory extends Factory
{
    protected $model = Product::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'product_code' => $this->faker->unique()->regexify('[A-Z]{3}-[0-9]{5}'),
            'name'         => $this->faker->unique()->words(3, true),
            'product_type' => $this->faker->randomElement(['Product', 'Service', 'Bundle', 'Raw Material']),
            'category_id'  => fn () => Category::firstOrCreate(['category_name' => 'Test Category'])->id,
            // All boolean flags default to false — no need to specify them
        ];
    }
}
