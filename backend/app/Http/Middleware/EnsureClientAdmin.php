<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureClientAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        // super_admin can do everything client_admin can
        if (! $request->user()?->hasAnyRole(['super_admin', 'client_admin'])) {
            return response()->json(
                ['message' => 'This action requires client admin privileges.'],
                Response::HTTP_FORBIDDEN,
            );
        }

        return $next($request);
    }
}
