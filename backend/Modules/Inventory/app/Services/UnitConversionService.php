<?php

declare(strict_types=1);

namespace Modules\Inventory\Services;

use Illuminate\Support\Facades\DB;
use Modules\Inventory\Models\UnitConversion;
use Modules\Inventory\Models\UnitType;

class UnitConversionService
{
    public function getByCategoryWithRates(int $categoryId): array
    {
        $unitTypes = UnitType::where('unit_category_id', $categoryId)
            ->orderBy('name')
            ->get(['id', 'name', 'symbol', 'created_at']);

        if ($unitTypes->isEmpty()) {
            return ['base_unit_id' => null, 'units' => []];
        }

        $unitIds = $unitTypes->pluck('id')->toArray();

        $conversions = UnitConversion::whereIn('from_unit_type_id', $unitIds)
            ->whereIn('to_unit_type_id', $unitIds)
            ->get();

        // Base unit = the from_unit_type_id appearing most often (N-1 times for N units)
        $baseUnitId = null;
        if ($conversions->isNotEmpty()) {
            $fromCounts = $conversions->groupBy('from_unit_type_id')->map->count();
            $baseUnitId = (int) $fromCounts->sortDesc()->keys()->first();
        }

        // Map: to_unit_type_id => multiplier (stored as base→other)
        $ratesFromBase = [];
        if ($baseUnitId) {
            $conversions
                ->where('from_unit_type_id', $baseUnitId)
                ->each(fn ($c) => $ratesFromBase[$c->to_unit_type_id] = (float) $c->multiplier);
        }

        $units = $unitTypes->map(fn ($unit) => [
            'id'         => $unit->id,
            'name'       => $unit->name,
            'symbol'     => $unit->symbol,
            'created_at' => $unit->created_at?->format('d/m/Y'),
            'is_base'    => $baseUnitId !== null && $unit->id === $baseUnitId,
            'rate'       => ($baseUnitId !== null && $unit->id !== $baseUnitId)
                ? ($ratesFromBase[$unit->id] ?? null)
                : null,
        ]);

        return [
            'base_unit_id' => $baseUnitId,
            'units'        => $units->values()->all(),
        ];
    }

    /**
     * Delete all existing conversions for the category and re-save.
     * Stores bidirectional pairs: base→unit (rate) and unit→base (1/rate).
     */
    public function saveRates(int $categoryId, int $baseUnitTypeId, array $rates): void
    {
        $unitIds = UnitType::where('unit_category_id', $categoryId)->pluck('id')->toArray();

        DB::transaction(function () use ($unitIds, $baseUnitTypeId, $rates): void {
            UnitConversion::whereIn('from_unit_type_id', $unitIds)
                ->whereIn('to_unit_type_id', $unitIds)
                ->delete();

            foreach ($rates as $rate) {
                $unitTypeId = (int) $rate['unit_type_id'];
                $multiplier = (float) $rate['rate'];

                if ($multiplier <= 0.0) {
                    continue;
                }

                UnitConversion::create([
                    'from_unit_type_id' => $baseUnitTypeId,
                    'to_unit_type_id'   => $unitTypeId,
                    'multiplier'        => $multiplier,
                ]);

                UnitConversion::create([
                    'from_unit_type_id' => $unitTypeId,
                    'to_unit_type_id'   => $baseUnitTypeId,
                    'multiplier'        => 1.0 / $multiplier,
                ]);
            }
        });
    }
}
