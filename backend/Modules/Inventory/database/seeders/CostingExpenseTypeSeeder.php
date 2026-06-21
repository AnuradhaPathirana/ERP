<?php

declare(strict_types=1);

namespace Modules\Inventory\Database\Seeders;

use Illuminate\Database\Seeder;
use Modules\Inventory\Models\CostingExpenseType;

class CostingExpenseTypeSeeder extends Seeder
{
    public function run(): void
    {
        $types = [
            // FOB expenses
            ['name' => 'Inland Freight',     'costing_type' => 'fob', 'sort_order' => 1],
            ['name' => 'Port Charges',        'costing_type' => 'fob', 'sort_order' => 2],
            ['name' => 'Export Customs Duty', 'costing_type' => 'fob', 'sort_order' => 3],
            ['name' => 'Bank Charges',        'costing_type' => 'fob', 'sort_order' => 4],
            ['name' => 'Documentation Fees',  'costing_type' => 'fob', 'sort_order' => 5],

            // CIF expenses
            ['name' => 'Ocean Freight',                   'costing_type' => 'cif', 'sort_order' => 1],
            ['name' => 'Marine Insurance',                'costing_type' => 'cif', 'sort_order' => 2],
            ['name' => 'Import Customs Duty',             'costing_type' => 'cif', 'sort_order' => 3],
            ['name' => 'Port Handling Charges',           'costing_type' => 'cif', 'sort_order' => 4],
            ['name' => 'Inland Transport to Warehouse',   'costing_type' => 'cif', 'sort_order' => 5],
            ['name' => 'Inspection & Quarantine Fees',    'costing_type' => 'cif', 'sort_order' => 6],
            ['name' => 'Import Bank Charges',             'costing_type' => 'cif', 'sort_order' => 7],
        ];

        foreach ($types as $type) {
            CostingExpenseType::firstOrCreate(
                ['name' => $type['name'], 'costing_type' => $type['costing_type']],
                ['is_active' => true, 'sort_order' => $type['sort_order']],
            );
        }
    }
}
