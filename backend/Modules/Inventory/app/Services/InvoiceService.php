<?php

declare(strict_types=1);

namespace Modules\Inventory\Services;

use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Modules\Inventory\DTOs\InvoiceData;
use Modules\Inventory\Enums\DeliveryOrderStatus;
use Modules\Inventory\Enums\InvoiceStatus;
use Modules\Inventory\Enums\SalesOrderStatus;
use Modules\Inventory\Models\Company;
use Modules\Inventory\Models\DeliveryOrder;
use Modules\Inventory\Models\Invoice;
use Modules\Inventory\Models\InvoiceItem;
use Modules\Inventory\Models\SalesOrder;
use Modules\Inventory\Models\SalesOrderItem;

/**
 * Invoices bill either one confirmed delivery order (do_id set, 1:1) or a
 * whole sales order directly (do_id null, advance billing). An SO's billing
 * mode is fixed by its first non-cancelled invoice — the two modes never mix.
 */
class InvoiceService
{
    /** @param array<string, mixed> $filters */
    public function paginate(int $perPage = 50, array $filters = []): LengthAwarePaginator
    {
        $query = Invoice::with(['customer', 'salesOrder', 'deliveryOrder'])
            ->orderByDesc('invoice_date')
            ->orderByDesc('id');

        if (!empty($filters['search'])) {
            $term = '%' . $filters['search'] . '%';
            $query->where(function ($q) use ($term): void {
                $q->where('invoice_no', 'like', $term)
                  ->orWhereHas('salesOrder', fn ($s) => $s->where('so_no', 'like', $term))
                  ->orWhereHas('customer', fn ($c) => $c->where('customer_name', 'like', $term));
            });
        }

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['customer_id'])) {
            $query->where('customer_id', (int) $filters['customer_id']);
        }

        if (!empty($filters['so_id'])) {
            $query->where('so_id', (int) $filters['so_id']);
        }

        if (!empty($filters['date_from'])) {
            $query->whereDate('invoice_date', '>=', $filters['date_from']);
        }

        if (!empty($filters['date_to'])) {
            $query->whereDate('invoice_date', '<=', $filters['date_to']);
        }

        return $query->paginate($perPage);
    }

    public function find(int $id): Invoice
    {
        return Invoice::with([
            'items.product',
            'items.unit',
            'items.attribute',
            'salesOrder',
            'deliveryOrder',
            'customer',
            'company',
        ])->findOrFail($id);
    }

    /** Lock-free preview; the real number is generated inside the create transaction. */
    public function nextInvoiceNo(): string
    {
        return $this->buildInvoiceNo(lock: false);
    }

    /**
     * Billing preview for a direct-SO (advance) invoice.
     *
     * @return array<string, mixed>
     */
    public function billingSourceForSo(int $soId): array
    {
        $so = SalesOrder::with(['items.product', 'items.unit', 'items.attribute', 'customer'])
            ->findOrFail($soId);

        return [
            'source'      => 'so',
            'sales_order' => $this->soSummary($so),
            'guards'      => $this->billingGuards($so, forDirect: true),
            'default_transport_charge' => $this->defaultTransportCharge($so),
            'items'       => $so->items->map(fn (SalesOrderItem $item) => $this->itemPreview($item, (float) $item->quantity, null))->values()->all(),
        ];
    }

    /**
     * Billing preview for a per-DO invoice.
     *
     * @return array<string, mixed>
     */
    public function billingSourceForDo(int $doId): array
    {
        $do = DeliveryOrder::with(['items.soItem', 'salesOrder.customer', 'salesOrder.items'])
            ->findOrFail($doId);

        $so = $do->salesOrder;

        return [
            'source'         => 'do',
            'delivery_order' => [
                'id'     => $do->id,
                'do_no'  => $do->do_no,
                'status' => $do->status->value,
            ],
            'sales_order' => $this->soSummary($so),
            'guards'      => $this->billingGuards($so, forDirect: false, do: $do),
            'default_transport_charge' => $this->defaultTransportCharge($so),
            'items'       => $do->items
                ->map(fn ($doItem) => $this->itemPreview($doItem->soItem, (float) $doItem->quantity, $doItem->id))
                ->values()
                ->all(),
        ];
    }

    public function create(InvoiceData $data): Invoice
    {
        if ($data->doId !== null) {
            return $this->createFromDo($data->doId, $data);
        }
        if ($data->soId !== null) {
            return $this->createFromSo($data->soId, $data);
        }

        abort(422, 'An invoice must reference a delivery order or a sales order.');
    }

    public function update(Invoice $invoice, InvoiceData $data): Invoice
    {
        return DB::transaction(function () use ($invoice, $data): Invoice {
            $invoice = Invoice::whereKey($invoice->id)->lockForUpdate()->firstOrFail();

            if (!$invoice->status->isEditable()) {
                abort(422, 'Only draft invoices can be edited.');
            }

            $invoice->update([
                'invoice_date'     => $data->invoiceDate,
                'due_date'         => $data->dueDate,
                'transport_charge' => $data->transportCharge ?? $invoice->transport_charge,
                'company_id'       => $data->companyId ?? $invoice->company_id,
                'delivery_address' => $data->deliveryAddress,
                'remarks'          => $data->remarks,
                'mode_of_payment'  => $data->modeOfPayment,
            ]);

            // Draft re-pricing: quantities are fixed by the source document;
            // only price/discount/tax/remarks may change per line.
            if ($data->items !== []) {
                $overrides = collect($data->items)->keyBy('so_item_id');

                foreach ($invoice->items as $item) {
                    $override = $overrides->get($item->so_item_id);
                    if (!$override) {
                        continue;
                    }

                    $item->unit_price = isset($override['unit_price']) ? (float) $override['unit_price'] : $item->unit_price;
                    $item->discount   = isset($override['discount'])   ? (float) $override['discount']   : $item->discount;
                    $item->tax        = isset($override['tax'])        ? (float) $override['tax']        : $item->tax;
                    $item->remarks    = $override['remarks'] ?? $item->remarks;
                    $this->recalculateLineTotal($item);
                }
            }

            $this->recalculateTotals($invoice);

            return $this->find($invoice->id);
        });
    }

    public function updateStatus(Invoice $invoice, string $status): Invoice
    {
        $newStatus = InvoiceStatus::from($status);

        $allowedTransitions = [
            InvoiceStatus::Draft->value  => [InvoiceStatus::Issued, InvoiceStatus::Cancelled],
            InvoiceStatus::Issued->value => [InvoiceStatus::Paid, InvoiceStatus::Cancelled],
        ];

        $allowed = $allowedTransitions[$invoice->status->value] ?? [];
        if (!in_array($newStatus, $allowed)) {
            abort(422, "Cannot transition invoice from {$invoice->status->label()} to {$newStatus->label()}.");
        }

        $invoice->update([
            'status'    => $newStatus,
            'issued_at' => $newStatus === InvoiceStatus::Issued ? now() : $invoice->issued_at,
            'paid_at'   => $newStatus === InvoiceStatus::Paid ? now() : $invoice->paid_at,
        ]);

        return $invoice;
    }

    public function delete(Invoice $invoice): void
    {
        if ($invoice->status !== InvoiceStatus::Draft) {
            abort(422, 'Only draft invoices can be deleted.');
        }

        DB::transaction(function () use ($invoice): void {
            $invoice->items()->delete();
            $invoice->delete();
        });
    }

    private function createFromDo(int $doId, InvoiceData $data): Invoice
    {
        return DB::transaction(function () use ($doId, $data): Invoice {
            $do = DeliveryOrder::with(['items.soItem'])
                ->whereKey($doId)
                ->lockForUpdate()
                ->firstOrFail();

            if ($do->status !== DeliveryOrderStatus::Confirmed) {
                abort(422, 'Only confirmed delivery orders can be invoiced.');
            }

            if ($this->doHasLiveInvoice($do->id)) {
                abort(422, 'This delivery order is already invoiced.');
            }

            $so = SalesOrder::findOrFail($do->so_id);

            if ($this->soHasLiveDirectInvoice($so->id)) {
                abort(422, "Sales order {$so->so_no} is billed directly — per-delivery invoices are not allowed.");
            }

            $invoice = Invoice::create([
                'invoice_no'       => $this->buildInvoiceNo(lock: true),
                'so_id'            => $so->id,
                'do_id'            => $do->id,
                'customer_id'      => $so->customer_id,
                'company_id'       => $data->companyId ?? $this->defaultCompanyId(),
                'invoice_date'     => $data->invoiceDate,
                'due_date'         => $data->dueDate,
                'status'           => InvoiceStatus::Draft,
                'transport_charge' => $data->transportCharge ?? $this->defaultTransportCharge($so),
                'delivery_address' => $data->deliveryAddress ?? $do->delivery_address,
                'remarks'          => $data->remarks,
                'mode_of_payment'  => $data->modeOfPayment,
                'created_by'       => Auth::id(),
                'subtotal'         => 0,
                'grand_total'      => 0,
            ]);

            foreach ($do->items as $doItem) {
                $soItem = $doItem->soItem;
                $item   = new InvoiceItem([
                    'invoice_id'   => $invoice->id,
                    'so_item_id'   => $doItem->so_item_id,
                    'do_item_id'   => $doItem->id,
                    'product_id'   => $doItem->product_id,
                    'unit_id'      => $doItem->unit_id,
                    'attribute_id' => $doItem->attribute_id,
                    'quantity'     => (float) $doItem->quantity,
                    'unit_price'   => (float) ($soItem?->unit_price ?? 0),
                    'discount'     => (float) ($soItem?->discount ?? 0),
                    'tax'          => (float) ($soItem?->tax ?? 0),
                ]);
                $this->recalculateLineTotal($item);
            }

            $this->recalculateTotals($invoice);

            return $this->find($invoice->id);
        });
    }

    private function createFromSo(int $soId, InvoiceData $data): Invoice
    {
        return DB::transaction(function () use ($soId, $data): Invoice {
            $so = SalesOrder::with('items')
                ->whereKey($soId)
                ->lockForUpdate()
                ->firstOrFail();

            if (!in_array($so->status, [SalesOrderStatus::Confirmed, SalesOrderStatus::Completed])) {
                abort(422, 'Only confirmed or completed sales orders can be invoiced.');
            }

            if ($this->soHasLivePerDoInvoice($so->id)) {
                abort(422, "Sales order {$so->so_no} already has per-delivery invoices — direct billing is not allowed.");
            }

            if ($this->soHasLiveDirectInvoice($so->id)) {
                abort(422, "Sales order {$so->so_no} already has a direct invoice.");
            }

            $invoice = Invoice::create([
                'invoice_no'       => $this->buildInvoiceNo(lock: true),
                'so_id'            => $so->id,
                'do_id'            => null,
                'customer_id'      => $so->customer_id,
                'company_id'       => $data->companyId ?? $this->defaultCompanyId(),
                'invoice_date'     => $data->invoiceDate,
                'due_date'         => $data->dueDate,
                'status'           => InvoiceStatus::Draft,
                'transport_charge' => $data->transportCharge ?? (float) $so->transport_charge,
                'delivery_address' => $data->deliveryAddress ?? $so->delivery_address,
                'remarks'          => $data->remarks,
                'mode_of_payment'  => $data->modeOfPayment,
                'created_by'       => Auth::id(),
                'subtotal'         => 0,
                'grand_total'      => 0,
            ]);

            foreach ($so->items as $soItem) {
                $item = new InvoiceItem([
                    'invoice_id'   => $invoice->id,
                    'so_item_id'   => $soItem->id,
                    'do_item_id'   => null,
                    'product_id'   => $soItem->product_id,
                    'unit_id'      => $soItem->unit_id,
                    'attribute_id' => $soItem->attribute_id,
                    'quantity'     => (float) $soItem->quantity,
                    'unit_price'   => (float) $soItem->unit_price,
                    'discount'     => (float) $soItem->discount,
                    'tax'          => (float) $soItem->tax,
                ]);
                $this->recalculateLineTotal($item);
            }

            $this->recalculateTotals($invoice);

            return $this->find($invoice->id);
        });
    }

    private function buildInvoiceNo(bool $lock): string
    {
        $year   = now()->year;
        $prefix = "INV-{$year}-";

        $query = Invoice::withTrashed()
            ->where('invoice_no', 'like', $prefix . '%')
            ->orderByDesc('id');

        if ($lock) {
            $query->lockForUpdate();
        }

        $last = $query->value('invoice_no');
        $next = $last ? (int) substr($last, strlen($prefix)) + 1 : 1;

        return $prefix . str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }

    /** SO transport is billed once — on the SO's first non-cancelled invoice. */
    private function defaultTransportCharge(SalesOrder $so): float
    {
        $hasLiveInvoice = Invoice::where('so_id', $so->id)
            ->where('status', '!=', InvoiceStatus::Cancelled->value)
            ->exists();

        return $hasLiveInvoice ? 0.0 : (float) $so->transport_charge;
    }

    /**
     * A tax invoice has to name its supplier, so an invoice is never left without a
     * company. Where the caller does not say which, adopt the earliest — correct for
     * the single-company deployments, and re-pointable per invoice for the rest.
     */
    private function defaultCompanyId(): ?int
    {
        $id = Company::query()->orderBy('id')->value('id');

        return $id !== null ? (int) $id : null;
    }

    private function doHasLiveInvoice(int $doId): bool
    {
        return Invoice::where('do_id', $doId)
            ->where('status', '!=', InvoiceStatus::Cancelled->value)
            ->exists();
    }

    private function soHasLiveDirectInvoice(int $soId): bool
    {
        return Invoice::where('so_id', $soId)
            ->whereNull('do_id')
            ->where('status', '!=', InvoiceStatus::Cancelled->value)
            ->exists();
    }

    private function soHasLivePerDoInvoice(int $soId): bool
    {
        return Invoice::where('so_id', $soId)
            ->whereNotNull('do_id')
            ->where('status', '!=', InvoiceStatus::Cancelled->value)
            ->exists();
    }

    private function recalculateLineTotal(InvoiceItem $item): void
    {
        $gross = (float) $item->quantity * (float) $item->unit_price;

        $item->line_total = $gross
            - ($gross * (float) $item->discount / 100)
            + ($gross * (float) $item->tax / 100);

        $item->save();
    }

    private function recalculateTotals(Invoice $invoice): void
    {
        $invoice->refresh();
        $subtotal   = (float) $invoice->items()->sum(DB::raw('quantity * unit_price'));
        $lineTotals = (float) $invoice->items()->sum(DB::raw('line_total'));

        $invoice->update([
            'subtotal'    => $subtotal,
            'grand_total' => $lineTotals + (float) $invoice->transport_charge,
        ]);
    }

    /** @return array<string, mixed> */
    private function soSummary(SalesOrder $so): array
    {
        return [
            'id'               => $so->id,
            'so_no'            => $so->so_no,
            'status'           => $so->status->value,
            'transport_charge' => (float) $so->transport_charge,
            'delivery_address' => $so->delivery_address,
            'customer'         => $so->customer ? [
                'id'   => $so->customer->id,
                'name' => $so->customer->customer_name,
            ] : null,
        ];
    }

    /** @return array<string, mixed> */
    private function billingGuards(SalesOrder $so, bool $forDirect, ?DeliveryOrder $do = null): array
    {
        return [
            'so_confirmed_or_completed' => in_array($so->status, [SalesOrderStatus::Confirmed, SalesOrderStatus::Completed]),
            'do_confirmed'              => $do ? $do->status === DeliveryOrderStatus::Confirmed : null,
            'do_already_invoiced'       => $do ? $this->doHasLiveInvoice($do->id) : null,
            'has_direct_invoice'        => $this->soHasLiveDirectInvoice($so->id),
            'has_per_do_invoices'       => $this->soHasLivePerDoInvoice($so->id),
            'blocked'                   => $forDirect
                ? $this->soHasLivePerDoInvoice($so->id) || $this->soHasLiveDirectInvoice($so->id)
                : ($do && ($this->doHasLiveInvoice($do->id) || $this->soHasLiveDirectInvoice($so->id))),
        ];
    }

    /** @return array<string, mixed> */
    private function itemPreview(?SalesOrderItem $soItem, float $quantity, ?int $doItemId): array
    {
        return [
            'so_item_id' => $soItem?->id,
            'do_item_id' => $doItemId,
            'product'    => $soItem?->product ? [
                'id'           => $soItem->product->id,
                'name'         => $soItem->product->name,
                'product_code' => $soItem->product->product_code,
            ] : null,
            'unit'       => $soItem?->unit ? ['id' => $soItem->unit->id, 'name' => $soItem->unit->name] : null,
            'attribute'  => $soItem?->attribute ? ['id' => $soItem->attribute->id, 'name' => $soItem->attribute->attribute_name] : null,
            'quantity'   => $quantity,
            'unit_price' => (float) ($soItem?->unit_price ?? 0),
            'discount'   => (float) ($soItem?->discount ?? 0),
            'tax'        => (float) ($soItem?->tax ?? 0),
        ];
    }
}
