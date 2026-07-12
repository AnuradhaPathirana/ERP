import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Calculator,
  CheckCircle,
  ClipboardList,
  Package,
  RotateCcw,
  Save,
  Table2,
  X,
} from 'lucide-react'
import {
  confirmCosting,
  createCosting,
  getCosting,
  getNextDocumentNo,
  getNextReferenceNo,
  getSupplierGrns,
  updateCosting,
} from '../../api/costings'
import { getAllSuppliers } from '../../api/suppliers'
import Breadcrumb from '../../components/Breadcrumb'
import { confirmAction, showError, showSuccess } from '../../utils/alerts'
import { CURRENCY } from '../../utils/currency'
import Money from '../../components/ui/Money'

/* ── Style tokens ───────────────────────────────────────────── */
const INPUT_CLS  = 'block w-full rounded border-2 border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/15'
const INPUT_RO   = 'block w-full rounded border-2 border-slate-100 bg-slate-100 px-2 py-1 text-xs text-slate-500 outline-none cursor-default'
const SELECT_CLS = 'block w-full rounded border-2 border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-800 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/15 cursor-pointer'
const LABEL_CLS  = 'text-[10px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap'
const ERR_CLS    = 'mt-0.5 text-[10px] text-red-500'
const TABLE_INP  = 'block w-full rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs text-slate-800 outline-none transition-all focus:border-indigo-500 focus:bg-white'
const PCT_INP    = 'w-12 rounded border-2 border-slate-200 bg-slate-50 px-1 py-0.5 text-right text-xs outline-none focus:border-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400'

function SectionHeader({ icon: Icon, title, colorClass = 'text-indigo-700 bg-indigo-50 border-indigo-100', extra }) {
  return (
    <div className={`flex items-center justify-between gap-1.5 px-3 py-2 border-b ${colorClass}`}>
      <div className="flex items-center gap-1.5">
        {Icon && <Icon size={13} />}
        <h2 className="text-xs font-bold">{title}</h2>
      </div>
      {extra}
    </div>
  )
}

function FieldRow({ label, required, error, children }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className={LABEL_CLS}>{label}{required && <span className="text-red-500">*</span>}</span>
      <div className="min-w-0">{children}{error && <p className={ERR_CLS}>{error}</p>}</div>
    </div>
  )
}

