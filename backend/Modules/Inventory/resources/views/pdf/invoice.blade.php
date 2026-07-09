<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
<title>Invoice — {{ $invoice->invoice_no }}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DejaVu Sans', Arial, sans-serif; font-size: 8.5pt; color: #1e293b; background: #fff; }
  .page { padding: 20px 24px 14px; }
  .header { width: 100%; margin-bottom: 10px; }
  .header table { width: 100%; }
  .doc-title { font-size: 15pt; font-weight: 700; color: #111827; letter-spacing: 0.2px; white-space: nowrap; }
  .doc-meta { margin-top: 6px; border-collapse: collapse; }
  .doc-meta td { font-size: 7.8pt; padding: 2px 0; white-space: nowrap; text-align: left; }
  .meta-label { color: #475569; padding-left: 4px; }
  .meta-value { font-weight: 700; color: #111827; padding-left: 3px; }
  .ta-r { text-align: right; }
  .party-title { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #111827; border-bottom: 1px solid #111827; padding-bottom: 2px; margin-bottom: 4px; }
  .party-line { font-size: 8pt; color: #334155; line-height: 1.5; }
  .party-name { font-weight: 700; color: #111827; }
  .party-row { width: 100%; margin-bottom: 10px; }
  .party-row table { width: 100%; }
  .items-table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  .items-table th { background: #e2e8f0; color: #111827; font-size: 7.3pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; padding: 5px 4px; border-bottom: 1px solid #cbd5e1; text-align: left; }
  .items-table td { font-size: 8pt; padding: 4px; border-bottom: 1px solid #f1f5f9; vertical-align: top; color: #1e293b; }
  .mono { font-family: 'DejaVu Sans Mono', monospace; font-size: 7.5pt; color: #475569; }
  .totals-box { width: 230px; float: right; border-collapse: collapse; margin-top: 6px; }
  .totals-box td { font-size: 8.5pt; padding: 2.5px 4px; }
  .totals-box .totals-sep td { border-top: 1.5px solid #111827; font-size: 10pt; font-weight: 700; padding-top: 5px; }
  .amount-words { font-size: 8pt; font-weight: 700; color: #111827; margin-top: 8px; }
  .sig-table { width: 100%; border-collapse: collapse; margin-top: 52px; }
  .sig-table td { text-align: center; padding: 0 10px; vertical-align: bottom; width: 50%; }
  .sig-line { border-top: 1px dotted #94a3b8; padding-top: 3px; font-size: 7.5pt; color: #475569; }
  .footer { border-top: 1px solid #e2e8f0; margin-top: 16px; padding-top: 8px; font-size: 6.8pt; color: #94a3b8; text-align: center; clear: both; }
</style>
</head>
<body>
<div class="page">

  @php
    $totalQty = $invoice->items->sum(fn ($it) => (float) $it->quantity);
    $gross    = $invoice->items->sum(fn ($it) => (float) $it->quantity * (float) $it->unit_price);
    $discount = $invoice->items->sum(fn ($it) => (float) $it->quantity * (float) $it->unit_price * ((float) $it->discount / 100));
    $tax      = $invoice->items->sum(fn ($it) => (float) $it->quantity * (float) $it->unit_price * ((float) $it->tax / 100));
    $amountInWords = \Modules\Inventory\Support\NumberToWords::convert((float) $invoice->grand_total, '');
  @endphp

  <div class="header">
    <table>
      <tr>
        <td style="width:55%; vertical-align:top;">
          <div class="party-title">Bill To</div>
          <div class="party-line party-name">{{ $invoice->customer?->customer_name ?? '—' }}</div>
          <div class="party-line">{{ $invoice->delivery_address ?? '—' }}</div>
        </td>
        <td style="width:45%; vertical-align:top;">
          <div class="doc-title">INVOICE</div>
          <table class="doc-meta">
            <tr>
              <td class="meta-label" style="padding-left:0;">Invoice No :</td>
              <td class="meta-value">{{ $invoice->invoice_no }}</td>
              <td class="meta-label">Date :</td>
              <td class="meta-value">{{ $invoice->invoice_date?->format('Y-m-d') }}</td>
            </tr>
            <tr>
              <td class="meta-label" style="padding-left:0;">SO No :</td>
              <td class="meta-value">{{ $invoice->salesOrder?->so_no ?? '—' }}</td>
              <td class="meta-label">DO No :</td>
              <td class="meta-value">{{ $invoice->deliveryOrder?->do_no ?? 'Direct' }}</td>
            </tr>
            <tr>
              <td class="meta-label" style="padding-left:0;">Status :</td>
              <td class="meta-value">{{ $invoice->status->label() }}</td>
              <td class="meta-label">Due :</td>
              <td class="meta-value">{{ $invoice->due_date?->format('Y-m-d') ?? '—' }}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>

  <table class="items-table">
    <thead>
      <tr>
        <th style="width:24px;">#</th>
        <th style="width:80px;">Code</th>
        <th>Product</th>
        <th style="width:65px;">Colour</th>
        <th style="width:45px;">UOM</th>
        <th style="width:65px;" class="ta-r">Qty</th>
        <th style="width:70px;" class="ta-r">Unit Price</th>
        <th style="width:45px;" class="ta-r">Disc%</th>
        <th style="width:42px;" class="ta-r">Tax%</th>
        <th style="width:80px;" class="ta-r">Amount</th>
      </tr>
    </thead>
    <tbody>
      @foreach($invoice->items as $i => $item)
        <tr>
          <td>{{ $i + 1 }}</td>
          <td class="mono">{{ $item->product?->product_code }}</td>
          <td>{{ $item->product?->name }}</td>
          <td>{{ $item->attribute?->attribute_name ?? '—' }}</td>
          <td>{{ $item->unit?->name ?? '—' }}</td>
          <td class="ta-r">{{ number_format((float) $item->quantity, 2) }}</td>
          <td class="ta-r">{{ number_format((float) $item->unit_price, 2) }}</td>
          <td class="ta-r">{{ (float) $item->discount > 0 ? number_format((float) $item->discount, 2) : '—' }}</td>
          <td class="ta-r">{{ (float) $item->tax > 0 ? number_format((float) $item->tax, 2) : '—' }}</td>
          <td class="ta-r">{{ number_format((float) $item->line_total, 2) }}</td>
        </tr>
      @endforeach
    </tbody>
  </table>

  <table class="totals-box">
    <tr>
      <td>Gross</td>
      <td class="ta-r">{{ number_format($gross, 2) }}</td>
    </tr>
    @if($discount > 0)
    <tr>
      <td>Discount</td>
      <td class="ta-r">-{{ number_format($discount, 2) }}</td>
    </tr>
    @endif
    @if($tax > 0)
    <tr>
      <td>Tax</td>
      <td class="ta-r">+{{ number_format($tax, 2) }}</td>
    </tr>
    @endif
    <tr>
      <td>Transport</td>
      <td class="ta-r">{{ number_format((float) $invoice->transport_charge, 2) }}</td>
    </tr>
    <tr class="totals-sep">
      <td>Total</td>
      <td class="ta-r">{{ number_format((float) $invoice->grand_total, 2) }}</td>
    </tr>
  </table>

  <div style="clear:both;"></div>
  <div class="amount-words">Amount in words: {{ $amountInWords }}</div>
  <div class="party-line" style="margin-top:2px;">Total quantity: {{ number_format($totalQty, 2) }}</div>

  <table class="sig-table">
    <tr>
      <td><div class="sig-line">Authorised Signature</div></td>
      <td><div class="sig-line">Customer Signature</div></td>
    </tr>
  </table>

  <div class="footer">
    Generated on {{ now()->format('Y-m-d H:i') }} — {{ $invoice->invoice_no }}
  </div>

</div>
</body>
</html>
