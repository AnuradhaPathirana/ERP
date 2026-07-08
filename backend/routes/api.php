<?php

declare(strict_types=1);

use App\Http\Controllers\AuthController;
use App\Http\Controllers\GlobalSettingController;
use App\Http\Controllers\PermissionController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login']);

// ── Super-admin only ───────────────────────────────────────────────────────────
Route::middleware(['auth:sanctum', 'super_admin'])->group(function (): void {
    Route::get('/settings', [GlobalSettingController::class, 'index']);
    Route::put('/settings/{key}', [GlobalSettingController::class, 'update']);
});

// ── Any authenticated user ─────────────────────────────────────────────────────
Route::middleware('auth:sanctum')->group(function (): void {
    // Lightweight user lookup for document dropdowns (sales person, order taken by)
    Route::get('users/all', [UserController::class, 'all'])->name('users.all');
});

// ── Client-admin and above ─────────────────────────────────────────────────────
Route::middleware(['auth:sanctum', 'client_admin'])->group(function (): void {
    Route::apiResource('users', UserController::class);

    // Roles — list, create, update, delete, and permission sync
    Route::apiResource('roles', RoleController::class);
    Route::get('roles/{role}/permissions', [RoleController::class, 'showPermissions'])
        ->name('roles.permissions.show');
    Route::put('roles/{role}/permissions', [RoleController::class, 'syncPermissions'])
        ->name('roles.permissions.sync');

    // Permissions — grouped index for the UI permission matrix
    Route::get('permissions', [PermissionController::class, 'index'])
        ->name('permissions.index');
});
