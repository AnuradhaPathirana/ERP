<?php

declare(strict_types=1);

namespace Modules\Inventory\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;
use Modules\Inventory\Models\SalesChannel;

class SalesChannelController extends Controller
{
    /** Flat list for dropdowns — id + name only. */
    public function all(): JsonResponse
    {
        $items = SalesChannel::orderBy('sales_channel_name')
            ->get(['id', 'sales_channel_name', 'type'])
            ->map(fn (SalesChannel $c) => [
                'id'   => $c->id,
                'name' => $c->sales_channel_name,
                'type' => $c->type?->value,
            ])
            ->values()
            ->all();

        return response()->json(['data' => $items]);
    }
}
