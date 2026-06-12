<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RolesAndPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        // Clear cached permissions so freshly created ones are available immediately
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        // ── Permissions ────────────────────────────────────────────────
        $permissions = [
            // Inventory – Products
            'view_products',
            'create_products',
            'edit_products',
            'delete_products',
        ];

        foreach ($permissions as $name) {
            Permission::firstOrCreate(['name' => $name, 'guard_name' => 'web']);
        }

        // ── Roles ──────────────────────────────────────────────────────

        // super_admin: no explicit permissions — bypasses all gates via
        // the Gate::before() hook registered in AppServiceProvider.
        Role::firstOrCreate(['name' => 'super_admin', 'guard_name' => 'web']);

        // client_admin: full CRUD on products
        $clientAdmin = Role::firstOrCreate(['name' => 'client_admin', 'guard_name' => 'web']);
        $clientAdmin->syncPermissions([
            'view_products',
            'create_products',
            'edit_products',
            'delete_products',
        ]);

        // staff: read-only
        $staff = Role::firstOrCreate(['name' => 'staff', 'guard_name' => 'web']);
        $staff->syncPermissions(['view_products']);
    }
}
