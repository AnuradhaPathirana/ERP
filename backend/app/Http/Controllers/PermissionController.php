<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Spatie\Permission\Models\Permission;

class PermissionController extends Controller
{
    /**
     * Maps module → resource_key → human label.
     * Add new modules/resources here as they are introduced.
     */
    private const GROUPS = [
        'inventory' => [
            'label'     => 'Inventory',
            'resources' => [
                'products'        => 'Products',
                'categories'      => 'Categories',
                'unit_categories' => 'Unit Categories',
                'unit_types'      => 'Unit Types',
                'unit_conversions' => 'Unit Conversions',
                'supplier_masters' => 'Suppliers',
                'sales_channels'  => 'Sales Channels',
                'industries'      => 'Industries',
                'companies'       => 'Companies',
                'locations'       => 'Locations',
                'attribute_types' => 'Attribute Types',
                'attributes'      => 'Attributes',
                'customer_masters' => 'Customers',
                'store_types'     => 'Store Types',
                'stores'          => 'Stores',
                'drivers'         => 'Drivers',
                'vehicle_masters' => 'Vehicles',
            ],
        ],
    ];

    private const ACTIONS = ['view', 'create', 'edit', 'delete'];

    /** Return all permissions grouped by module → resource → action. */
    public function index(): JsonResponse
    {
        $existing = Permission::pluck('name')->flip();

        $grouped = [];

        foreach (self::GROUPS as $moduleKey => $module) {
            $grouped[$moduleKey] = [
                'label'     => $module['label'],
                'resources' => [],
            ];

            foreach ($module['resources'] as $resourceKey => $resourceLabel) {
                $permissions = [];

                foreach (self::ACTIONS as $action) {
                    $name = "{$action}_{$resourceKey}";
                    if ($existing->has($name)) {
                        $permissions[] = $name;
                    }
                }

                if (! empty($permissions)) {
                    $grouped[$moduleKey]['resources'][$resourceKey] = [
                        'label'       => $resourceLabel,
                        'permissions' => $permissions,
                    ];
                }
            }
        }

        return response()->json(['data' => $grouped]);
    }
}
