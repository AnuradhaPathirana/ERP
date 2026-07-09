<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
<title>DO — {{ $do->do_no }}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DejaVu Sans', Arial, sans-serif; font-size: 8.5pt; color: #1e293b; background: #fff; }
  .page { padding: 20px 24px 14px; }
  .header { width: 100%; margin-bottom: 10px; }
  .header table { width: 100%; }
  .company-name { font-size: 12pt; font-weight: 700; color: #111827; }
  .company-sub  { font-size: 7.5pt; color: #475569; margin-top: 1px; line-height: 1.4; }
  .doc-title    { font-size: 15pt; font-weight: 700; color: #111827; text-align: left; letter-spacing: 0.2px; white-space: nowrap; }
  .doc-meta { margin-top: 6px; border-collapse: collapse; }
  .doc-meta td { font-size: 7.8pt; padding: 2px 0; white-space: nowrap; text-align: left; }
  .meta-label { color: #475569; padding-left: 4px; }
  .meta-value { font-weight: 700; color: #111827; padding-left: 3px; }
  .ta-r { text-align: right; }
  .party-row { width: 100%; margin-bottom: 10px; }
  .party-row table { width: 100%; }
  .party-title { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #111827; border-bottom: 1px solid #111827; padding-bottom: 2px; margin-bottom: 4px; }
  .party-line { font-size: 8pt; color: #334155; line-height: 1.5; }
  .party-name { font-weight: 700; color: #111827; }
  .items-table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  .items-table th { background: #e2e8f0; color: #111827; font-size: 7.3pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; padding: 5px 4px; border-bottom: 1px solid #cbd5e1; text-align: left; }
  .items-table td { font-size: 8pt; padding: 4px; border-bottom: 1px solid #f1f5f9; vertical-align: top; color: #1e293b; }
  .items-table tfoot td { border-top: 1px solid #cbd5e1; border-bottom: none; font-weight: 700; padding-top: 5px; }
  .mono  { font-family: 'DejaVu Sans Mono', monospace; font-size: 7.5pt; color: #475569; }
  .rolls-table { width: 100%; border-collapse: collapse; margin: 2px 0 4px 16px; }
  .rolls-table td { font-size: 7.3pt; padding: 1.5px 4px; color: #475569; border-bottom: none; }
  .sig-table { width: 100%; border-collapse: collapse; margin-top: 46px; }
  .sig-table td { text-align: center; padding: 0 10px; vertical-align: bottom; width: 33%; }
  .sig-line { border-top: 1px dotted #94a3b8; padding-top: 3px; font-size: 7.5pt; color: #475569; }
  .footer { border-top: 1px solid #e2e8f0; margin-top: 16px; padding-top: 8px; font-size: 6.8pt; color: #94a3b8; text-align: center; }
</style>
</head>
<body>
<div class="page">

  @php
    $company  = $do->location?->company;
    $totalQty = $do->items->sum(fn ($it) => (float) $it->quantity);
    $totalRolls = $do->items->sum(fn ($it) => $it->pieces->count());
  @endphp

  <div class="header">
    <table>
      <tr>
        <td style="width:55%; vertical-align:top;">
          @if($company)
            <div class="company-name">{{ $company->company_name }}</div>
            <div class="company-sub">
              {{ collect([$company->street_address, $company->city, $company->state, $company->postal_zip_code])->filter()->implode(', ') }}
            </div>
          @endif
        </td>
        <td style="width:45%; vertical-align:top;">
          <div class="doc-title">DELIVERY ORDER</div>
          <table class="doc-meta">
            <tr>
              <td class="meta-label" style="padding-left:0;">DO No :</td>
              <td class="meta-value">{{ $do->do_no }}</td>
              <td class="meta-label">Date :</td>
              <td class="meta-value">{{ $do->delivery_date?->format('Y-m-d') }}</td>
            </tr>
            <tr>
              <td class="meta-label" style="padding-left:0;">SO No :</td>
              <td class="meta-value">{{ $do->salesOrder?->so_no ?? '—' }}</td>
              <td class="meta-label">Status :</td>
              <td class="meta-value">{{ $do->status->label() }}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>

  <div class="party-row">
    <table>
      <tr>
        <td style="width:48%; vertical-align:top; padding-right:14px;">
          <div class="party-title">Deliver To</div>
          <div class="party-line party-name">{{ $do->customer?->customer_name ?? '—' }}</div>
          <div class="party-line">{{ $do->delivery_address ?? '—' }}</div>
        </td>
        <td style="width:52%; vertical-align:top;">
          <div class="party-title">Transport</div>
          <div class="party-line">Driver: <span class="party-name">{{ $do->driver ? trim($do->driver->first_name . ' ' . $do->driver->last_name) : '—' }}</span></div>
          <div class="party-line">Vehicle: <span class="party-name">{{ $do->vehicle?->registration_number ?? '—' }}</span></div>
          @if($do->remarks)
            <div class="party-line">Remarks: {{ $do->remarks }}</div>
          @endif
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
        <th style="width:70px;">Colour</th>
        <th style="width:50px;">UOM</th>
        <th style="width:55px;" class="ta-r">Rolls</th>
        <th style="width:70px;" class="ta-r">Quantity</th>
      </tr>
    </thead>
    <tbody>
      @foreach($do->items as $i => $item)
        <tr>
          <td>{{ $i + 1 }}</td>
          <td class="mono">{{ $item->product?->product_code }}</td>
          <td>{{ $item->product?->name }}</td>
          <td>{{ $item->attribute?->attribute_name ?? '—' }}</td>
          <td>{{ $item->unit?->name ?? '—' }}</td>
          <td class="ta-r">{{ $item->pieces->count() ?: '—' }}</td>
          <td class="ta-r">{{ number_format((float) $item->quantity, 2) }}</td>
        </tr>
        @if($item->pieces->isNotEmpty())
          <tr>
            <td colspan="7" style="padding:0;">
              <table class="rolls-table">
                @foreach($item->pieces->chunk(3) as $chunk)
                  <tr>
                    @foreach($chunk as $piece)
                      <td class="mono">{{ $piece->piece_code }} — Roll {{ $piece->roll_no ?? '?' }} ({{ number_format((float) $piece->weight, 2) }})</td>
                    @endforeach
                  </tr>
                @endforeach
              </table>
            </td>
          </tr>
        @endif
      @endforeach
    </tbody>
    <tfoot>
      <tr>
        <td colspan="5">Total</td>
        <td class="ta-r">{{ $totalRolls ?: '—' }}</td>
        <td class="ta-r">{{ number_format($totalQty, 2) }}</td>
      </tr>
    </tfoot>
  </table>

  <table class="sig-table">
    <tr>
      <td><div class="sig-line">Prepared By</div></td>
      <td><div class="sig-line">Driver Signature</div></td>
      <td><div class="sig-line">Received By (Customer)</div></td>
    </tr>
  </table>

  <div class="footer">
    Generated on {{ now()->format('Y-m-d H:i') }} — {{ $do->do_no }}
  </div>

</div>
</body>
</html>
