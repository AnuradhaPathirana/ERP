<?php

declare(strict_types=1);

namespace Modules\Inventory\Services;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Pagination\LengthAwarePaginator;
use Modules\Inventory\DTOs\CustomerData;
use Modules\Inventory\Models\CustomerMaster;

class CustomerService
{
    /** @param array<string, mixed> $filters */
    public function paginate(int $perPage = 50, array $filters = []): LengthAwarePaginator
    {
        $query = CustomerMaster::orderBy('customer_name');

        if (!empty($filters['search'])) {
            $term = '%' . $filters['search'] . '%';
            $query->where(function ($q) use ($term) {
                $q->where('customer_name', 'like', $term)
                  ->orWhere('customer_code', 'like', $term)
                  ->orWhere('customer_email', 'like', $term);
            });
        }

        if (!empty($filters['customer_type'])) {
            $query->where('customer_type', $filters['customer_type']);
        }

        if (!empty($filters['billing_city'])) {
            $query->where('billing_city', 'like', '%' . $filters['billing_city'] . '%');
        }

        if (!empty($filters['billing_country'])) {
            $query->where('billing_country', 'like', '%' . $filters['billing_country'] . '%');
        }

        return $query->paginate($perPage);
    }

    public function find(int $id): CustomerMaster
    {
        return CustomerMaster::findOrFail($id);
    }

    public function create(CustomerData $data): CustomerMaster
    {
        return CustomerMaster::create($this->toAttributes($data));
    }

    public function update(CustomerMaster $customer, CustomerData $data): CustomerMaster
    {
        $customer->update($this->toAttributes($data));

        return $customer->fresh();
    }

    public function delete(CustomerMaster $customer): void
    {
        $customer->delete();
    }

    /** Lightweight list for dropdowns — id + customer_name only. */
    public function all(): Collection
    {
        return CustomerMaster::orderBy('customer_name')
            ->get(['id', 'customer_name']);
    }

    private function toAttributes(CustomerData $data): array
    {
        return [
            'customer_code'                => $data->customerCode,
            'reference_no'                 => $data->referenceNo,
            'title'                        => $data->title,
            'customer_type'                => $data->customerType,
            'customer_name'                => $data->customerName,
            'nic_passport_driving_licence' => $data->nicPassportDrivingLicence,
            'attachments'                  => $data->attachments,
            'br_no'                        => $data->brNo,
            'customer_mobile'              => $data->customerMobile,
            'customer_land_line'           => $data->customerLandLine,
            'customer_email'               => $data->customerEmail,
            'customer_fax'                 => $data->customerFax,
            'billing_address_line1'        => $data->billingAddressLine1,
            'billing_address_line2'        => $data->billingAddressLine2,
            'billing_address_line3'        => $data->billingAddressLine3,
            'billing_city'                 => $data->billingCity,
            'billing_zip_postal'           => $data->billingZipPostal,
            'billing_state_province'       => $data->billingStateProvince,
            'billing_country'              => $data->billingCountry,
            'shipping_address_line1'       => $data->shippingAddressLine1,
            'shipping_address_line2'       => $data->shippingAddressLine2,
            'shipping_address_line3'       => $data->shippingAddressLine3,
            'shipping_city'                => $data->shippingCity,
            'shipping_zip_postal'          => $data->shippingZipPostal,
            'shipping_state_province'      => $data->shippingStateProvince,
            'shipping_country'             => $data->shippingCountry,
            'sale_manager'                 => $data->saleManager,
            'sales_executive'              => $data->salesExecutive,
            'sales_person'                 => $data->salesPerson,
        ];
    }
}
