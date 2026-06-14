<?php

declare(strict_types=1);

namespace Modules\Inventory\Services;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Pagination\LengthAwarePaginator;
use Modules\Inventory\DTOs\SupplierMasterData;
use Modules\Inventory\Models\SupplierMaster;

class SupplierMasterService
{
    /** @param array<string, mixed> $filters */
    public function paginate(int $perPage = 25, array $filters = []): LengthAwarePaginator
    {
        $query = SupplierMaster::withCount('products')
            ->orderBy('supplier_name');

        if (!empty($filters['search'])) {
            $term = '%' . $filters['search'] . '%';
            $query->where(function ($q) use ($term) {
                $q->where('supplier_name', 'like', $term)
                  ->orWhere('supplier_code', 'like', $term)
                  ->orWhere('email', 'like', $term);
            });
        }

        if (!empty($filters['supplier_type'])) {
            $query->where('supplier_type', $filters['supplier_type']);
        }

        if (!empty($filters['bil_city'])) {
            $query->where('bil_city', 'like', '%' . $filters['bil_city'] . '%');
        }

        if (!empty($filters['bil_country'])) {
            $query->where('bil_country', 'like', '%' . $filters['bil_country'] . '%');
        }

        return $query->paginate($perPage);
    }

    public function find(int $id): SupplierMaster
    {
        return SupplierMaster::withCount('products')->findOrFail($id);
    }

    public function create(SupplierMasterData $data): SupplierMaster
    {
        return SupplierMaster::create($this->toAttributes($data));
    }

    public function update(SupplierMaster $supplier, SupplierMasterData $data): SupplierMaster
    {
        $supplier->update($this->toAttributes($data));

        return $supplier->loadCount('products');
    }

    public function delete(SupplierMaster $supplier): void
    {
        $supplier->delete();
    }

    /** Lightweight list for dropdowns — id + supplier_name only. */
    public function all(): Collection
    {
        return SupplierMaster::orderBy('supplier_name')
            ->get(['id', 'supplier_name']);
    }

    private function toAttributes(SupplierMasterData $data): array
    {
        return [
            'supplier_name'              => $data->supplierName,
            'supplier_code'              => $data->supplierCode,
            'reference_no'               => $data->referenceNo,
            'supplier_type'              => $data->supplierType,
            'check_writer_name'          => $data->checkWriterName,
            'mobile'                     => $data->mobile,
            'land_line'                  => $data->landLine,
            'email'                      => $data->email,
            'fax'                        => $data->fax,
            'website'                    => $data->website,
            'bil_address_line_1'         => $data->bilAddressLine1,
            'bil_address_line_2'         => $data->bilAddressLine2,
            'bil_address_line_3'         => $data->bilAddressLine3,
            'bil_city'                   => $data->bilCity,
            'bil_postal_code'            => $data->bilPostalCode,
            'bil_country'                => $data->bilCountry,
            'bil_state_province'         => $data->bilStateProvince,
            'tax_type'                   => $data->taxType,
            'tax_no'                     => $data->taxNo,
            'tax_regis_no'               => $data->taxRegisNo,
            'credit_limit'               => $data->creditLimit,
            'credit_period'              => $data->creditPeriod,
            'privileges_discount'        => $data->privilegesDiscount,
            'bank_name'                  => $data->bankName,
            'bank_branch'                => $data->bankBranch,
            'bank_acc_holder_name'       => $data->bankAccHolderName,
            'bank_acc_no'                => $data->bankAccNo,
            'contact_person_name'        => $data->contactPersonName,
            'contact_person_designation' => $data->contactPersonDesignation,
            'contact_person_mobile'      => $data->contactPersonMobile,
            'contact_person_email'       => $data->contactPersonEmail,
            'contact_person_fax'         => $data->contactPersonFax,
        ];
    }
}
