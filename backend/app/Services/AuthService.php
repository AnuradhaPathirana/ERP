<?php

declare(strict_types=1);

namespace App\Services;

use App\DTOs\LoginData;
use App\Models\User;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Support\Facades\Hash;

class AuthService
{
    /**
     * @return array{token: string, tenant_id: string|null, active_modules: list<string>}
     * @throws AuthenticationException
     */
    public function login(LoginData $data): array
    {
        $user = User::where('email', $data->email)->first();

        if (! $user || ! Hash::check($data->password, $user->password)) {
            throw new AuthenticationException('The provided credentials are incorrect.');
        }

        $token = $user->createToken('api-token')->plainTextToken;

        return [
            'token' => $token,
            'tenant_id' => $user->tenant_id,
            'active_modules' => $user->active_modules ?? ['inventory'],
        ];
    }
}