function CheckToggle({ checked, onChange, label, disabled }) {
  return (
    <label className={`flex items-center gap-1 select-none ${disabled ? 'cursor-default opacity-70' : 'cursor-pointer'}`}>
      <span className={`flex h-3.5 w-3.5 items-center justify-center rounded border-2 transition-all ${checked ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300 bg-white'}`}
        onClick={() => !disabled && onChange(!checked)}>
        {checked && (
          <svg className="h-2 w-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500" onClick={() => !disabled && onChange(!checked)}>{label}</span>
    </label>
  )
}

/** Plain 2-dp number. Quantities and totals-in-words; money goes through <Money />. */
function fmt(n) {
  return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Quantity with its own unit symbol (Kg, m, Pcs…), honouring the unit's prefix/suffix position. */
function QtyUnit({ value, symbol, position }) {
  if (!symbol) return <>{fmt(value)}</>
  const tag = <span className="text-[9px] font-normal text-slate-400">{symbol}</span>
  return position === 'prefix'
    ? <>{tag}<span className="ml-0.5">{fmt(value)}</span></>
    : <>{fmt(value)}<span className="ml-0.5">{tag}</span></>
}

/** A per-unit money figure — reads "27,500.00 /Roll". */
function PerUnit({ value, symbol, className = '' }) {
  return (
    <span className={`tabular-nums ${className}`}>
      {fmt(value)}
      {symbol && <span className="ml-0.5 text-[9px] font-normal text-slate-400">/{symbol}</span>}
    </span>
  )
}

/**
 * Quantities only add up within one unit, so a mixed shipment gets one chip per unit
 * instead of a single total. 500 Kg + 10 Roll + 200 m is not 710 of anything.
 */
function qtyChips(items) {
  const groups = new Map()
  for (const i of items) {
    const symbol = i.unit_symbol || ''
    groups.set(symbol, (groups.get(symbol) ?? 0) + (parseFloat(i.quantity) || 0))
  }
  return [...groups.entries()].map(([symbol, qty]) => ({ symbol, qty }))
}

function QtyChips({ groups }) {
  if (groups.length === 0) return <span className="text-slate-400">—</span>
  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-1">
      {groups.map(({ symbol, qty }) => (
        <span key={symbol || '_'} className="rounded bg-slate-200/70 px-1 py-px text-[10px] font-semibold tabular-nums text-slate-700">
          {fmt(qty)}
          {symbol && <span className="ml-0.5 font-normal text-slate-500">{symbol}</span>}
        </span>
      ))}
    </span>
  )
}

/* ── Canonical per-line calculation (mirrors CostingService::computeBreakdown) ──
 * The shipment's one common charge is apportioned BY VALUE, never by quantity: a
 * shipment's lines can arrive in Kg, Rolls and metres, and Σqty over those is not a
 * number that means anything. Each line takes charge × (its value ÷ total value), then
 * divides that share by ITS OWN quantity — so the portion always lands denominated in
 * that line's unit and `unit_price + portion` stays a legal addition.
 *
 *   portion = charge × (line value ÷ Σ line value) ÷ line qty
 *   landed  = grn unit_price + portion
 *   selling = landed + margin → +SSCL% → +VAT% (cascading toggles)
 *
 * The build-up runs in the RECEIVING unit; ÷ conversion_factor restates it per the
 * product's stocking UOM, which is the price the customer actually pays. A typed
 * selling price is FINAL and is quoted per stocking UOM — the pieces back-compute. */
function calcBreakdown(lines, totalExpenses, cfg, overrides) {
  const valueOf    = (l) => (parseFloat(l.quantity) || 0) * (parseFloat(l.unit_price) || 0)
  const totalValue = lines.reduce((s, l) => s + valueOf(l), 0)
  const totalQty   = lines.reduce((s, l) => s + (parseFloat(l.quantity) || 0), 0)
  const mult       = (cfg.applySscl ? 1 + cfg.ssclPct / 100 : 1) * (cfg.applyVat ? 1 + cfg.vatPct / 100 : 1)
  // Value apportionment makes every line land at exactly this uplift over its GRN
  // price — the one figure that describes the whole shipment regardless of units.
  const upliftPct  = totalValue > 0 ? (totalExpenses / totalValue) * 100 : 0

  const items = lines.map((line) => {
    const qty       = parseFloat(line.quantity) || 0
    const unitPrice = parseFloat(line.unit_price) || 0
    const factor    = parseFloat(line.conversion_factor) || 1
    const baseQty   = parseFloat(line.base_quantity) || qty * factor

    const share   = totalValue > 0 ? totalExpenses * (valueOf(line) / totalValue) : 0
    const portion = qty > 0 ? share / qty : 0
    const landed  = unitPrice + portion

    const ov      = overrides[line.id] ?? {}
    const typed   = ov.selling_price_base !== undefined && ov.selling_price_base !== '' ? parseFloat(ov.selling_price_base) : null
    const linePct = ov.margin_pct !== undefined && ov.margin_pct !== '' ? parseFloat(ov.margin_pct) : null

    let marginAmount, ssclAmount, vatAmount, selling, overridden
    if (typed !== null && !Number.isNaN(typed)) {
      selling      = typed * factor // stocking UOM → receiving unit
      const base   = mult > 0 ? selling / mult : selling
      marginAmount = base - landed
      ssclAmount   = cfg.applySscl ? base * (cfg.ssclPct / 100) : 0
      vatAmount    = cfg.applyVat ? (base + ssclAmount) * (cfg.vatPct / 100) : 0
      overridden   = true
    } else {
      const pct    = linePct ?? cfg.defaultMarginPct
      marginAmount = landed * (pct / 100)
      const base   = landed + marginAmount
      ssclAmount   = cfg.applySscl ? base * (cfg.ssclPct / 100) : 0
      const after  = base + ssclAmount
      vatAmount    = cfg.applyVat ? after * (cfg.vatPct / 100) : 0
      selling      = after + vatAmount
      overridden   = false
    }

    const toBase = (p) => (factor > 0 ? p / factor : p)

    return {
      ...line,
      quantity:              qty,
      conversion_factor:     factor,
      base_quantity:         baseQty,
      charge_share:          share,
      charge_portion:        portion,
      landed_unit_cost:      landed,
      landed_unit_cost_base: toBase(landed),
      margin_pct:            linePct,
      margin_amount:         marginAmount,
      sscl_amount:           ssclAmount,
      vat_amount:            vatAmount,
      selling_price:         selling,
      selling_price_base:    toBase(selling),
      is_price_overridden:   overridden,
    }
  })

  const sum = (key) => items.reduce((s, i) => s + i.quantity * i[key], 0)

  return {
    items,
    totals: {
      qty:           totalQty,
      upliftPct,
      charges:       totalExpenses,
      purchaseValue: totalValue,
      landedValue:   sum('landed_unit_cost'),
      marginValue:   sum('margin_amount'),
      ssclValue:     sum('sscl_amount'),
      vatValue:      sum('vat_amount'),
      sellingValue:  sum('selling_price'),
    },
  }
}

/* ════════════════════════════════════════════════════════════ */
export default function CostingFormPage() {
  const { id }   = useParams()
  const isEdit   = Boolean(id) && !window.location.pathname.match(/^\/inventory\/costings\/\d+$/)
  const navigate = useNavigate()
  const today    = new Date().toISOString().slice(0, 10)

  const CRUMBS = [
    { label: 'Inventory', to: '/inventory/products' },
    { label: 'Costings', to: '/inventory/costings' },
    { label: isEdit ? 'Edit Costing' : id ? 'View Costing' : 'New Costing' },
  ]

  /* ── Core form state ──────────────────────────────────────── */
  const [form, setForm] = useState({
    supplier_id:          '',
    costing_type:         'fob',
    bill_of_lading:       '',
    expected_date:        '',
    transaction_date:     today,
    note:                 '',
    common_charge_amount: '', // one total FOB/CIF charge, spread per unit
    default_margin_pct:   '',
    apply_sscl:           false,
    sscl_pct:             2.5,
    apply_vat:            false,
    vat_pct:              18,
  })
  const [docNoPreview, setDocNoPreview] = useState('')
  const [refNoPreview, setRefNoPreview] = useState('')
  const [errors,       setErrors]       = useState({})

  /* ── GRN selection ────────────────────────────────────────── */
  const [supplierGrns,    setSupplierGrns]    = useState([])
  const [selectedGrnIds,  setSelectedGrnIds]  = useState(new Set())
  const [loadingGrns,     setLoadingGrns]     = useState(false)
  const [grnSearch,       setGrnSearch]       = useState('')
  // Already-linked GRNs for an existing costing — merged into supplier GRN list because
  // the "available" API excludes GRNs that belong to confirmed costings.
  const linkedGrnsRef = useRef([])

  /* ── Per-line overrides of the product breakdown ──────────── */
  // { [grn_item_id]: { margin_pct?: string, selling_price_base?: string } }
  // selling_price_base is per the product's stocking UOM, never the receiving unit.
  const [lineOverrides, setLineOverrides] = useState({})

  /* ── Derived data ─────────────────────────────────────────── */
  const filteredGrns  = grnSearch
    ? supplierGrns.filter((g) => g.grn_no?.toLowerCase().includes(grnSearch.toLowerCase()))
    : supplierGrns
  const selectedGrns  = supplierGrns.filter((g) => selectedGrnIds.has(g.id))
  const grnTotal      = selectedGrns.reduce((s, g) => s + (parseFloat(g.total_amount) || 0), 0)
  const totalExpenses = parseFloat(form.common_charge_amount) || 0

  // Every item line of the selected GRNs — the breakdown's raw input
  const grnLines = selectedGrns.flatMap((g) =>
    (g.items ?? []).map((it) => ({ ...it, grn_no: g.grn_no, grn_id: g.id }))
  )

  const breakdown = calcBreakdown(grnLines, totalExpenses, {
    defaultMarginPct: parseFloat(form.default_margin_pct) || 0,
    applySscl:        form.apply_sscl,
    ssclPct:          parseFloat(form.sscl_pct) || 0,
    applyVat:         form.apply_vat,
    vatPct:           parseFloat(form.vat_pct) || 0,
  }, lineOverrides)
  const { items: breakdownItems, totals } = breakdown

  // Quantities are additive only within a unit, so totals show one chip per unit.
  const qtyGroups = qtyChips(breakdownItems)
  // True when at least one line is received in a unit other than how it's stocked —
  // that's when the receiving → stocking restatement is worth the extra ink.
  const anyConverted = breakdownItems.some((i) => Math.abs((i.conversion_factor ?? 1) - 1) > 1e-9)

  /* ── Fetch suppliers list ─────────────────────────────────── */
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-all'],
    queryFn:  getAllSuppliers,
    staleTime: 5 * 60 * 1000,
  })

  /* ── Fetch auto-gen numbers on create ─────────────────────── */
  useEffect(() => {
    if (id) return
    getNextDocumentNo().then(setDocNoPreview).catch(() => setDocNoPreview('Auto-generated'))
    getNextReferenceNo().then(setRefNoPreview).catch(() => setRefNoPreview('Auto-generated'))
  }, [id])

  /* ── Load GRNs when supplier changes ─────────────────────── */
  useEffect(() => {
    if (!form.supplier_id) { setSupplierGrns([]); return }
    let cancelled = false
    setLoadingGrns(true)
    getSupplierGrns(form.supplier_id)
      .then((grns) => {
        if (cancelled) return
        const freshIds = new Set(grns.map((g) => g.id))
        const combined = [...grns, ...linkedGrnsRef.current.filter((g) => !freshIds.has(g.id))]
        setSupplierGrns(combined)
      })
      .catch(() => { if (!cancelled) showError('Could not load supplier GRNs.') })
      .finally(() => { if (!cancelled) setLoadingGrns(false) })
    return () => { cancelled = true }
  }, [form.supplier_id])

  /* ── Load existing costing in edit/view mode ──────────────── */
  const { data: existingData } = useQuery({
    queryKey: ['costing', id],
    queryFn:  () => getCosting(id),
    enabled:  Boolean(id),
  })

  useEffect(() => {
    if (!existingData?.data) return
    const c = existingData.data
    setDocNoPreview(c.document_no)
    setRefNoPreview(c.reference_no)
    setForm({
      supplier_id:          String(c.supplier_id),
      costing_type:         c.costing_type,
      bill_of_lading:       c.bill_of_lading ?? '',
      expected_date:        c.expected_date ?? '',
      transaction_date:     c.transaction_date ?? today,
      note:                 c.note ?? '',
      common_charge_amount: c.total_additional_expenses ? String(c.total_additional_expenses) : '',
      default_margin_pct:   c.default_margin_pct ?? '',
      apply_sscl:           Boolean(c.apply_sscl),
      sscl_pct:             c.sscl_pct,
      apply_vat:            Boolean(c.apply_vat),
      vat_pct:              c.vat_pct,
    })

    const linkedGrnIds = (c.costing_grns ?? []).map((cg) => cg.grn_id)
    setSelectedGrnIds(new Set(linkedGrnIds))

    // Rebuild each linked GRN's item lines from the stored breakdown so the
    // table works even when the "available" API no longer returns the GRN.
    const itemsByGrn = new Map()
    for (const item of c.items ?? []) {
      if (!itemsByGrn.has(item.grn_id)) itemsByGrn.set(item.grn_id, [])
      itemsByGrn.get(item.grn_id).push({
        id:                 item.grn_item_id,
        product_id:         item.product_id,
        product_name:       item.product_name,
        product_code:       item.product_code,
        color:              item.color,
        quantity:           item.quantity,
        unit_price:         item.unit_price,
        unit_symbol:        item.unit_symbol,
        unit_position:      item.unit_position,
        conversion_factor:  item.conversion_factor,
        base_quantity:      item.base_quantity,
        base_unit_symbol:   item.base_unit_symbol,
        base_unit_position: item.base_unit_position,
      })
    }
    linkedGrnsRef.current = (c.costing_grns ?? [])
      .filter((cg) => cg.grn)
      .map((cg) => ({
        id:           cg.grn_id,
        grn_no:       cg.grn.grn_no,
        grn_date:     cg.grn.grn_date,
        po_no:        null,
        total_amount: cg.grn.total_amount,
        total_items:  cg.grn.total_items ?? 0,
        items:        itemsByGrn.get(cg.grn_id) ?? [],
      }))

    // Restore per-line overrides (typed price wins over line margin). The typed price
    // round-trips in the stocking UOM — the same denomination it was entered in.
    const overrides = {}
    for (const item of c.items ?? []) {
      if (item.is_price_overridden) overrides[item.grn_item_id] = { selling_price_base: String(item.selling_price_base) }
      else if (item.margin_pct != null) overrides[item.grn_item_id] = { margin_pct: String(item.margin_pct) }
    }
    setLineOverrides(overrides)
  }, [existingData])

  /* ── GRN checkbox toggle ──────────────────────────────────── */
  function toggleGrn(grnId) {
    setSelectedGrnIds((prev) => {
      const next = new Set(prev)
      next.has(grnId) ? next.delete(grnId) : next.add(grnId)
      return next
    })
  }

  const allFilteredSelected  = filteredGrns.length > 0 && filteredGrns.every((g) => selectedGrnIds.has(g.id))
  const someFilteredSelected = filteredGrns.some((g) => selectedGrnIds.has(g.id))

  function toggleAllGrns() {
    setSelectedGrnIds((prev) => {
      const next = new Set(prev)
      if (allFilteredSelected) {
        filteredGrns.forEach((g) => next.delete(g.id))
      } else {
        filteredGrns.forEach((g) => next.add(g.id))
      }
      return next
    })
  }

  /* ── Field updaters ───────────────────────────────────────── */
  function setField(name, value) {
    setForm((f) => ({ ...f, [name]: value }))
    setErrors((e) => ({ ...e, [name]: undefined }))
  }

  // Editing a line margin clears its typed price (they're mutually exclusive)
  function setLineMargin(grnItemId, value) {
    setLineOverrides((prev) => ({ ...prev, [grnItemId]: { margin_pct: value } }))
  }

  // The typed price is per the product's stocking UOM — the unit the customer is billed in.
  function setLineSelling(grnItemId, value) {
    setLineOverrides((prev) => ({ ...prev, [grnItemId]: { selling_price_base: value } }))
  }

  function resetLine(grnItemId) {
    setLineOverrides((prev) => {
      const next = { ...prev }
      delete next[grnItemId]
      return next
    })
  }

  /* ── Build payload ────────────────────────────────────────── */
  function buildPayload() {
    return {
      supplier_id:        parseInt(form.supplier_id),
      costing_type:       form.costing_type,
      grn_ids:            [...selectedGrnIds],
      bill_of_lading:     form.bill_of_lading || null,
      expected_date:      form.expected_date || null,
      transaction_date:   form.transaction_date || null,
      note:                 form.note || null,
      common_charge_amount: parseFloat(form.common_charge_amount) || 0,
      default_margin_pct:   parseFloat(form.default_margin_pct) || 0,
      apply_sscl:           form.apply_sscl,
      sscl_pct:             parseFloat(form.sscl_pct) || 0,
      apply_vat:            form.apply_vat,
      vat_pct:              parseFloat(form.vat_pct) || 0,
      expenses:             [],
      items: Object.entries(lineOverrides)
        .filter(([grnItemId]) => grnLines.some((l) => String(l.id) === String(grnItemId)))
        .map(([grnItemId, ov]) => ({
          grn_item_id:        parseInt(grnItemId),
          margin_pct:         ov.margin_pct !== undefined && ov.margin_pct !== '' ? parseFloat(ov.margin_pct) : null,
          selling_price_base: ov.selling_price_base !== undefined && ov.selling_price_base !== '' ? parseFloat(ov.selling_price_base) : null,
        }))
        .filter((o) => o.margin_pct !== null || o.selling_price_base !== null),
    }
  }

  /* ── Validate ─────────────────────────────────────────────── */
  function validate() {
    const errs = {}
    if (!form.supplier_id) errs.supplier_id = 'Supplier is required.'
    if (selectedGrnIds.size === 0) errs.grn_ids = 'Select at least one GRN.'
    if (!form.costing_type) errs.costing_type = 'Costing type is required.'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  /* ── Mutations ────────────────────────────────────────────── */
  const saveMutation = useMutation({
    mutationFn: (payload) => isEdit ? updateCosting(id, payload) : createCosting(payload),
    onSuccess: (res) => {
      showSuccess(isEdit ? 'Costing updated.' : 'Costing created.')
      navigate(`/inventory/costings/${res.data.id}`)
    },
    onError: (err) => {
      const msg = err.response?.data?.message ?? 'Save failed.'
      const validationErrors = err.response?.data?.errors ?? {}
      setErrors(validationErrors)
      showError(msg)
    },
  })

  const confirmMutation = useMutation({
    mutationFn: () => confirmCosting(id),
    onSuccess: () => { showSuccess('Costing confirmed — product selling prices updated.'); navigate('/inventory/costings') },
    onError: (err) => showError(err.response?.data?.message ?? 'Confirmation failed.'),
  })

  function handleSave(e) {
    e.preventDefault()
    if (!validate()) return
    saveMutation.mutate(buildPayload())
  }

  async function handleConfirm() {
    const ok = await confirmAction({
      title: 'Confirm Costing?',
      message: 'This will <strong>lock the costing</strong> and <strong>update the selling prices</strong> of these products. Sales orders will price this shipment\'s rolls at the costing prices. This action cannot be undone.',
      confirmText: 'Yes, Confirm',
    })
    if (ok) confirmMutation.mutate()
  }

  const isConfirmed = existingData?.data?.status === 'confirmed'
  const readOnly    = isConfirmed || (!isEdit && Boolean(id))
  const anyTax      = form.apply_sscl || form.apply_vat
  const colCount    = 12 + (anyTax ? 1 : 0) + (readOnly ? 0 : 1)

  /* ════════════════════════════════════════════════════════════ */
  return (
    <div className="w-full">
      {/* Page header */}
      <div className="mb-3">
        <h1 className="text-xl font-bold leading-none text-slate-800">
          {isEdit ? 'Edit Costing' : id ? 'View Costing' : 'New Costing'}
        </h1>
        <Breadcrumb crumbs={CRUMBS} />
      </div>

      <div className="flex gap-3 items-start">
        {/* ── Left column (main content) ─────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">

          {/* Section 1 — Header Info */}
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
            <SectionHeader icon={ClipboardList} title="Costing Header" />
            <div className="p-3 grid grid-cols-2 md:grid-cols-4 gap-2">
              <FieldRow label="Document No">
                <input type="text" className={INPUT_RO} value={docNoPreview || 'Auto-generated'} readOnly tabIndex={-1} />
              </FieldRow>
              <FieldRow label="Reference No">
                <input type="text" className={INPUT_RO} value={refNoPreview || 'Auto-generated'} readOnly tabIndex={-1} />
              </FieldRow>
              <FieldRow label="Transaction Date">
                <input type="date" className={INPUT_CLS} value={form.transaction_date} onChange={(e) => setField('transaction_date', e.target.value)} disabled={readOnly} />
              </FieldRow>
              <FieldRow label="Expected Date">
                <input type="date" className={INPUT_CLS} value={form.expected_date} onChange={(e) => setField('expected_date', e.target.value)} disabled={readOnly} />
              </FieldRow>
              <FieldRow label="Supplier" required error={errors.supplier_id}>
                <select
                  className={SELECT_CLS}
                  value={form.supplier_id}
                  onChange={(e) => {
                    linkedGrnsRef.current = []
                    setSelectedGrnIds(new Set())
                    setLineOverrides({})
                    setField('supplier_id', e.target.value)
                  }}
                  disabled={readOnly}
                >
                  <option value="">— Select Supplier —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.supplier_name || s.name}</option>
                  ))}
                </select>
              </FieldRow>
              <FieldRow label="Bill of Lading">
                <input type="text" className={INPUT_CLS} placeholder="BL-XXXXXXXX" value={form.bill_of_lading} onChange={(e) => setField('bill_of_lading', e.target.value)} disabled={readOnly} />
              </FieldRow>
              <FieldRow label="Note">
                <input type="text" className={INPUT_CLS} placeholder="Optional note…" value={form.note} onChange={(e) => setField('note', e.target.value)} disabled={readOnly} />
              </FieldRow>
            </div>
          </div>

          {/* Section 2 — GRN Selection */}
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
            <SectionHeader
              icon={Package}
              title="GRN Selection"
              colorClass="text-amber-700 bg-amber-50 border-amber-100"
              extra={
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    placeholder="Search GRN No…"
                    value={grnSearch}
                    onChange={(e) => setGrnSearch(e.target.value)}
                    className="rounded border border-amber-200 bg-white px-2 py-0.5 text-[10px] text-slate-700 placeholder-slate-400 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-300/40 w-36"
                  />
                  <div className="flex items-center gap-3 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1">Received: <QtyChips groups={qtyGroups} /></span>
                    <span>GRN Total: <span className="font-bold text-indigo-700">{fmt(grnTotal)} {CURRENCY}</span></span>
                  </div>
                </div>
              }
            />
            {errors.grn_ids && <p className="px-3 pt-1 text-[10px] text-red-500">{errors.grn_ids}</p>}
            <div className="overflow-x-auto max-h-56 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-slate-200 bg-slate-50 text-left">
                    {!readOnly && (
                      <th className="w-8 px-3 py-2 text-center">
                        <span
                          onClick={() => filteredGrns.length > 0 && toggleAllGrns()}
                          className={`inline-flex h-3.5 w-3.5 cursor-pointer items-center justify-center rounded border-2 transition-colors ${
                            allFilteredSelected
                              ? 'border-indigo-500 bg-indigo-500'
                              : someFilteredSelected
                              ? 'border-indigo-400 bg-indigo-100'
                              : 'border-slate-300 bg-white hover:border-indigo-400'
                          }`}
                        >
                          {allFilteredSelected && (
                            <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3.5 6L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          )}
                          {!allFilteredSelected && someFilteredSelected && (
                            <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M2 4h4" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round"/></svg>
                          )}
                        </span>
                      </th>
                    )}
                    <th className="px-3 py-2 font-semibold uppercase tracking-wider text-slate-500">GRN No</th>
                    <th className="w-24 px-3 py-2 font-semibold uppercase tracking-wider text-slate-500">GRN Date</th>
                    <th className="px-3 py-2 font-semibold uppercase tracking-wider text-slate-500">PO No</th>
                    <th className="w-24 px-3 py-2 font-semibold uppercase tracking-wider text-slate-500">Items</th>
                    <th className="w-28 px-3 py-2 text-right font-semibold uppercase tracking-wider text-slate-500">GRN Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!form.supplier_id ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Select a supplier to load available GRNs.</td></tr>
                  ) : loadingGrns ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Loading GRNs…</td></tr>
                  ) : filteredGrns.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">{supplierGrns.length === 0 ? 'No confirmed GRNs available for this supplier.' : 'No GRNs match the search.'}</td></tr>
                  ) : (
                    filteredGrns.map((grn) => (
                      <tr
                        key={grn.id}
                        className={`transition-colors cursor-pointer ${selectedGrnIds.has(grn.id) ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                        onClick={() => !readOnly && toggleGrn(grn.id)}
                      >
                        {!readOnly && (
                          <td className="px-3 py-1.5 text-center">
                            <span className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded border-2 ${selectedGrnIds.has(grn.id) ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300 bg-white'}`}>
                              {selectedGrnIds.has(grn.id) && (
                                <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3.5 6L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              )}
                            </span>
                          </td>
                        )}
                        <td className={`px-3 py-1.5 font-mono font-medium ${selectedGrnIds.has(grn.id) ? 'text-indigo-700' : 'text-slate-700'}`}>{grn.grn_no}</td>
                        <td className="px-3 py-1.5 text-slate-500">{grn.grn_date}</td>
                        <td className="px-3 py-1.5 text-slate-400">{grn.po_no || '—'}</td>
                        <td className="px-3 py-1.5 text-slate-500">{fmt(grn.total_items)}</td>
                        <td className="px-3 py-1.5 text-right font-medium text-slate-700"><Money value={grn.total_amount} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3 — Product Breakdown (the heart of the costing) */}
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
            <SectionHeader
              icon={Table2}
              title="Product Price Breakdown"
              colorClass="text-indigo-700 bg-indigo-50 border-indigo-100"
              extra={
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-slate-400">
                    GRN Price + Charges = Landed → + Margin{form.apply_sscl ? ' → +SSCL' : ''}{form.apply_vat ? ' → +VAT' : ''} = Selling
                  </span>
                  {totalExpenses > 0 && (
                    <span
                      className="rounded bg-emerald-100 px-1.5 py-px font-bold text-emerald-700"
                      title="Charges are split across the lines in proportion to each line's VALUE — the only basis that holds when lines arrive in different units. Every line therefore lands at this same uplift over its GRN price."
                    >
                      Charges split by value · every line +{fmt(totals.upliftPct)}%
                    </span>
                  )}
                </div>
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left">
                    <th className="px-2 py-2 font-semibold uppercase tracking-wider text-slate-500">Product</th>
                    <th className="px-2 py-2 font-semibold uppercase tracking-wider text-slate-500">Colour</th>
                    <th className="px-2 py-2 font-semibold uppercase tracking-wider text-slate-500">GRN</th>
                    <th className="px-2 py-2 text-right font-semibold uppercase tracking-wider text-slate-500" title={anyConverted ? 'Quantity as received, restated in the product’s stocking UOM below' : undefined}>Received</th>
                    <th className="px-2 py-2 text-right font-semibold uppercase tracking-wider text-slate-500">GRN Price</th>
                    <th className="px-2 py-2 text-right font-semibold uppercase tracking-wider text-slate-500" title="This line’s share of the common charge, divided by its own quantity">+Charges</th>
                    <th className="px-2 py-2 text-right font-semibold uppercase tracking-wider text-slate-500">Landed</th>
                    <th className="w-20 px-2 py-2 text-right font-semibold uppercase tracking-wider text-slate-500">Margin %</th>
                    <th className="px-2 py-2 text-right font-semibold uppercase tracking-wider text-slate-500">Margin</th>
                    {anyTax && <th className="px-2 py-2 text-right font-semibold uppercase tracking-wider text-slate-500">Tax</th>}
                    <th className="w-28 px-2 py-2 text-right font-semibold uppercase tracking-wider text-slate-500" title="The price the customer pays — always per the product’s stocking UOM, whatever unit the goods arrived in">
                      Selling / Stocking UOM ({CURRENCY})
                    </th>
                    <th className="px-2 py-2 text-right font-semibold uppercase tracking-wider text-slate-500">Line Total</th>
                    {!readOnly && <th className="w-7 px-1 py-2" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {breakdownItems.length === 0 ? (
                    <tr><td colSpan={colCount} className="px-4 py-8 text-center text-slate-400">Select GRNs above — every received product line appears here with its price build-up.</td></tr>
                  ) : (
                    breakdownItems.map((item) => {
                      const ov = lineOverrides[item.id] ?? {}
                      const hasOverride = (ov.margin_pct !== undefined && ov.margin_pct !== '') || (ov.selling_price_base !== undefined && ov.selling_price_base !== '')
                      // Received in a different unit than it's stocked in — show the restatement.
                      const converted = Math.abs(item.conversion_factor - 1) > 1e-9
                      // With a factor of 1 the two denominations are the same number, so the
                      // receiving symbol is the honest label — even on pre-UOM lines, which
                      // were posted raw and froze factor 1 against a base unit they never
                      // actually converted into. Only a real factor makes base_unit_symbol
                      // the unit the price is in.
                      const baseSym = converted
                        ? (item.base_unit_symbol || item.unit_symbol)
                        : (item.unit_symbol || item.base_unit_symbol)
                      return (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="px-2 py-1 font-medium text-slate-700">
                            {item.product_name || `Product #${item.product_id}`}
                            {item.product_code && <span className="ml-1 font-mono text-[9px] text-slate-400">{item.product_code}</span>}
                          </td>
                          <td className="px-2 py-1 text-slate-500">{item.color || '—'}</td>
                          <td className="px-2 py-1 font-mono text-[10px] text-slate-400">{item.grn_no}</td>
                          <td className="px-2 py-1 text-right tabular-nums text-slate-600">
                            <QtyUnit value={item.quantity} symbol={item.unit_symbol} position={item.unit_position} />
                            {converted && (
                              <div className="text-[9px] text-slate-400" title={`1 ${item.unit_symbol} = ${fmt(item.conversion_factor)} ${baseSym}`}>
                                = <QtyUnit value={item.base_quantity} symbol={baseSym} position={item.base_unit_position} />
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-1 text-right"><PerUnit value={item.unit_price} symbol={item.unit_symbol} className="text-slate-600" /></td>
                          <td
                            className="px-2 py-1 text-right text-emerald-600"
                            title={`Line value ${fmt(item.quantity * item.unit_price)} ${CURRENCY} → charge share ${fmt(item.charge_share)} ${CURRENCY} ÷ ${fmt(item.quantity)} ${item.unit_symbol ?? ''}`}
                          >
                            +<PerUnit value={item.charge_portion} symbol={item.unit_symbol} />
                          </td>
                          <td className="px-2 py-1 text-right font-medium">
                            <PerUnit value={item.landed_unit_cost} symbol={item.unit_symbol} className="text-slate-700" />
                            {converted && (
                              <div className="text-[9px] font-normal text-indigo-500">
                                = <PerUnit value={item.landed_unit_cost_base} symbol={baseSym} />
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-1">
                            <input
                              type="number" min="0" step="0.01"
                              placeholder={String(form.default_margin_pct || 0)}
                              className={`${TABLE_INP} text-right`}
                              value={ov.margin_pct ?? ''}
                              onChange={(e) => setLineMargin(item.id, e.target.value)}
                              disabled={readOnly || item.is_price_overridden}
                              title={item.is_price_overridden ? 'Selling price typed directly — margin is back-computed' : 'Line margin % (blank = costing default)'}
                            />
                          </td>
                          <td className={`px-2 py-1 text-right ${item.margin_amount < 0 ? 'font-semibold text-red-600' : 'text-slate-600'}`}>
                            <PerUnit value={item.margin_amount} symbol={item.unit_symbol} />
                          </td>
                          {anyTax && (
                            <td className="px-2 py-1 text-right text-amber-600" title={`SSCL ${fmt(item.sscl_amount)} + VAT ${fmt(item.vat_amount)} ${CURRENCY} per ${item.unit_symbol ?? 'unit'}`}>
                              <PerUnit value={item.sscl_amount + item.vat_amount} symbol={item.unit_symbol} />
                            </td>
                          )}
                          <td className="px-2 py-1">
                            <div className="relative">
                              <input
                                type="number" min="0" step="0.01"
                                className={`${TABLE_INP} text-right font-semibold ${item.is_price_overridden ? 'border-amber-400 bg-amber-50' : ''}`}
                                value={ov.selling_price_base ?? Number(item.selling_price_base.toFixed(2))}
                                onChange={(e) => setLineSelling(item.id, e.target.value)}
                                disabled={readOnly}
                                title={item.is_price_overridden
                                  ? `Typed final price per ${baseSym ?? 'unit'} — margin back-computed`
                                  : `Computed selling price per ${baseSym ?? 'unit'} (type to override)`}
                              />
                              {item.is_price_overridden && <span className="absolute -left-1 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-amber-500" title="Price overridden" />}
                            </div>
                            <div className="mt-px text-right text-[9px] text-slate-400">
                              per {baseSym || 'unit'}
                              {converted && <> · = <span className="tabular-nums">{fmt(item.selling_price)}</span>/{item.unit_symbol}</>}
                            </div>
                          </td>
                          <td className="px-2 py-1 text-right font-medium tabular-nums text-indigo-700"><Money value={item.quantity * item.selling_price} /></td>
                          {!readOnly && (
                            <td className="px-1 py-1 text-center">
                              {hasOverride && (
                                <button type="button" onClick={() => resetLine(item.id)} title="Reset to costing default" className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                                  <RotateCcw size={10} />
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      )
                    })
                  )}
                  {breakdownItems.length > 0 && (
                    /* Money columns total to shipment VALUES, which are additive across units.
                       Quantity is not, so it becomes one chip per unit rather than a fake sum. */
                    <tr className="bg-slate-50 border-t-2 border-slate-200 font-bold">
                      <td className="px-2 py-1.5 text-slate-700" colSpan={3}>Totals</td>
                      <td className="px-2 py-1.5 text-right"><QtyChips groups={qtyGroups} /></td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-700" title="Total purchase value of the selected GRNs"><Money value={totals.purchaseValue} /></td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-emerald-700" title="Total common charge — fully distributed across the lines above">+<Money value={totals.charges} /></td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-800" title="Total landed value (purchase + charges)"><Money value={totals.landedValue} /></td>
                      <td />
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-700"><Money value={totals.marginValue} /></td>
                      {anyTax && <td className="px-2 py-1.5 text-right tabular-nums text-amber-700"><Money value={totals.ssclValue + totals.vatValue} /></td>}
                      <td />
                      <td className="px-2 py-1.5 text-right tabular-nums text-indigo-700" title="Total selling value of the shipment"><Money value={totals.sellingValue} /></td>
                      {!readOnly && <td />}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* ── Right column (summary panel) ───────────────────── */}
        <div className="w-72 shrink-0">
          <div className="sticky top-4 flex flex-col gap-2">
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
            <SectionHeader icon={Calculator} title="Pricing Summary" colorClass="text-violet-700 bg-violet-50 border-violet-100" />
            <div className="p-3 flex flex-col gap-0">

              <div className="flex items-center justify-between gap-2 py-0.5">
                <span className="text-[10px] text-slate-500">Received</span>
                <QtyChips groups={qtyGroups} />
              </div>
              <SummaryRow label="Total Purchase Value" value={totals.purchaseValue} valueClass="text-slate-700" unit={CURRENCY} />

              {/* FOB / CIF total charge — one figure, spread per unit */}
              <div className="mt-1 rounded-md border border-emerald-100 bg-emerald-50/60 p-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex overflow-hidden rounded-md border-2 border-slate-200 text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => !readOnly && setField('costing_type', 'fob')}
                      className={`px-2.5 py-0.5 transition-colors ${form.costing_type === 'fob' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'} ${readOnly ? 'cursor-default' : ''}`}
                    >
                      FOB
                    </button>
                    <button
                      type="button"
                      onClick={() => !readOnly && setField('costing_type', 'cif')}
                      className={`border-l-2 border-slate-200 px-2.5 py-0.5 transition-colors ${form.costing_type === 'cif' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'} ${readOnly ? 'cursor-default' : ''}`}
                    >
                      CIF
                    </button>
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                    Total {form.costing_type?.toUpperCase()} Charges ({CURRENCY})
                  </span>
                </div>
                <input
                  type="number" min="0" step="0.01"
                  placeholder="0.00"
                  className="mt-1.5 block w-full rounded border-2 border-emerald-200 bg-white px-2 py-1 text-right text-sm font-bold tabular-nums text-slate-800 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  value={form.common_charge_amount}
                  onChange={(e) => setField('common_charge_amount', e.target.value)}
                  disabled={readOnly}
                  title={`Total ${form.costing_type?.toUpperCase()} + transport + other charges for this shipment — split across the lines in proportion to their value`}
                />
                {/* A single "charge per unit" cannot exist across Kg, Rolls and metres.
                    The uplift % can: it is what every line's cost rises by. */}
                <div className="mt-1 flex items-center justify-between text-[10px]">
                  <span className="text-slate-500" title="Charges ÷ purchase value — the uplift every line's GRN price takes">
                    Split by value · uplift
                  </span>
                  <span className="font-bold text-emerald-700 tabular-nums">+{fmt(totals.upliftPct)}%</span>
                </div>
              </div>

              <div className="border-t border-slate-200 my-1" />
              <SummaryRow label="Total Landed Cost" value={totals.landedValue} valueClass="font-bold text-slate-800" unit={CURRENCY} />

              {/* Default margin */}
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Default Margin</span>
                  <input
                    type="number" min="0" step="0.1"
                    className={PCT_INP}
                    value={form.default_margin_pct}
                    onChange={(e) => setField('default_margin_pct', e.target.value)}
                    disabled={readOnly}
                    placeholder="0"
                  />
                  <span className="text-[10px] text-slate-400">%</span>
                </div>
                <span className="text-xs text-slate-600"><Money value={totals.marginValue} /></span>
              </div>

              {/* SSCL toggle */}
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-1.5">
                  <CheckToggle checked={form.apply_sscl} onChange={(v) => setField('apply_sscl', v)} label="SSCL" disabled={readOnly} />
                  <input
                    type="number" min="0" max="100" step="0.1"
                    className={PCT_INP}
                    value={form.sscl_pct}
                    onChange={(e) => setField('sscl_pct', e.target.value)}
                    disabled={readOnly || !form.apply_sscl}
                  />
                  <span className="text-[10px] text-slate-400">%</span>
                </div>
                <span className={`text-xs ${form.apply_sscl ? 'text-amber-600' : 'text-slate-300'}`}><Money value={totals.ssclValue} /></span>
              </div>

              {/* VAT toggle */}
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-1.5">
                  <CheckToggle checked={form.apply_vat} onChange={(v) => setField('apply_vat', v)} label="VAT" disabled={readOnly} />
                  <input
                    type="number" min="0" max="100" step="0.1"
                    className={PCT_INP}
                    value={form.vat_pct}
                    onChange={(e) => setField('vat_pct', e.target.value)}
                    disabled={readOnly || !form.apply_vat}
                  />
                  <span className="text-[10px] text-slate-400">%</span>
                </div>
                <span className={`text-xs ${form.apply_vat ? 'text-amber-600' : 'text-slate-300'}`}><Money value={totals.vatValue} /></span>
              </div>

              {anyTax && (
                <p className="mt-0.5 rounded bg-amber-50 px-2 py-1 text-[9px] leading-tight text-amber-700">
                  Selling prices include {form.apply_sscl && 'SSCL'}{form.apply_sscl && form.apply_vat && ' + '}{form.apply_vat && 'VAT'} — this will be noted on invoices.
                </p>
              )}

              <div className="border-t-2 border-indigo-200 mt-1 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">Total Selling Value</span>
                  <span className="text-base font-black text-indigo-700">{fmt(totals.sellingValue)} <span className="text-[10px] font-bold text-indigo-400">{CURRENCY}</span></span>
                </div>
              </div>

            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-1.5">
            {!readOnly && (
              <button
                type="button"
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
              >
                <Save size={13} strokeWidth={2.5} />
                {saveMutation.isPending ? 'Saving…' : 'Save Costing'}
              </button>
            )}
            {isEdit && !isConfirmed && (
              <button
                type="button"
                onClick={handleConfirm}
                disabled={confirmMutation.isPending}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-60"
              >
                <CheckCircle size={13} strokeWidth={2.5} />
                Confirm Costing
              </button>
            )}
            {isConfirmed && (
              <div className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-green-100 px-3 py-2 text-xs font-semibold text-green-700">
                <CheckCircle size={13} /> Confirmed — selling prices live
              </div>
            )}
            <button
              type="button"
              onClick={() => navigate('/inventory/costings')}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border-2 border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              <X size={13} strokeWidth={2.5} />
              Cancel
            </button>
          </div>

          </div>
        </div>

      </div>
    </div>
  )
}

function SummaryRow({ label, value, valueClass = '', unit }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[10px] text-slate-500">{label}</span>
      <span className={`text-xs ${valueClass}`}>
        {Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        {unit && <span className="ml-0.5 text-[9px] font-normal text-slate-400">{unit}</span>}
      </span>
    </div>
  )
}
