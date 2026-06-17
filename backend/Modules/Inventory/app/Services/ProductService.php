<?php

declare(strict_types=1);

namespace Modules\Inventory\Services;

use Illuminate\Pagination\LengthAwarePaginator;
use Modules\Inventory\DTOs\ProductData;
use Modules\Inventory\Models\Product;
use Modules\Inventory\Models\ProductAttribute;
use Modules\Inventory\Models\ProductLocationStore;

class ProductService
{
    /** @param array<string, mixed> $filters */
    public function paginate(int $perPage = 25, array $filters = []): LengthAwarePaginator
    {
        $query = Product::with(['suppliers', 'salesChannels', 'category'])
            ->orderBy('name');

        if (!empty($filters['search'])) {
            $term = '%' . $filters['search'] . '%';
            $query->where(function ($q) use ($term) {
                $q->where('name', 'like', $term)
                  ->orWhere('product_code', 'like', $term)
                  ->orWhere('ean_13', 'like', $term);
            });
        }

        if (!empty($filters['product_type'])) {
            $query->where('product_type', $filters['product_type']);
        }

        if (!empty($filters['category_id'])) {
            $query->where('category_id', (int) $filters['category_id']);
        }

        if (!empty($filters['tracking_type'])) {
            $query->where('tracking_type', $filters['tracking_type']);
        }

        return $query->paginate($perPage);
    }

    public function find(int $id): Product
    {
        return Product::with(['suppliers', 'salesChannels', 'category', 'location', 'productAttributes', 'locationStores'])->findOrFail($id);
    }

    public function create(ProductData $data): Product
    {
        $product = Product::create($this->toAttributes($data));

        $this->syncSuppliers($product, $data->supplierIds);
        $this->syncCostDetails($product, $data->costDetails);
        $this->syncProductAttributes($product, $data->productAttributes);
        $this->syncLocationStores($product, $data->locationStores);

        return $product->load(['suppliers', 'salesChannels', 'productAttributes', 'locationStores']);
    }

    public function update(Product $product, ProductData $data): Product
    {
        $product->update($this->toAttributes($data));

        $this->syncSuppliers($product, $data->supplierIds);
        $this->syncCostDetails($product, $data->costDetails);
        $this->syncProductAttributes($product, $data->productAttributes);
        $this->syncLocationStores($product, $data->locationStores);

        return $product->load(['suppliers', 'salesChannels', 'productAttributes', 'locationStores']);
    }

    public function delete(Product $product): void
    {
        $product->delete();
    }

    /** @param array<int> $supplierIds */
    private function syncSuppliers(Product $product, array $supplierIds): void
    {
        $product->suppliers()->sync($supplierIds);
    }

    /**
     * @param array<array<string, mixed>> $costDetails
     * Each item: { sales_channel_id, uom?, num_of_units?, cost_price?, margin?, selling_price?, sale_privileges_discount? }
     */
    private function syncCostDetails(Product $product, array $costDetails): void
    {
        $pivotData = [];

        foreach ($costDetails as $row) {
            $channelId = (int) $row['sales_channel_id'];
            if ($channelId <= 0) {
                continue;
            }

            $pivotData[$channelId] = [
                'num_of_units'                   => $row['num_of_units']                   ?? null,
                'cost_price'                     => $row['cost_price']                     ?? null,
                'margin'                         => $row['margin']                         ?? null,
                'margin_type'                    => $row['margin_type']                    ?? 'percentage',
                'selling_price'                  => $row['selling_price']                  ?? null,
                'max_price'                      => $row['max_price']                      ?? null,
                'min_price'                      => $row['min_price']                      ?? null,
                'wholesale_price'                => $row['wholesale_price']                ?? null,
                'sale_privileges_discount'       => $row['sale_privileges_discount']       ?? null,
                'purchasing_privileges_discount' => $row['purchasing_privileges_discount'] ?? null,
            ];
        }

        $product->salesChannels()->sync($pivotData);
    }

    /** @param array<array{location_id: ?int, store_id: ?int}> $locationStores */
    private function syncLocationStores(Product $product, array $locationStores): void
    {
        $product->locationStores()->delete();

        $rows = collect($locationStores)
            ->filter(fn (array $row) => !empty($row['location_id']) || !empty($row['store_id']))
            ->values()
            ->map(fn (array $row) => [
                'product_id'  => $product->id,
                'location_id' => !empty($row['location_id']) ? (int) $row['location_id'] : null,
                'store_id'    => !empty($row['store_id'])    ? (int) $row['store_id']    : null,
                'created_at'  => now(),
                'updated_at'  => now(),
            ])
            ->all();

        if (!empty($rows)) {
            ProductLocationStore::insert($rows);
        }
    }

    /** @param array<array{attribute_type_id: int, attribute_id: int}> $productAttributes */
    private function syncProductAttributes(Product $product, array $productAttributes): void
    {
        $product->productAttributes()->delete();

        $rows = collect($productAttributes)
            ->filter(fn (array $row) => !empty($row['attribute_id']) && !empty($row['attribute_type_id']))
            ->unique('attribute_id')
            ->values()
            ->map(fn (array $row) => [
                'product_id'        => $product->id,
                'attribute_type_id' => (int) $row['attribute_type_id'],
                'attribute_id'      => (int) $row['attribute_id'],
                'created_at'        => now(),
                'updated_at'        => now(),
            ])
            ->all();

        if (!empty($rows)) {
            ProductAttribute::insert($rows);
        }
    }

    /** @return array<string, mixed> */
    private function toAttributes(ProductData $data): array
    {
        return [
            'product_code'             => $data->productCode,
            'reference_no'             => $data->referenceNo,
            'ean_13'                   => $data->ean13,
            'name'                     => $data->name,
            'display_name'             => $data->displayName,
            'product_type'             => $data->productType,
            'description'              => $data->description,
            'category_id'              => $data->categoryId,
            'location_id'              => $data->locationId,
            'reorder_level'            => $data->reorderLevel,
            'reorder_qty'              => $data->reorderQty,
            'reorder_period'           => $data->reorderPeriod,
            'stock_releasing_method'   => $data->stockReleasingMethod,
            'tracking_type'            => $data->trackingType,
            'lock_purchase'            => $data->lockPurchase,
            'allow_complimentary_items'=> $data->allowComplementaryItems,
            'free_issue'               => $data->freeIssue,
            'allow_minus'              => $data->allowMinus,
            'not_allow_direct_sale'    => $data->notAllowDirectSale,
            'non_returnable'           => $data->nonReturnable,
            'is_empty'                 => $data->isEmpty,
            'service_charge'           => $data->serviceCharge,
            'loyalty'                  => $data->loyalty,
            'is_batch'                 => $data->isBatch,
            'is_serial'                => $data->isSerial,
        ];
    }
}
