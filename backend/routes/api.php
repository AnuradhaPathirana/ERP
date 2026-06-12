<?php

declare(strict_types=1);

use App\Http\Controllers\AuthController;
use App\Http\Controllers\GlobalSettingController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login']);

// ── Super-admin only ───────────────────────────────────────────────────────────
Route::middleware(['auth:sanctum', 'super_admin'])->group(function (): void {
    Route::get('/settings', [GlobalSettingController::class, 'index']);
    Route::put('/settings/{key}', [GlobalSettingController::class, 'update']);
});

// ── Client-admin and above ─────────────────────────────────────────────────────
Route::middleware(['auth:sanctum', 'client_admin'])->group(function (): void {
    Route::apiResource('users', UserController::class);
    Route::get('roles', [RoleController::class, 'index']);
});
