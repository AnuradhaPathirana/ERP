<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Spatie\Permission\Models\Role;

class RoleController extends Controller
{
    public function index(): JsonResponse
    {
        $roles = Role::orderBy('name')
            ->get()
            ->map(fn (Role $role): array => [
                'name'  => $role->name,
                'label' => ucwords(str_replace('_', ' ', $role->name)),
            ])
            ->values()
            ->all();

        return response()->json(['data' => $roles]);
    }
}
