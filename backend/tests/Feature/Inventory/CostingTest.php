<?php

declare(strict_types=1);

namespace Tests\Feature\Inventory;

use App\Models\User;
use App\Services\SettingsService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Modules\Inventory\Models\Costing;
use Modules\Inventory\Models\CostingExpenseType;
use Modules\Inventory\Models\GoodsReceivedNote;
use Modules\Inventory\Models\GoodsReceivedNoteItem;
use Modules\Inventory\Models\Product;
use Modules\Inventory\Models\SalesChannel;
use Modules\Inventory\Models\SupplierMaster;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

/**
 * Costing redesign: per-product landed-cost breakdown.
 *   portion = Σexpenses ÷ Σqty ; landed = grn unit_price + portion
 *   selling = landed + margin → +SSCL% → +VAT% (per-costing toggles)
 * Confirm keeps the one-GRN-per-confirmed-costing lock and mirrors
 * landed/selling onto the product price list.
 */
class CostingTest extends TestCase
{
    use RefreshDatabase;

    private User $user;
    private SupplierMaster $supplier;
    private CostingExpenseType $freight;

    protected function setUp(): void
    {
        parent::setUp();

        app(SettingsService::class)->set('module.inventory', true);
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        foreach (['view_costings', 'create_costings', 'edit_costings', 'confirm_costings', 'delete_costings'] as $perm) {
            Permission::create(['name' => $perm, 'guard_name' => 'web']);
        }

        $this->user = User::factory()->create(['active_modules' => ['inventory']]);
        $this->user->givePermissionTo(['view_costings', 'create_costings', 'edit_costings', 'confirm_costings', 'delete_costings']);

        $this->supplier = SupplierMaster::create([
            'supplier_code' => 'SUP-0001',
            'supplier_name' => 'Costing Supplier',
        ]);

        $this->freight = CostingExpenseType::create([
            'name'         => 'Freight Charges',
            'costing_type' => 'fob',
            'is_active'    => true,
            'sort_order'   => 1,
        ]);
    }

    /** Confirmed GRN with a single item line. */
    private function makeGrn(Product $product, float $qty, float $unitPrice): array
    {
        static $seq = 0;
        $seq++;

        $grn = GoodsReceivedNote::create([
            'grn_no'      => sprintf('GRN-CT-%04d', $seq),
            'grn_date'    => '2026-07-01',
            'supplier_id' => $this->supplier->id,
            'status'      => 'confirmed',
        ]);

        $item = GoodsReceivedNoteItem::create([
            'grn_id'            => $grn->id,
            'product_id'        => $product->id,
            'quantity_received' => $qty,
            'unit_price'        => $unitPrice,
        ]);

        return ['grn' => $grn, 'item' => $item];
    }

    /** @param array<string, mixed> $overrides */
    private function validPayload(array $grnIds, array $overrides = []): array
    {
        return array_merge([
            'supplier_id'        => $this->supplier->id,
            'costing_type'       => 'fob',
            'grn_ids'            => $grnIds,
            'transaction_date'   => '2026-07-10',
            'default_margin_pct' => 0,
            'apply_sscl'         => false,
            'sscl_pct'           => 2.5,
            'apply_vat'          => false,
            'vat_pct'            => 18,
            'expenses'           => [],
            'items'              => [],
        ], $overrides);
    }

    private function givePriceList(Product $product, ?float $selling, ?float $cost = null): int
    {
        $channel = SalesChannel::firstOrCreate(['sales_channel_name' => 'Default']);

        return (int) DB::table('inv_product_sales_channels')->insertGetId([
            'product_id'       => $product->id,
            'sales_channel_id' => $channel->id,
            'cost_price'       => $cost,
            'selling_price'    => $selling,
            'created_at'       => now(),
            'updated_at'       => now(),
        ]);
    }

    // ── Auth ────────────────────────────────────────────────────────────────

    public function test_unauthenticated_request_is_rejected(): void
    {
        $this->getJson('/api/v1/costings')->assertUnauthorized();
    }

    public function test_user_without_permission_is_forbidden(): void
    {
        $restricted = User::factory()->create(['active_modules' => ['inventory']]);

        $this->actingAs($restricted)->getJson('/api/v1/costings')->assertForbidden();
    }

    // ── Breakdown math ──────────────────────────────────────────────────────

