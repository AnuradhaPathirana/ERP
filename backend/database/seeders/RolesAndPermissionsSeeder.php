<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RolesAndPermissionsSeeder extends Seeder
{
    /** All Inventory module resources that have CRUD permissions. */
    private const INVENTORY_RESOURCES = [
        'products',
        'categories',
        'unit_categories',
        'unit_types',
        'unit_conversions',
        'supplier_masters',
        'sales_channels',
        'industries',
        'companies',
        'locations',
        'attribute_types',
        'attributes',
        'customer_masters',
        'store_types',
        'stores',
        'drivers',
        'vehicle_masters',
    ];

    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        // ── Build all permissions ──────────────────────────────────────────
        $allPermissions   = [];
        $viewPermissions  = [];
        $crudPermissions  = [];

        foreach (self::INVENTORY_RESOURCES as $resource) {
            $view   = "view_{$resource}";
            $create = "create_{$resource}";
            $edit   = "edit_{$resource}";
            $delete = "delete_{$resource}";

            foreach ([$view, $create, $edit, $delete] as $perm) {
                Permission::firstOrCreate(['name' => $perm, 'guard_name' => 'web']);
                $allPermissions[]  = $perm;
                $crudPermissions[] = $perm;
            }

            $viewPermissions[] = $view;
        }

        // ── Roles ──────────────────────────────────────────────────────────

        // super_admin: bypasses all gates via Gate::before() in AppServiceProvider
        Role::firstOrCreate(['name' => 'super_admin', 'guard_name' => 'web']);

        // admin: full access to everything by default
        $clientAdmin = Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        $clientAdmin->syncPermissions($crudPermissions);

        // staff: read-only access by default
        $staff = Role::firstOrCreate(['name' => 'staff', 'guard_name' => 'web']);
        $staff->syncPermissions($viewPermissions);
    }
}
