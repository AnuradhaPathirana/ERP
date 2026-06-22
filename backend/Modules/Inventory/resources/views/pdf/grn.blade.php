<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
<title>GRN — {{ $grn->grn_no }}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DejaVu Sans', Arial, sans-serif; font-size: 8.5pt; color: #1e293b; background: #fff; }

  /* ── Page layout ── */
  .page { padding: 18px 22px 14px; }

  /* ── Header ── */
  .header { width: 100%; border-bottom: 2.5px solid #4f46e5; padding-bottom: 10px; margin-bottom: 10px; }
  .header table { width: 100%; }
  .company-name { font-size: 17pt; font-weight: 700; color: #4f46e5; letter-spacing: 0.5px; }
  .company-sub  { font-size: 8pt; color: #64748b; margin-top: 1px; }
  .doc-title    { font-size: 15pt; font-weight: 700; color: #1e293b; text-align: right; letter-spacing: 0.3px; }
  .doc-badge    { display: inline-block; background: {{ $grn->status->value === 'confirmed' ? '#dcfce7' : '#fef9c3' }}; color: {{ $grn->status->value === 'confirmed' ? '#166534' : '#854d0e' }}; font-size: 7.5pt; font-weight: 700; padding: 2px 8px; border-radius: 4px; border: 1px solid {{ $grn->status->value === 'confirmed' ? '#86efac' : '#fde047' }}; text-align: right; margin-top: 4px; }

  /* ── Info boxes ── */
  .info-row { width: 100%; margin-bottom: 8px; }
  .info-row table { width: 100%; }
  .info-box { border: 1px solid #e2e8f0; border-radius: 5px; padding: 7px 10px; vertical-align: top; }
  .info-box-title { font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #6366f1; border-bottom: 1px solid #e0e7ff; padding-bottom: 3px; margin-bottom: 5px; }
  .info-row-item { width: 100%; margin-bottom: 2.5px; }
  .info-row-item td { font-size: 7.5pt; vertical-align: top; line-height: 1.4; }
  .info-label { color: #64748b; width: 90px; }
  .info-value { color: #1e293b; font-weight: 600; }

  /* ── Items table ── */
  .items-wrap { margin-bottom: 8px; }
  .items-table { width: 100%; border-collapse: collapse; }
  .items-table th { background: #4f46e5; color: #fff; font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; padding: 5px 4px; border: none; }
  .items-table td { font-size: 7.5pt; padding: 4px; border-bottom: 1px solid #f1f5f9; vertical-align: top; color: #1e293b; }
  .items-table tr:nth-child(even) td { background: #f8fafc; }
  .items-table tr:last-child td { border-bottom: 1px solid #cbd5e1; }
  .ta-r  { text-align: right; }
  .ta-c  { text-align: center; }
  .mono  { font-family: 'DejaVu Sans Mono', monospace; font-size: 7pt; color: #6366f1; }
  .bold  { font-weight: 700; }
  .amber { color: #b45309; }
  .green { color: #15803d; }

  /* ── Totals ── */
  .totals-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  .totals-table td { font-size: 8pt; padding: 2.5px 5px; }
  .totals-sep { border-top: 1.5px solid #4f46e5; }
  .totals-net-label { font-size: 9pt; font-weight: 700; color: #4f46e5; text-align: right; }
  .totals-net-value { font-size: 11pt; font-weight: 700; color: #4f46e5; text-align: right; }

  /* ── Remarks ── */
  .remarks-box { border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 10px; margin-bottom: 8px; }
  .remarks-label { font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.7px; color: #64748b; margin-bottom: 3px; }
  .remarks-text { font-size: 8pt; color: #334155; }

  /* ── Signatures ── */
  .sig-table { width: 100%; border-collapse: collapse; margin-top: 18px; }
  .sig-table td { text-align: center; padding: 0 8px; vertical-align: bottom; }
  .sig-line { border-top: 1px solid #94a3b8; padding-top: 4px; margin-top: 30px; font-size: 7.5pt; color: #475569; }
  .sig-name { font-size: 7pt; color: #94a3b8; margin-top: 1px; }

  /* ── Footer ── */
  .footer { border-top: 1px solid #e2e8f0; margin-top: 10px; padding-top: 6px; font-size: 6.5pt; color: #94a3b8; text-align: center; }
  .footer b { color: #6366f1; }
</style>
</head>
<body>
<div class="page">

  {{-- ══ HEADER ══════════════════════════════════════════════ --}}
  <div class="header">
    <table>
      <tr>
        <td style="width:60%; vertical-align:bottom;">
          <div class="company-name">{{ config('app.company_name', 'Your Fabric Company') }}</div>
          <div class="company-sub">{{ config('app.company_address', '123 Textile Avenue, Fabric District') }} &nbsp;|&nbsp; {{ config('app.company_phone', '+1 (000) 000-0000') }}</div>
          <div class="company-sub">{{ config('app.company_email', 'info@yourcompany.com') }}</div>
        </td>
        <td style="width:40%; text-align:right; vertical-align:bottom;">
          <div class="doc-title">GOODS RECEIVED NOTE</div>
          <div class="doc-badge">{{ strtoupper($grn->status->label()) }}</div>
        </td>
      </tr>
    </table>
  </div>

  {{-- ══ GRN INFO + SUPPLIER ════════════════════════════════ --}}
  <div class="info-row">
    <table>
      <tr>
        {{-- GRN Details --}}
        <td style="width:48%;" class="info-box">
          <div class="info-box-title">GRN Details</div>
          <table class="info-row-item">
            <tr><td class="info-label">GRN No.</td><td class="info-value">{{ $grn->grn_no }}</td></tr>
            @if($grn->reference_no)
            <tr><td class="info-label">Reference No.</td><td class="info-value">{{ $grn->reference_no }}</td></tr>
            @endif
            <tr><td class="info-label">GRN Date</td><td class="info-value">{{ $grn->grn_date?->format('d M Y') }}</td></tr>
            @if($grn->transaction_date)
            <tr><td class="info-label">Transaction Date</td><td class="info-value">{{ $grn->transaction_date?->format('d M Y') }}</td></tr>
            @endif
            @if($grn->purchaseOrder)
            <tr><td class="info-label">PO Reference</td><td class="info-value">{{ $grn->purchaseOrder->po_no }}</td></tr>
            @endif
            @if($grn->payment_terms)
            <tr><td class="info-label">Payment Terms</td><td class="info-value">{{ ucfirst(str_replace('_', ' ', $grn->payment_terms)) }}</td></tr>
            @endif
            @if($grn->store)
            <tr><td class="info-label">Store</td><td class="info-value">{{ $grn->store->store_name }}</td></tr>
            @endif
          </table>
        </td>
        <td style="width:4%;"></td>
        {{-- Supplier Details --}}
        <td style="width:48%;" class="info-box">
          <div class="info-box-title">Supplier Details</div>
          @if($grn->supplier)
          <table class="info-row-item">
            <tr><td class="info-label">Supplier Name</td><td class="info-value">{{ $grn->supplier->supplier_name ?? $grn->supplier->name }}</td></tr>
            @if($grn->supplier->supplier_code)
            <tr><td class="info-label">Supplier Code</td><td class="info-value">{{ $grn->supplier->supplier_code }}</td></tr>
            @endif
            @if($grn->supplier->email ?? null)
            <tr><td class="info-label">Email</td><td class="info-value">{{ $grn->supplier->email }}</td></tr>
            @endif
            @if($grn->supplier->phone ?? null)
            <tr><td class="info-label">Phone</td><td class="info-value">{{ $grn->supplier->phone }}</td></tr>
            @endif
            @if($grn->supplier->address ?? null)
            <tr><td class="info-label">Address</td><td class="info-value">{{ $grn->supplier->address }}</td></tr>
            @endif
          </table>
          @else
          <p style="font-size:7.5pt;color:#94a3b8;">No supplier linked.</p>
          @endif
        </td>
      </tr>
    </table>
  </div>

  {{-- ══ ITEMS TABLE ════════════════════════════════════════ --}}
  <div class="items-wrap">
    <table class="items-table">
      <thead>
        <tr>
          <th class="ta-c"  style="width:22px;">#</th>
          <th style="width:60px;">Code</th>
          <th>Description / Item</th>
          <th class="ta-c"  style="width:36px;">Batch</th>
          <th class="ta-r"  style="width:42px;">PO Qty</th>
          <th class="ta-r"  style="width:48px;">Rcvd Qty</th>
          <th class="ta-c"  style="width:28px;">Unit</th>
          <th class="ta-r"  style="width:52px;">Unit Price</th>
          <th class="ta-c"  style="width:30px;">Disc%</th>
          <th class="ta-c"  style="width:30px;">Tax%</th>
          <th class="ta-r"  style="width:60px;">Total</th>
        </tr>
      </thead>
      <tbody>
        @foreach($grn->items as $i => $item)
        <tr>
          <td class="ta-c" style="color:#64748b;">{{ $i + 1 }}</td>
          <td class="mono">{{ $item->product?->product_code ?? '—' }}</td>
          <td>
            <span class="bold">{{ $item->product?->name ?? '—' }}</span>
            @if($item->product?->description ?? null)
            <br><span style="font-size:6.5pt;color:#64748b;">{{ Str::limit($item->product->description, 60) }}</span>
            @endif
          </td>
          <td class="ta-c" style="font-size:7pt;color:#6366f1;">{{ $item->batch_no ?? '—' }}</td>
          <td class="ta-r">{{ $item->po_item_id ? number_format((float)$item->quantity_ordered, 2) : '—' }}</td>
          <td class="ta-r bold">{{ number_format((float)$item->quantity_received, 2) }}</td>
          <td class="ta-c" style="font-size:7pt;color:#64748b;">{{ $item->unit?->name ?? $item->unit?->unit_name ?? '—' }}</td>
          <td class="ta-r">{{ number_format((float)$item->unit_price, 2) }}</td>
          <td class="ta-c amber">{{ $item->discount > 0 ? number_format((float)$item->discount, 1).'%' : '—' }}</td>
          <td class="ta-c green">{{ $item->tax > 0 ? number_format((float)$item->tax, 1).'%' : '—' }}</td>
          <td class="ta-r bold">{{ number_format((float)$item->line_total, 2) }}</td>
        </tr>
        @endforeach
      </tbody>
    </table>
  </div>

  {{-- ══ TOTALS ══════════════════════════════════════════════ --}}
  @php
    $gross    = $grn->items->sum(fn($it) => (float)$it->quantity_received * (float)$it->unit_price);
    $discount = $grn->items->sum(fn($it) => (float)$it->quantity_received * (float)$it->unit_price * ((float)$it->discount / 100));
    $tax      = $grn->items->sum(fn($it) => (float)$it->quantity_received * (float)$it->unit_price * ((float)$it->tax / 100));
    $net      = (float)$grn->total_amount;
  @endphp
  <table class="totals-table">
    <tr>
      <td style="width:65%;"></td>
      <td style="width:20%; text-align:right; color:#475569;">Gross Amount</td>
      <td style="width:15%; text-align:right; font-weight:600;">{{ number_format($gross, 2) }}</td>
    </tr>
    @if($discount > 0)
    <tr>
      <td></td>
      <td style="text-align:right; color:#b45309;">Total Discount</td>
      <td style="text-align:right; font-weight:600; color:#b45309;">- {{ number_format($discount, 2) }}</td>
    </tr>
    @endif
    @if($tax > 0)
    <tr>
      <td></td>
      <td style="text-align:right; color:#15803d;">Total Tax</td>
      <td style="text-align:right; font-weight:600; color:#15803d;">+ {{ number_format($tax, 2) }}</td>
    </tr>
    @endif
    <tr class="totals-sep">
      <td></td>
      <td class="totals-net-label">NET TOTAL</td>
      <td class="totals-net-value">{{ number_format($net, 2) }}</td>
    </tr>
  </table>

  {{-- ══ REMARKS ══════════════════════════════════════════════ --}}
  @if($grn->remarks)
  <div class="remarks-box">
    <div class="remarks-label">Remarks</div>
    <div class="remarks-text">{{ $grn->remarks }}</div>
  </div>
  @endif

  {{-- ══ SIGNATURES ══════════════════════════════════════════ --}}
  <table class="sig-table">
    <tr>
      <td>
        <div class="sig-line">Received By</div>
        <div class="sig-name">Name &amp; Date</div>
      </td>
      <td>
        <div class="sig-line">Checked By</div>
        <div class="sig-name">Name &amp; Date</div>
      </td>
      <td>
        <div class="sig-line">Store Manager</div>
        <div class="sig-name">Name &amp; Date</div>
      </td>
      <td>
        <div class="sig-line">Approved By</div>
        <div class="sig-name">Name &amp; Date</div>
      </td>
    </tr>
  </table>

  {{-- ══ FOOTER ══════════════════════════════════════════════ --}}
  <div class="footer">
    <b>{{ config('app.company_name', 'Your Fabric Company') }}</b> &nbsp;·&nbsp;
    This document is computer generated. &nbsp;·&nbsp;
    Printed: {{ now()->format('d M Y H:i') }} &nbsp;·&nbsp;
    GRN No: {{ $grn->grn_no }}
  </div>

</div>
</body>
</html>