    public function test_create_apportions_charges_per_unit_and_applies_default_margin(): void
    {
        $productA = Product::factory()->create();
        $productB = Product::factory()->create();
        $grnA = $this->makeGrn($productA, qty: 10, unitPrice: 1000);
        $grnB = $this->makeGrn($productB, qty: 10, unitPrice: 1100);

        // portion = 4000 / 20 = 200 ; landed A = 1200, B = 1300 ; margin 10%
        $response = $this->actingAs($this->user)
            ->postJson('/api/v1/costings', $this->validPayload(
                [$grnA['grn']->id, $grnB['grn']->id],
                [
                    'default_margin_pct' => 10,
                    'expenses'           => [['expense_type_id' => $this->freight->id, 'amount' => 4000]],
                ],
            ))
            ->assertCreated();

        $items = collect($response->json('data.items'))->keyBy('grn_item_id');

        $a = $items[$grnA['item']->id];
        $this->assertEquals(200.0, $a['charge_portion']);
        $this->assertEquals(1200.0, $a['landed_unit_cost']);
        $this->assertEquals(120.0, $a['margin_amount']);
        $this->assertEquals(1320.0, $a['selling_price']);

        $b = $items[$grnB['item']->id];
        $this->assertEquals(1300.0, $b['landed_unit_cost']);
        $this->assertEquals(1430.0, $b['selling_price']);

        // Header totals derived from the lines
        $this->assertEquals(21000.0, $response->json('data.material_cost'));      // 10×1000 + 10×1100
        $this->assertEquals(25000.0, $response->json('data.total_landed_cost'));  // +4000 spread
        $this->assertEquals(27500.0, $response->json('data.total_price_with_vat')); // 10×1320 + 10×1430
    }

    public function test_single_common_charge_amount_replaces_itemised_expenses(): void
    {
        $product = Product::factory()->create();
        $grn = $this->makeGrn($product, qty: 20, unitPrice: 1000);

        // One typed total (6000 over 20 units → 300/unit) — no expense rows
        $response = $this->actingAs($this->user)
            ->postJson('/api/v1/costings', $this->validPayload(
                [$grn['grn']->id],
                ['common_charge_amount' => 6000, 'default_margin_pct' => 10],
            ))
            ->assertCreated();

        $item = $response->json('data.items.0');
        $this->assertEquals(300.0, $item['charge_portion']);
        $this->assertEquals(1300.0, $item['landed_unit_cost']);
        $this->assertEquals(1430.0, $item['selling_price']);
        $this->assertEquals(6000.0, $response->json('data.total_additional_expenses'));
    }

    public function test_sscl_and_vat_toggles_cascade_into_selling_price(): void
    {
        $product = Product::factory()->create();
        $grn = $this->makeGrn($product, qty: 10, unitPrice: 1000);

        // landed 1200, +10% margin = 1320, +2.5% SSCL = 1353, +18% VAT = 1596.54
        $response = $this->actingAs($this->user)
            ->postJson('/api/v1/costings', $this->validPayload(
                [$grn['grn']->id],
                [
                    'default_margin_pct' => 10,
                    'apply_sscl'         => true,
                    'apply_vat'          => true,
                    'expenses'           => [['expense_type_id' => $this->freight->id, 'amount' => 2000]],
                ],
            ))
            ->assertCreated();

        $item = $response->json('data.items.0');
        $this->assertEquals(33.0, $item['sscl_amount']);        // 1320 × 2.5%
        $this->assertEquals(243.54, $item['vat_amount']);       // 1353 × 18%
        $this->assertEquals(1596.54, $item['selling_price']);
        $this->assertTrue($response->json('data.apply_sscl'));
        $this->assertTrue($response->json('data.apply_vat'));
    }

    public function test_line_margin_override_and_typed_selling_price(): void
    {
        $product = Product::factory()->create();
        $grnA = $this->makeGrn($product, qty: 5, unitPrice: 1000);
        $grnB = $this->makeGrn($product, qty: 5, unitPrice: 1000);

        $response = $this->actingAs($this->user)
            ->postJson('/api/v1/costings', $this->validPayload(
                [$grnA['grn']->id, $grnB['grn']->id],
                [
                    'default_margin_pct' => 10,
                    'items'              => [
                        ['grn_item_id' => $grnA['item']->id, 'margin_pct' => 25],       // override %
                        ['grn_item_id' => $grnB['item']->id, 'selling_price' => 1500],  // typed price
                    ],
                ],
            ))
            ->assertCreated();

        $items = collect($response->json('data.items'))->keyBy('grn_item_id');

        $a = $items[$grnA['item']->id]; // landed 1000, margin 25%
        $this->assertEquals(25.0, $a['margin_pct']);
        $this->assertEquals(1250.0, $a['selling_price']);
        $this->assertFalse($a['is_price_overridden']);

        $b = $items[$grnB['item']->id]; // typed final price wins
        $this->assertEquals(1500.0, $b['selling_price']);
        $this->assertEquals(500.0, $b['margin_amount']); // back-computed
        $this->assertTrue($b['is_price_overridden']);
    }

