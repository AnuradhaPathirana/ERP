<?php

declare(strict_types=1);

namespace Modules\Inventory\Services;

use Illuminate\Pagination\LengthAwarePaginator;
use Modules\Inventory\DTOs\ProductData;
use Modules\Inventory\Models\Product;

class ProductService
{
    public function paginate(int $perPage = 25): LengthAwarePaginator
    {
        return Product::with(['suppliers', 'salesChannels'])
            ->orderBy('name')
            ->paginate($perPage);
    }

    public function find(int $id): Product
    {
        return Product::with(['suppliers', 'salesChannels', 'category', 'location'])->findOrFail($id);
    }

    public function create(ProductData $data): Product
    {
        $product = Product::create($this->toAttributes($data));

        $this->syncSuppliers($product, $data->supplierIds);
        $this->syncCostDetails($product, $data->costDetails);

        return $product->load(['suppliers', 'salesChannels']);
    }

    public function update(Product $product, ProductData $data): Product
    {
        $product->update($this->toAttributes($data));

        $this->syncSuppliers($product, $data->supplierIds);
        $this->syncCostDetails($product, $data->costDetails);

        return $product->load(['suppliers', 'salesChannels']);
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
                'uom'                            => $row['uom']                            ?? null,
                'num_of_units'                   => $row['num_of_units']                   ?? null,
                'cost_price'                     => $row['cost_price']                     ?? null,
                'margin'                         => $row['margin']                         ?? null,
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
