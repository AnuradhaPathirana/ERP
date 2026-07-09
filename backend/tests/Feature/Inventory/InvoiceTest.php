<?php

declare(strict_types=1);

namespace Tests\Feature\Inventory;

use App\Models\User;
use App\Services\SettingsService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Inventory\Models\CustomerMaster;
use Modules\Inventory\Models\GoodsReceivedNote;
use Modules\Inventory\Models\GoodsReceivedNoteItem;
use Modules\Inventory\Models\GrnItemPiece;
use Modules\Inventory\Models\Product;
use Modules\Inventory\Models\SalesOrder;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class InvoiceTest extends TestCase
{
    use RefreshDatabase;

    private User $user;
    private CustomerMaster $customer;

    protected function setUp(): void
    {
        parent::setUp();

        app(SettingsService::class)->set('module.inventory', true);
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        $permissions = [
            'view_sales_orders', 'create_sales_orders', 'edit_sales_orders', 'delete_sales_orders',
            'view_delivery_orders', 'create_delivery_orders', 'edit_delivery_orders', 'delete_delivery_orders',
            'view_invoices', 'create_invoices', 'edit_invoices', 'delete_invoices',
        ];
        foreach ($permissions as $perm) {
            Permission::create(['name' => $perm, 'guard_name' => 'web']);
        }

        $this->user = User::factory()->create(['active_modules' => ['inventory']]);
        $this->user->givePermissionTo($permissions);

        $this->customer = CustomerMaster::create([
            'customer_code' => 'CUS-0001',
            'customer_name' => 'Test Customer',
            'customer_type' => 'Retail',
        ]);
    }

    /** @return array{so: SalesOrder, pieces: array<GrnItemPiece>} */
    private function makeConfirmedSoWithRolls(
        array $weights = [10.0, 20.0],
        float $unitPrice = 1000.0,
        float $discount = 0,
        float $transport = 0,
    ): array {
        static $seq = 0;
        $seq++;

        $product = Product::factory()->create();

        $grn = GoodsReceivedNote::create([
            'grn_no'   => sprintf('GRN-INV-%04d', $seq),
            'grn_date' => '2026-07-01',
            'status'   => 'confirmed',
        ]);
        $grnItem = GoodsReceivedNoteItem::create([
            'grn_id'            => $grn->id,
            'product_id'        => $product->id,
            'quantity_received' => array_sum($weights),
            'unit_price'        => 400,
        ]);

        $pieces = [];
        foreach ($weights as $i => $weight) {
            $pieces[] = GrnItemPiece::create([
                'grn_item_id' => $grnItem->id,
                'grn_id'      => $grn->id,
                'product_id'  => $product->id,
                'piece_no'    => $i + 1,
                'weight'      => $weight,
                'piece_code'  => sprintf('%s-I001-P%03d', $grn->grn_no, $i + 1),
                'status'      => GrnItemPiece::STATUS_IN_STOCK,
            ]);
        }

        // Simulate the GRN-posted stock balance so DO confirm passes availability
        $pivot = \Modules\Inventory\Models\ProductLocationStore::firstOrCreate(
            ['product_id' => $product->id, 'store_id' => null, 'location_id' => null],
            ['current_stock' => 0],
        );
        $pivot->increment('current_stock', array_sum($weights));

        $response = $this->actingAs($this->user)->postJson('/api/v1/sales-orders', [
            'order_date'       => '2026-07-09',
            'customer_id'      => $this->customer->id,
            'sales_person_id'  => $this->user->id,
            'status'           => 'confirmed',
            'transport_charge' => $transport,
            'items'            => [[
                'product_id'  => $product->id,
                'unit_price'  => $unitPrice,
                'discount'    => $discount,
                'piece_codes' => array_map(fn (GrnItemPiece $p) => $p->piece_code, $pieces),
            ]],
        ]);
        $response->assertCreated();

        return ['so' => SalesOrder::findOrFail($response->json('data.id')), 'pieces' => $pieces];
    }

    /** Create + confirm a DO for a subset of the SO's rolls; returns the DO id. */
    private function makeConfirmedDo(SalesOrder $so, array $pieces): int
    {
        $doId = $this->actingAs($this->user)
            ->postJson('/api/v1/delivery-orders', [
                'so_id'         => $so->id,
                'delivery_date' => '2026-07-10',
                'items'         => [[
                    'so_item_id' => $so->items()->first()->id,
                    'piece_ids'  => array_map(fn (GrnItemPiece $p) => $p->id, $pieces),
                ]],
            ])->json('data.id');

        $this->actingAs($this->user)
            ->patchJson("/api/v1/delivery-orders/{$doId}/status", ['status' => 'confirmed'])
            ->assertOk();

        return $doId;
    }

    // ── Auth & permissions ──────────────────────────────────────────────────

    public function test_unauthenticated_request_is_rejected(): void
    {
        $this->getJson('/api/v1/invoices')->assertUnauthorized();
    }

    public function test_user_without_view_permission_is_forbidden(): void
    {
        $restricted = User::factory()->create(['active_modules' => ['inventory']]);

        $this->actingAs($restricted)
            ->getJson('/api/v1/invoices')
            ->assertForbidden();
    }

    // ── Create from DO ──────────────────────────────────────────────────────

    public function test_invoice_from_confirmed_do_copies_qty_and_so_prices(): void
    {
        ['so' => $so, 'pieces' => $pieces] = $this->makeConfirmedSoWithRolls([10.0, 20.0], unitPrice: 1000, discount: 10, transport: 500);
        $doId = $this->makeConfirmedDo($so, $pieces);

        $this->actingAs($this->user)
            ->postJson('/api/v1/invoices', ['do_id' => $doId, 'invoice_date' => '2026-07-11'])
            ->assertCreated()
            ->assertJsonPath('data.invoice_no', 'INV-' . now()->year . '-0001')
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonPath('data.items.0.quantity', 30)
            ->assertJsonPath('data.items.0.unit_price', 1000)
            ->assertJsonPath('data.items.0.discount', 10)
            // 30 * 1000 = 30000 gross, -10% = 27000, + transport 500 (first invoice of the SO)
            ->assertJsonPath('data.subtotal', 30000)
            ->assertJsonPath('data.transport_charge', 500)
            ->assertJsonPath('data.grand_total', 27500);
    }

    public function test_invoice_from_draft_do_is_rejected(): void
    {
        ['so' => $so, 'pieces' => $pieces] = $this->makeConfirmedSoWithRolls();

        $doId = $this->actingAs($this->user)
            ->postJson('/api/v1/delivery-orders', [
                'so_id'         => $so->id,
                'delivery_date' => '2026-07-10',
                'items'         => [[
                    'so_item_id' => $so->items()->first()->id,
                    'piece_ids'  => array_map(fn ($p) => $p->id, $pieces),
                ]],
            ])->json('data.id');

        $this->actingAs($this->user)
            ->postJson('/api/v1/invoices', ['do_id' => $doId, 'invoice_date' => '2026-07-11'])
            ->assertStatus(422);
    }

    public function test_second_invoice_for_same_do_is_rejected_and_cancellation_frees_it(): void
    {
        ['so' => $so, 'pieces' => $pieces] = $this->makeConfirmedSoWithRolls();
        $doId = $this->makeConfirmedDo($so, $pieces);

        $invoiceId = $this->actingAs($this->user)
            ->postJson('/api/v1/invoices', ['do_id' => $doId, 'invoice_date' => '2026-07-11'])
            ->json('data.id');

        $this->actingAs($this->user)
            ->postJson('/api/v1/invoices', ['do_id' => $doId, 'invoice_date' => '2026-07-11'])
            ->assertStatus(422);

        $this->actingAs($this->user)
            ->patchJson("/api/v1/invoices/{$invoiceId}/status", ['status' => 'cancelled'])
            ->assertOk();

        $this->actingAs($this->user)
            ->postJson('/api/v1/invoices', ['do_id' => $doId, 'invoice_date' => '2026-07-11'])
            ->assertCreated();
    }

    // ── Direct-SO invoices & billing-mode exclusion ─────────────────────────

    public function test_direct_so_invoice_bills_all_lines(): void
    {
        ['so' => $so] = $this->makeConfirmedSoWithRolls([10.0, 20.0], unitPrice: 1000, transport: 250);

        $this->actingAs($this->user)
            ->postJson('/api/v1/invoices', ['so_id' => $so->id, 'invoice_date' => '2026-07-11'])
            ->assertCreated()
            ->assertJsonPath('data.do_id', null)
            ->assertJsonPath('data.items.0.quantity', 30)
            ->assertJsonPath('data.transport_charge', 250);
    }

    public function test_direct_invoice_blocked_when_per_do_invoice_exists(): void
    {
        ['so' => $so, 'pieces' => $pieces] = $this->makeConfirmedSoWithRolls();
        $doId = $this->makeConfirmedDo($so, $pieces);

        $this->actingAs($this->user)
            ->postJson('/api/v1/invoices', ['do_id' => $doId, 'invoice_date' => '2026-07-11'])
            ->assertCreated();

        $this->actingAs($this->user)
            ->postJson('/api/v1/invoices', ['so_id' => $so->id, 'invoice_date' => '2026-07-11'])
            ->assertStatus(422);
    }

    public function test_per_do_invoice_blocked_when_direct_invoice_exists(): void
    {
        ['so' => $so, 'pieces' => $pieces] = $this->makeConfirmedSoWithRolls();

        $this->actingAs($this->user)
            ->postJson('/api/v1/invoices', ['so_id' => $so->id, 'invoice_date' => '2026-07-11'])
            ->assertCreated();

        $doId = $this->makeConfirmedDo($so->fresh(), $pieces);

        $this->actingAs($this->user)
            ->postJson('/api/v1/invoices', ['do_id' => $doId, 'invoice_date' => '2026-07-11'])
            ->assertStatus(422);
    }

    public function test_second_direct_invoice_is_rejected(): void
    {
        ['so' => $so] = $this->makeConfirmedSoWithRolls();

        $this->actingAs($this->user)
            ->postJson('/api/v1/invoices', ['so_id' => $so->id, 'invoice_date' => '2026-07-11'])
            ->assertCreated();

        $this->actingAs($this->user)
            ->postJson('/api/v1/invoices', ['so_id' => $so->id, 'invoice_date' => '2026-07-11'])
            ->assertStatus(422);
    }

    public function test_direct_invoice_from_draft_so_is_rejected(): void
    {
        $product = Product::factory()->create();

        $soId = $this->actingAs($this->user)->postJson('/api/v1/sales-orders', [
            'order_date'      => '2026-07-09',
            'customer_id'     => $this->customer->id,
            'sales_person_id' => $this->user->id,
            'status'          => 'draft',
            'items'           => [['product_id' => $product->id, 'quantity' => 5, 'unit_price' => 100]],
        ])->json('data.id');

        $this->actingAs($this->user)
            ->postJson('/api/v1/invoices', ['so_id' => $soId, 'invoice_date' => '2026-07-11'])
            ->assertStatus(422);
    }

    // ── Transport default ───────────────────────────────────────────────────

    public function test_transport_defaults_to_so_transport_on_first_invoice_only(): void
    {
        ['so' => $so, 'pieces' => $pieces] = $this->makeConfirmedSoWithRolls([10.0, 20.0], transport: 800);

        // First DO ships one roll, second DO ships the other
        $do1 = $this->makeConfirmedDo($so, [$pieces[0]]);
        $do2 = $this->makeConfirmedDo($so->fresh(), [$pieces[1]]);

        $this->actingAs($this->user)
            ->postJson('/api/v1/invoices', ['do_id' => $do1, 'invoice_date' => '2026-07-11'])
            ->assertCreated()
            ->assertJsonPath('data.transport_charge', 800);

        $this->actingAs($this->user)
            ->postJson('/api/v1/invoices', ['do_id' => $do2, 'invoice_date' => '2026-07-12'])
            ->assertCreated()
            ->assertJsonPath('data.transport_charge', 0);
    }

    public function test_transport_override_is_respected(): void
    {
        ['so' => $so, 'pieces' => $pieces] = $this->makeConfirmedSoWithRolls(transport: 800);
        $doId = $this->makeConfirmedDo($so, $pieces);

        $this->actingAs($this->user)
            ->postJson('/api/v1/invoices', ['do_id' => $doId, 'invoice_date' => '2026-07-11', 'transport_charge' => 123])
            ->assertCreated()
            ->assertJsonPath('data.transport_charge', 123);
    }

    // ── Status transitions & immutability ───────────────────────────────────

    public function test_status_flow_draft_issued_paid_with_timestamps(): void
    {
        ['so' => $so, 'pieces' => $pieces] = $this->makeConfirmedSoWithRolls();
        $doId = $this->makeConfirmedDo($so, $pieces);

        $invoiceId = $this->actingAs($this->user)
            ->postJson('/api/v1/invoices', ['do_id' => $doId, 'invoice_date' => '2026-07-11'])
            ->json('data.id');

        // draft → paid is illegal
        $this->actingAs($this->user)
            ->patchJson("/api/v1/invoices/{$invoiceId}/status", ['status' => 'paid'])
            ->assertStatus(422);

        $issued = $this->actingAs($this->user)
            ->patchJson("/api/v1/invoices/{$invoiceId}/status", ['status' => 'issued'])
            ->assertOk();
        $this->assertNotNull($issued->json('data.issued_at'));

        $paid = $this->actingAs($this->user)
            ->patchJson("/api/v1/invoices/{$invoiceId}/status", ['status' => 'paid'])
            ->assertOk();
        $this->assertNotNull($paid->json('data.paid_at'));

        // paid is terminal
        $this->actingAs($this->user)
            ->patchJson("/api/v1/invoices/{$invoiceId}/status", ['status' => 'cancelled'])
            ->assertStatus(422);
    }

    public function test_issued_invoice_is_immutable(): void
    {
        ['so' => $so, 'pieces' => $pieces] = $this->makeConfirmedSoWithRolls();
        $doId = $this->makeConfirmedDo($so, $pieces);

        $invoiceId = $this->actingAs($this->user)
            ->postJson('/api/v1/invoices', ['do_id' => $doId, 'invoice_date' => '2026-07-11'])
            ->json('data.id');
        $this->actingAs($this->user)
            ->patchJson("/api/v1/invoices/{$invoiceId}/status", ['status' => 'issued'])
            ->assertOk();

        $this->actingAs($this->user)
            ->putJson("/api/v1/invoices/{$invoiceId}", ['invoice_date' => '2026-07-12'])
            ->assertStatus(422);

        $this->actingAs($this->user)
            ->deleteJson("/api/v1/invoices/{$invoiceId}")
            ->assertStatus(422);
    }

    public function test_draft_edit_reprices_lines_and_recalculates_totals(): void
    {
        ['so' => $so, 'pieces' => $pieces] = $this->makeConfirmedSoWithRolls([10.0, 20.0], unitPrice: 1000);
        $doId = $this->makeConfirmedDo($so, $pieces);

        $created = $this->actingAs($this->user)
            ->postJson('/api/v1/invoices', ['do_id' => $doId, 'invoice_date' => '2026-07-11'])
            ->assertCreated();
        $invoiceId = $created->json('data.id');
        $soItemId  = $created->json('data.items.0.so_item_id');

        $this->actingAs($this->user)
            ->putJson("/api/v1/invoices/{$invoiceId}", [
                'invoice_date'     => '2026-07-11',
                'transport_charge' => 100,
                'items'            => [[
                    'so_item_id' => $soItemId,
                    'unit_price' => 1100,
                    'discount'   => 5,
                ]],
            ])
            ->assertOk()
            ->assertJsonPath('data.items.0.unit_price', 1100)
            // 30 * 1100 = 33000, -5% = 31350, +100 transport
            ->assertJsonPath('data.grand_total', 31450);
    }

    public function test_next_invoice_no_preview(): void
    {
        $this->actingAs($this->user)
            ->getJson('/api/v1/invoices/next-invoice-no')
            ->assertOk()
            ->assertJsonPath('data', 'INV-' . now()->year . '-0001');
    }

    public function test_billing_source_endpoints_return_previews(): void
    {
        ['so' => $so, 'pieces' => $pieces] = $this->makeConfirmedSoWithRolls();
        $doId = $this->makeConfirmedDo($so, $pieces);

        $this->actingAs($this->user)
            ->getJson("/api/v1/invoices/billing-source/do/{$doId}")
            ->assertOk()
            ->assertJsonPath('data.source', 'do')
            ->assertJsonPath('data.guards.blocked', false)
            ->assertJsonPath('data.items.0.quantity', 30);

        $this->actingAs($this->user)
            ->getJson("/api/v1/invoices/billing-source/so/{$so->id}")
            ->assertOk()
            ->assertJsonPath('data.source', 'so');
    }
}