    public function test_expenses_with_zero_quantity_rejected(): void
    {
        $product = Product::factory()->create();
        $grn = $this->makeGrn($product, qty: 0, unitPrice: 1000);

        $this->actingAs($this->user)
            ->postJson('/api/v1/costings', $this->validPayload(
                [$grn['grn']->id],
                ['expenses' => [['expense_type_id' => $this->freight->id, 'amount' => 1000]]],
            ))
            ->assertStatus(422);
    }

    // ── Lifecycle ───────────────────────────────────────────────────────────

    public function test_update_rebuilds_breakdown_and_is_draft_only(): void
    {
        $product = Product::factory()->create();
        $grn = $this->makeGrn($product, qty: 10, unitPrice: 1000);

        $created = $this->actingAs($this->user)
            ->postJson('/api/v1/costings', $this->validPayload([$grn['grn']->id], ['default_margin_pct' => 10]))
            ->assertCreated();
        $id = $created->json('data.id');

        // Re-save with a different margin — breakdown rebuilds
        $this->actingAs($this->user)
            ->putJson("/api/v1/costings/{$id}", $this->validPayload([$grn['grn']->id], ['default_margin_pct' => 20]))
            ->assertOk()
            ->assertJsonPath('data.items.0.selling_price', 1200);

        $this->actingAs($this->user)->postJson("/api/v1/costings/{$id}/confirm")->assertOk();

        $this->actingAs($this->user)
            ->putJson("/api/v1/costings/{$id}", $this->validPayload([$grn['grn']->id]))
            ->assertStatus(422);
    }

    public function test_confirm_syncs_price_list_and_locks_grn(): void
    {
        $product = Product::factory()->create();
        $pivotId = $this->givePriceList($product, selling: 999, cost: 900);
        $grn = $this->makeGrn($product, qty: 10, unitPrice: 1000);

        $created = $this->actingAs($this->user)
            ->postJson('/api/v1/costings', $this->validPayload(
                [$grn['grn']->id],
                [
                    'default_margin_pct' => 20,
                    'expenses'           => [['expense_type_id' => $this->freight->id, 'amount' => 1000]],
                ],
            ))
            ->assertCreated();

        $this->actingAs($this->user)
            ->postJson('/api/v1/costings/' . $created->json('data.id') . '/confirm')
            ->assertOk()
            ->assertJsonPath('data.status', 'confirmed');

        // landed 1100 → cost_price ; selling 1320 → selling_price
        $pivot = DB::table('inv_product_sales_channels')->find($pivotId);
        $this->assertSame(1100.0, (float) $pivot->cost_price);
        $this->assertSame(1320.0, (float) $pivot->selling_price);

        // The GRN is now locked — a second costing on it cannot confirm
        $second = $this->actingAs($this->user)
            ->postJson('/api/v1/costings', $this->validPayload([$grn['grn']->id]))
            ->assertCreated();

        $this->actingAs($this->user)
            ->postJson('/api/v1/costings/' . $second->json('data.id') . '/confirm')
            ->assertStatus(422);
    }

    // ── Preview ─────────────────────────────────────────────────────────────

    public function test_calculate_preview_returns_breakdown_without_persisting(): void
    {
        $product = Product::factory()->create();
        $grn = $this->makeGrn($product, qty: 10, unitPrice: 1000);

        $this->actingAs($this->user)
            ->postJson('/api/v1/costings/calculate-preview', [
                'grn_ids'            => [$grn['grn']->id],
                'default_margin_pct' => 10,
                'expenses'           => [['expense_type_id' => $this->freight->id, 'amount' => 2000]],
            ])
            ->assertOk()
            ->assertJsonPath('data.items.0.landed_unit_cost', 1200)
            ->assertJsonPath('data.items.0.selling_price', 1320)
            ->assertJsonPath('data.summary.total_price_with_vat', 13200);

        $this->assertSame(0, Costing::count());
    }
}
