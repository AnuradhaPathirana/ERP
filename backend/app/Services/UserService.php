<?php

declare(strict_types=1);

namespace App\Services;

use App\DTOs\UserData;
use App\Models\User;
use Illuminate\Pagination\LengthAwarePaginator;

class UserService
{
    public function paginate(int $perPage = 25): LengthAwarePaginator
    {
        return User::with('roles')->orderBy('name')->paginate($perPage);
    }

    public function find(User $user): User
    {
        return $user->load('roles');
    }

    public function create(UserData $data): User
    {
        $user = User::create([
            'name'           => $data->name,
            'email'          => $data->email,
            'active_modules' => $data->activeModules,
            'password'       => $data->password,
        ]);

        $user->syncRoles($data->roles);

        return $user->load('roles');
    }

    public function update(User $user, UserData $data): User
    {
        $attributes = [
            'name'           => $data->name,
            'email'          => $data->email,
            'active_modules' => $data->activeModules,
        ];

        if ($data->password !== null) {
            $attributes['password'] = $data->password;
        }

        $user->update($attributes);
        $user->syncRoles($data->roles);

        return $user->fresh('roles');
    }

    public function delete(User $user): void
    {
        $user->tokens()->delete();
        $user->delete();
    }
}
