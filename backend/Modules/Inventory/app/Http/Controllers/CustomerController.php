<?php

declare(strict_types=1);

namespace Modules\Inventory\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;
use Modules\Inventory\DTOs\CustomerData;
use Modules\Inventory\Http\Requests\CustomerRequest;
use Modules\Inventory\Http\Resources\CustomerResource;
use Modules\Inventory\Models\CustomerMaster;
use Modules\Inventory\Services\CustomerService;

class CustomerController extends Controller
{
    public function __construct(private readonly CustomerService $service)
    {
        $this->middleware('permission:view_customers')->only(['index', 'show']);
        $this->middleware('permission:manage_customers')->only(['store', 'update', 'destroy']);
    }

    public function index(): JsonResponse
    {
        $paginator = $this->service->paginate();

        return response()->json([
            'data' => collect($paginator->items())
                ->map(fn (CustomerMaster $item) => (new CustomerResource($item))->toArray(request()))
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

    public function store(CustomerRequest $request): JsonResponse
    {
        $customer = $this->service->create(CustomerData::fromRequest($request));

        return response()->json(
            ['data' => (new CustomerResource($customer))->toArray(request())],
            201,
        );
    }

    public function show(CustomerMaster $customerMaster): JsonResponse
    {
        return response()->json(
            ['data' => (new CustomerResource($customerMaster))->toArray(request())],
        );
    }

    public function update(CustomerRequest $request, CustomerMaster $customerMaster): JsonResponse
    {
        $customer = $this->service->update($customerMaster, CustomerData::fromRequest($request));

        return response()->json(
            ['data' => (new CustomerResource($customer))->toArray(request())],
        );
    }

    public function destroy(CustomerMaster $customerMaster): JsonResponse
    {
        $this->service->delete($customerMaster);

        return response()->json(null, 204);
    }

    /** Flat list for <select> dropdowns — no pagination, id + name only. */
    public function all(): JsonResponse
    {
        $items = $this->service->all()
            ->map(fn (CustomerMaster $c) => ['id' => $c->id, 'name' => $c->customer_name])
            ->values()
            ->all();

        return response()->json(['data' => $items]);
    }
}
