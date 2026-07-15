import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Calculator,
  CheckCircle,
  ChevronDown,
  ChevronRight,
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
  getCostingExpenseTypes,
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
const PANEL_INP  = 'block w-full rounded border-2 border-slate-200 bg-white px-1.5 py-0.5 text-right text-xs tabular-nums text-slate-800 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400'
const PCT_INP    = 'w-12 rounded border-2 border-slate-200 bg-slate-50 px-1 py-0.5 text-right text-xs outline-none focus:border-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400'

/* Line count beyond which the breakdown table gets its own scrollbar. */
const ITEMS_SCROLL_AFTER = 15

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

/** A per-unit money figure — reads "27,500.00 /Kg". */
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
 * Every product line prices ITSELF — no cross-line apportionment. All amounts are
 * per the product's BASE (stocking) unit, the denomination the user types in:
 *
 *   fob/cif    = grn unit_price ÷ conversion_factor
 *   expenses   = Σ typed amounts per expense type
 *   sscl       = sscl% × fob/cif ONLY (never the expenses)
 *   before_tax = fob/cif + expenses + sscl + margin (typed addon amount)
 *   after_tax  = before_tax + VAT%
 *
 * before_tax feeds non-VAT invoices later, after_tax feeds VAT invoices. */
function calcBreakdown(lines, cfg, lineCosting) {
  const items = lines.map((line) => {
    const qty       = parseFloat(line.quantity) || 0
    const unitPrice = parseFloat(line.unit_price) || 0
    const factor    = parseFloat(line.conversion_factor) || 1
    const baseQty   = parseFloat(line.base_quantity) || qty * factor

    const lc      = lineCosting[line.id] ?? {}
    const numOr   = (v, fallback) => (v !== undefined && v !== null && v !== '' && !Number.isNaN(parseFloat(v)) ? parseFloat(v) : fallback)

    const fobBase = factor > 0 ? unitPrice / factor : unitPrice
    const expBase = Object.values(lc.expenses ?? {}).reduce((s, v) => s + (parseFloat(v) || 0), 0)

    const effSsclPct = cfg.applySscl ? numOr(lc.sscl_pct, cfg.ssclPct) : 0
    const effVatPct  = cfg.applyVat ? numOr(lc.vat_pct, cfg.vatPct) : 0
    const marginBase = numOr(lc.margin, 0)

    // SSCL is levied on the FOB/CIF amount ONLY — never on the expenses
    const ssclBase      = fobBase * (effSsclPct / 100)
    const beforeTaxBase = fobBase + expBase + ssclBase + marginBase
    const vatBase       = beforeTaxBase * (effVatPct / 100)
    const afterTaxBase  = beforeTaxBase + vatBase

    return {
      ...line,
      quantity:              qty,
      conversion_factor:     factor,
      base_quantity:         baseQty,
      fob_base:              fobBase,
      expense_total_base:    expBase,
      eff_sscl_pct:          effSsclPct,
      sscl_amount_base:      ssclBase,
      margin_amount_base:    marginBase,
      before_tax_price_base: beforeTaxBase,
      eff_vat_pct:           effVatPct,
      vat_amount_base:       vatBase,
      after_tax_price_base:  afterTaxBase,
      line_total:            afterTaxBase * baseQty,
    }
  })

  const sum = (key) => items.reduce((s, i) => s + i.base_quantity * i[key], 0)

  return {
    items,
    totals: {
      purchaseValue:  items.reduce((s, i) => s + i.quantity * (parseFloat(i.unit_price) || 0), 0),
      expensesValue:  sum('expense_total_base'),
      landedValue:    items.reduce((s, i) => s + i.base_quantity * (i.fob_base + i.expense_total_base), 0),
      ssclValue:      sum('sscl_amount_base'),
      marginValue:    sum('margin_amount_base'),
      beforeTaxValue: sum('before_tax_price_base'),
      vatValue:       sum('vat_amount_base'),
      afterTaxValue:  sum('after_tax_price_base'),
    },
  }
}

/** True when the line's per-product panel holds any typed value. */
function lineHasData(lc) {
  if (!lc) return false
  const anyExpense = Object.values(lc.expenses ?? {}).some((v) => v !== '' && v !== undefined && parseFloat(v) > 0)
  return anyExpense || (lc.margin ?? '') !== '' || (lc.sscl_pct ?? '') !== '' || (lc.vat_pct ?? '') !== ''
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
    supplier_id:      '',
    costing_type:     'fob',
    bill_of_lading:   '',
    expected_date:    '',
    transaction_date: today,
    note:             '',
    apply_sscl:       true,
    sscl_pct:         2.5,
    apply_vat:        true,
    vat_pct:          18,
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

  /* ── Per-product costing inputs (all amounts per BASE unit) ─ */
  // { [grn_item_id]: { expenses: { [expense_type_id]: 'amt' }, sscl_pct: '', margin: '', vat_pct: '' } }
  const [lineCosting,  setLineCosting]  = useState({})
  const [expandedRows, setExpandedRows] = useState(new Set())

  /* ── Expense types for the selected FOB/CIF list ──────────── */
  const { data: expenseTypes = [] } = useQuery({
    queryKey: ['costing-expense-types', form.costing_type],
    queryFn:  () => getCostingExpenseTypes(form.costing_type),
    staleTime: 5 * 60 * 1000,
  })

  /* ── Derived data ─────────────────────────────────────────── */
  const filteredGrns  = grnSearch
    ? supplierGrns.filter((g) => g.grn_no?.toLowerCase().includes(grnSearch.toLowerCase()))
    : supplierGrns
  const selectedGrns  = supplierGrns.filter((g) => selectedGrnIds.has(g.id))
  const grnTotal      = selectedGrns.reduce((s, g) => s + (parseFloat(g.total_amount) || 0), 0)

  // Every item line of the selected GRNs — the breakdown's raw input
  const grnLines = selectedGrns.flatMap((g) =>
    (g.items ?? []).map((it) => ({ ...it, grn_no: g.grn_no, grn_id: g.id }))
  )

  const breakdown = calcBreakdown(grnLines, {
    applySscl: form.apply_sscl,
    ssclPct:   parseFloat(form.sscl_pct) || 0,
    applyVat:  form.apply_vat,
    vatPct:    parseFloat(form.vat_pct) || 0,
  }, lineCosting)
  const { items: breakdownItems, totals } = breakdown

  // Quantities are additive only within a unit, so totals show one chip per unit.
  const qtyGroups = qtyChips(breakdownItems)

  // Past this many lines the breakdown scrolls inside itself (sticky header + totals)
  // rather than pushing the save actions off-screen.
  const itemsScroll = breakdownItems.length > ITEMS_SCROLL_AFTER
  const footCell    = itemsScroll ? 'sticky bottom-0 z-10 bg-slate-50' : ''

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
      supplier_id:      String(c.supplier_id),
      costing_type:     c.costing_type,
      bill_of_lading:   c.bill_of_lading ?? '',
      expected_date:    c.expected_date ?? '',
      transaction_date: c.transaction_date ?? today,
      note:             c.note ?? '',
      apply_sscl:       Boolean(c.apply_sscl),
      sscl_pct:         c.sscl_pct,
      apply_vat:        Boolean(c.apply_vat),
      vat_pct:          c.vat_pct,
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

    // Restore the per-product panel inputs, all per base unit as they were typed.
    const restored = {}
    for (const item of c.items ?? []) {
      const expenses = {}
      for (const e of item.expenses ?? []) expenses[e.expense_type_id] = String(e.amount)
      const entry = {
        expenses,
        sscl_pct: item.sscl_pct != null ? String(item.sscl_pct) : '',
        vat_pct:  item.vat_pct != null ? String(item.vat_pct) : '',
        margin:   item.margin_amount_base ? String(parseFloat(item.margin_amount_base)) : '',
      }
      if (lineHasData(entry)) restored[item.grn_item_id] = entry
    }
    setLineCosting(restored)
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

  // Switching FOB ↔ CIF swaps the expense-type list, so typed amounts of the
  // old list would silently survive against types the new list doesn't show.
  function setCostingType(type) {
    if (type === form.costing_type) return
    setLineCosting((prev) => {
      const next = {}
      for (const [key, lc] of Object.entries(prev)) next[key] = { ...lc, expenses: {} }
      return next
    })
    setField('costing_type', type)
  }

  function toggleRow(grnItemId) {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      next.has(grnItemId) ? next.delete(grnItemId) : next.add(grnItemId)
      return next
    })
  }

  function setLineField(grnItemId, field, value) {
    setLineCosting((prev) => ({
      ...prev,
      [grnItemId]: { ...(prev[grnItemId] ?? { expenses: {} }), [field]: value },
    }))
  }

  function setLineExpense(grnItemId, typeId, value) {
    setLineCosting((prev) => {
      const lc = prev[grnItemId] ?? { expenses: {} }
      return { ...prev, [grnItemId]: { ...lc, expenses: { ...(lc.expenses ?? {}), [typeId]: value } } }
    })
  }

  function resetLine(grnItemId) {
    setLineCosting((prev) => {
      const next = { ...prev }
      delete next[grnItemId]
      return next
    })
  }

  /* ── Build payload ────────────────────────────────────────── */
  function buildPayload() {
    return {
      supplier_id:      parseInt(form.supplier_id),
      costing_type:     form.costing_type,
      grn_ids:          [...selectedGrnIds],
      bill_of_lading:   form.bill_of_lading || null,
      expected_date:    form.expected_date || null,
      transaction_date: form.transaction_date || null,
      note:             form.note || null,
      apply_sscl:       form.apply_sscl,
      sscl_pct:         parseFloat(form.sscl_pct) || 0,
      apply_vat:        form.apply_vat,
      vat_pct:          parseFloat(form.vat_pct) || 0,
      items: grnLines
        .filter((l) => lineHasData(lineCosting[l.id]))
        .map((l) => {
          const lc = lineCosting[l.id]
          return {
            grn_item_id:        l.id,
            margin_amount_base: lc.margin !== '' && lc.margin !== undefined ? parseFloat(lc.margin) || 0 : 0,
            sscl_pct:           lc.sscl_pct !== '' && lc.sscl_pct !== undefined ? parseFloat(lc.sscl_pct) : null,
            vat_pct:            lc.vat_pct !== '' && lc.vat_pct !== undefined ? parseFloat(lc.vat_pct) : null,
            expenses: Object.entries(lc.expenses ?? {})
              .filter(([, amt]) => amt !== '' && parseFloat(amt) > 0)
              .map(([typeId, amt]) => ({ expense_type_id: parseInt(typeId), amount: parseFloat(amt) })),
          }
        }),
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
  const typeLabel   = form.costing_type?.toUpperCase()
  const COLS        = 13

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
                    setLineCosting({})
                    setExpandedRows(new Set())
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
            <div className="thin-scroll overflow-x-auto max-h-56 overflow-y-auto">
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

          {/* Section 3 — Product Cost Build-up (the heart of the costing) */}
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
            <SectionHeader
              icon={Table2}
              title="Product Cost Build-up"
              colorClass="text-indigo-700 bg-indigo-50 border-indigo-100"
              extra={
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-slate-400">
                    {typeLabel} + Expenses{form.apply_sscl ? ' + SSCL' : ''} + Margin = Before-Tax{form.apply_vat ? ' → +VAT = After-Tax' : ''} · per base unit
                  </span>
                  {breakdownItems.length > 0 && (
                    <span className="flex items-center gap-1 text-slate-500">
                      {breakdownItems.length} line{breakdownItems.length !== 1 ? 's' : ''}
                      {itemsScroll && (
                        <span
                          className="rounded bg-indigo-50 px-1 py-px text-[9px] font-semibold text-indigo-600"
                          title="Scroll inside the table — header and totals stay visible"
                        >
                          scrollable
                        </span>
                      )}
                    </span>
                  )}
                </div>
              }
            />
            <div
              className={`overflow-x-auto ${itemsScroll ? 'thin-scroll overflow-y-auto' : ''}`}
              style={itemsScroll ? { maxHeight: 'min(62vh, 620px)' } : undefined}
            >
              <table className="w-full text-xs">
                <thead className={itemsScroll ? 'sticky top-0 z-20 shadow-[0_1px_0_0_#e2e8f0]' : ''}>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left">
                    <th className="w-7 px-1 py-2" />
                    <th className="px-2 py-2 font-semibold uppercase tracking-wider text-slate-500">Product</th>
                    <th className="px-2 py-2 font-semibold uppercase tracking-wider text-slate-500">Colour</th>
                    <th className="px-2 py-2 font-semibold uppercase tracking-wider text-slate-500">GRN</th>
                    <th className="px-2 py-2 text-right font-semibold uppercase tracking-wider text-slate-500">Received</th>
                    <th className="px-2 py-2 text-right font-semibold uppercase tracking-wider text-slate-500" title={`The GRN purchasing price — the ${typeLabel} value, per the product's stocking unit`}>{typeLabel}</th>
                    <th className="px-2 py-2 text-right font-semibold uppercase tracking-wider text-slate-500" title="Sum of the expense amounts typed in the line's panel">+Expenses</th>
                    <th className="px-2 py-2 text-right font-semibold uppercase tracking-wider text-slate-500" title={`SSCL % of the ${typeLabel} amount only`}>+SSCL</th>
                    <th className="px-2 py-2 text-right font-semibold uppercase tracking-wider text-slate-500" title="Addon margin amount per base unit">+Margin</th>
                    <th className="px-2 py-2 text-right font-semibold uppercase tracking-wider text-slate-500" title="Selling price before VAT — what non-VAT invoices bill">Before-Tax</th>
                    <th className="px-2 py-2 text-right font-semibold uppercase tracking-wider text-slate-500">+VAT</th>
                    <th className="px-2 py-2 text-right font-semibold uppercase tracking-wider text-slate-500" title="Selling price including VAT — what VAT invoices bill">After-Tax</th>
                    <th className="px-2 py-2 text-right font-semibold uppercase tracking-wider text-slate-500" title="After-tax price × full received quantity">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {breakdownItems.length === 0 ? (
                    <tr><td colSpan={COLS} className="px-4 py-8 text-center text-slate-400">Select GRNs above — every received product line appears here. Expand a line to type its expenses, SSCL, margin and VAT.</td></tr>
                  ) : (
                    breakdownItems.map((item) => {
                      const lc       = lineCosting[item.id] ?? { expenses: {} }
                      const hasData  = lineHasData(lc)
                      const isOpen   = expandedRows.has(item.id)
                      const converted = Math.abs(item.conversion_factor - 1) > 1e-9
                      // With a factor of 1 the two denominations are the same number, so the
                      // receiving symbol is the honest label — even on pre-UOM lines, which
                      // froze factor 1 against a base unit they never converted into.
                      const baseSym = converted
                        ? (item.base_unit_symbol || item.unit_symbol)
                        : (item.unit_symbol || item.base_unit_symbol)
                      return (
                        <RowGroup key={item.id}>
                          <tr
                            className={`cursor-pointer transition-colors ${isOpen ? 'bg-indigo-50/60' : hasData ? 'bg-emerald-50/40 hover:bg-emerald-50/70' : 'hover:bg-slate-50'}`}
                            onClick={() => toggleRow(item.id)}
                            title={isOpen ? 'Collapse' : 'Expand to enter expenses, SSCL, margin & VAT'}
                          >
                            <td className="px-1 py-1 text-center text-slate-400">
                              {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            </td>
                            <td className="px-2 py-1 font-medium text-slate-700">
                              {item.product_name || `Product #${item.product_id}`}
                              {item.product_code && <span className="ml-1 font-mono text-[9px] text-slate-400">{item.product_code}</span>}
                              {hasData && <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 align-middle" title="Has costing inputs" />}
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
                            <td className="px-2 py-1 text-right"><PerUnit value={item.fob_base} symbol={baseSym} className="text-slate-700 font-medium" /></td>
                            <td className={`px-2 py-1 text-right ${item.expense_total_base > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>
                              +<PerUnit value={item.expense_total_base} symbol={baseSym} />
                            </td>
                            <td className={`px-2 py-1 text-right ${item.sscl_amount_base > 0 ? 'text-amber-600' : 'text-slate-300'}`} title={`${fmt(item.eff_sscl_pct)}% of ${typeLabel} ${fmt(item.fob_base)}`}>
                              +<PerUnit value={item.sscl_amount_base} symbol={baseSym} />
                            </td>
                            <td className={`px-2 py-1 text-right ${item.margin_amount_base > 0 ? 'text-slate-600' : 'text-slate-300'}`}>
                              +<PerUnit value={item.margin_amount_base} symbol={baseSym} />
                            </td>
                            <td className="px-2 py-1 text-right font-semibold"><PerUnit value={item.before_tax_price_base} symbol={baseSym} className="text-slate-800" /></td>
                            <td className={`px-2 py-1 text-right ${item.vat_amount_base > 0 ? 'text-amber-600' : 'text-slate-300'}`} title={`VAT ${fmt(item.eff_vat_pct)}% of before-tax`}>
                              +<PerUnit value={item.vat_amount_base} symbol={baseSym} />
                            </td>
                            <td className="px-2 py-1 text-right font-bold"><PerUnit value={item.after_tax_price_base} symbol={baseSym} className="text-indigo-700" /></td>
                            <td className="px-2 py-1 text-right font-medium tabular-nums text-indigo-700"><Money value={item.line_total} /></td>
                          </tr>
                          {isOpen && (
                            <tr className="bg-slate-50/80">
                              <td colSpan={COLS} className="px-3 py-2 border-l-2 border-indigo-400">
                                <LineCostingPanel
                                  item={item}
                                  lc={lc}
                                  baseSym={baseSym}
                                  typeLabel={typeLabel}
                                  expenseTypes={expenseTypes}
                                  form={form}
                                  readOnly={readOnly}
                                  hasData={hasData}
                                  onExpense={(typeId, v) => setLineExpense(item.id, typeId, v)}
                                  onField={(field, v) => setLineField(item.id, field, v)}
                                  onReset={() => resetLine(item.id)}
                                />
                              </td>
                            </tr>
                          )}
                        </RowGroup>
                      )
                    })
                  )}
                  {breakdownItems.length > 0 && (
                    /* Money columns total to shipment VALUES, which are additive across units.
                       Quantity is not, so it becomes one chip per unit rather than a fake sum. */
                    <tr className="bg-slate-50 border-t-2 border-slate-200 font-bold">
                      <td className={`px-2 py-1.5 text-slate-700 ${footCell}`} colSpan={4}>Totals</td>
                      <td className={`px-2 py-1.5 text-right ${footCell}`}><QtyChips groups={qtyGroups} /></td>
                      <td className={`px-2 py-1.5 text-right tabular-nums text-slate-700 ${footCell}`} title={`Total ${typeLabel} (purchase) value of the selected GRNs`}><Money value={totals.purchaseValue} /></td>
                      <td className={`px-2 py-1.5 text-right tabular-nums text-emerald-700 ${footCell}`}>+<Money value={totals.expensesValue} /></td>
                      <td className={`px-2 py-1.5 text-right tabular-nums text-amber-700 ${footCell}`}>+<Money value={totals.ssclValue} /></td>
                      <td className={`px-2 py-1.5 text-right tabular-nums text-slate-700 ${footCell}`}>+<Money value={totals.marginValue} /></td>
                      <td className={`px-2 py-1.5 text-right tabular-nums text-slate-800 ${footCell}`} title="Total Before-Tax selling value"><Money value={totals.beforeTaxValue} /></td>
                      <td className={`px-2 py-1.5 text-right tabular-nums text-amber-700 ${footCell}`}>+<Money value={totals.vatValue} /></td>
                      <td className={`px-2 py-1.5 text-right tabular-nums text-indigo-700 ${footCell}`} title="Total After-Tax selling value"><Money value={totals.afterTaxValue} /></td>
                      <td className={`px-2 py-1.5 text-right tabular-nums text-indigo-700 ${footCell}`}><Money value={totals.afterTaxValue} /></td>
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

              {/* FOB / CIF selector — decides which expense-type list every line uses */}
              <div className="mt-1 rounded-md border border-emerald-100 bg-emerald-50/60 p-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex overflow-hidden rounded-md border-2 border-slate-200 text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => !readOnly && setCostingType('fob')}
                      className={`px-2.5 py-0.5 transition-colors ${form.costing_type === 'fob' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'} ${readOnly ? 'cursor-default' : ''}`}
                    >
                      FOB
                    </button>
                    <button
                      type="button"
                      onClick={() => !readOnly && setCostingType('cif')}
                      className={`border-l-2 border-slate-200 px-2.5 py-0.5 transition-colors ${form.costing_type === 'cif' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'} ${readOnly ? 'cursor-default' : ''}`}
                    >
                      CIF
                    </button>
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                    {typeLabel} Costing
                  </span>
                </div>
                <p className="mt-1 text-[9px] leading-tight text-slate-500">
                  Expenses are typed per product line (per base unit) — expand a line in the build-up table.
                </p>
              </div>

              <div className="mt-1">
                <SummaryRow label={`Total ${typeLabel} Value`} value={totals.purchaseValue} valueClass="text-slate-700" unit={CURRENCY} />
                <SummaryRow label="Total Expenses" value={totals.expensesValue} valueClass="text-emerald-700" unit={CURRENCY} />
                <SummaryRow label="Total Landed Cost" value={totals.landedValue} valueClass="font-bold text-slate-800" unit={CURRENCY} />
              </div>

              <div className="border-t border-slate-200 my-1" />

              {/* SSCL toggle — % of the FOB/CIF amount only */}
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-1.5">
                  <CheckToggle checked={form.apply_sscl} onChange={(v) => setField('apply_sscl', v)} label="SSCL" disabled={readOnly} />
                  <input
                    type="number" min="0" max="100" step="0.1"
                    className={PCT_INP}
                    value={form.sscl_pct}
                    onChange={(e) => setField('sscl_pct', e.target.value)}
                    disabled={readOnly || !form.apply_sscl}
                    title={`SSCL % of the ${typeLabel} amount only (lines can override)`}
                  />
                  <span className="text-[10px] text-slate-400">%</span>
                </div>
                <span className={`text-xs ${form.apply_sscl ? 'text-amber-600' : 'text-slate-300'}`}><Money value={totals.ssclValue} /></span>
              </div>

              <SummaryRow label="Total Margin" value={totals.marginValue} valueClass="text-slate-700" unit={CURRENCY} />

              {/* Before-Tax value — what non-VAT invoices will bill */}
              <div className="mt-1 flex items-center justify-between rounded bg-slate-100 px-2 py-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Before-Tax Value</span>
                <span className="text-sm font-bold tabular-nums text-slate-800">{fmt(totals.beforeTaxValue)} <span className="text-[9px] font-normal text-slate-400">{CURRENCY}</span></span>
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
                    title="Default VAT % (lines can override)"
                  />
                  <span className="text-[10px] text-slate-400">%</span>
                </div>
                <span className={`text-xs ${form.apply_vat ? 'text-amber-600' : 'text-slate-300'}`}><Money value={totals.vatValue} /></span>
              </div>

              {/* After-Tax value — what VAT invoices will bill */}
              <div className="border-t-2 border-indigo-200 mt-1 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">After-Tax Value</span>
                  <span className="text-base font-black text-indigo-700">{fmt(totals.afterTaxValue)} <span className="text-[10px] font-bold text-indigo-400">{CURRENCY}</span></span>
                </div>
                <p className="mt-0.5 text-[9px] leading-tight text-slate-400">
                  Before-Tax feeds Non-VAT invoices · After-Tax feeds VAT invoices.
                </p>
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

/** Fragment wrapper so a data row + its expanded panel share one key. */
function RowGroup({ children }) {
  return <>{children}</>
}

/* ── The expanded per-product costing panel ──────────────────────────────────
 * Everything here is typed PER BASE UNIT; the grey figure beside each field is
 * the same money for the line's FULL quantity, so the user sees both without
 * leaving the row. */
function LineCostingPanel({ item, lc, baseSym, typeLabel, expenseTypes, form, readOnly, hasData, onExpense, onField, onReset }) {
  const perUnitTag = <span className="text-[9px] font-normal text-slate-400">/{baseSym || 'unit'}</span>
  const baseQty    = item.base_quantity

  const total = (perUnit) => `${fmt((parseFloat(perUnit) || 0) * baseQty)} ${CURRENCY}`

  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 items-start" onClick={(e) => e.stopPropagation()}>

      {/* Expense inputs — one per type of the costing's FOB/CIF list */}
      <div className="flex-1 min-w-[300px]">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
            {typeLabel} Expenses <span className="font-normal text-slate-400">(amount per {baseSym || 'unit'})</span>
          </span>
          <span className="text-[10px] text-slate-500">
            Total: <span className="font-bold text-emerald-700 tabular-nums">{fmt(item.expense_total_base)}</span>{perUnitTag}
            <span className="mx-1 text-slate-300">·</span>
            <span className="tabular-nums" title={`For the full ${fmt(baseQty)} ${baseSym || ''}`}>{total(item.expense_total_base)}</span>
          </span>
        </div>
        {expenseTypes.length === 0 ? (
          <p className="rounded bg-slate-100 px-2 py-1.5 text-[10px] text-slate-400">No active {typeLabel} expense types configured.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-1.5">
            {expenseTypes.map((t) => {
              const val = lc.expenses?.[t.id] ?? ''
              return (
                <div key={t.id} className="min-w-0">
                  <label className="block truncate text-[9px] font-semibold uppercase tracking-wider text-slate-500" title={t.name}>{t.name}</label>
                  <input
                    type="number" min="0" step="0.01"
                    placeholder="0.00"
                    className={`${PANEL_INP} ${val !== '' && parseFloat(val) > 0 ? 'border-emerald-300 bg-emerald-50/50' : ''}`}
                    value={val}
                    onChange={(e) => onExpense(t.id, e.target.value)}
                    disabled={readOnly}
                  />
                  <div className="mt-px text-right text-[9px] tabular-nums text-slate-400">
                    {val !== '' && parseFloat(val) > 0 ? `= ${total(val)}` : ' '}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Price build-up: FOB/CIF → +Expenses → +SSCL → +Margin = Before-Tax → +VAT = After-Tax */}
      <div className="w-[300px] shrink-0 rounded-md border border-slate-200 bg-white p-2">
        <BuildUpRow label={`${typeLabel} (GRN Price)`} value={item.fob_base} tag={perUnitTag} totalText={total(item.fob_base)} />
        <BuildUpRow label="+ Expenses" value={item.expense_total_base} tag={perUnitTag} totalText={total(item.expense_total_base)} valueClass="text-emerald-600" />

        {/* SSCL — % of the FOB/CIF amount ONLY */}
        <div className="flex items-center justify-between gap-1 py-0.5">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-500">+ SSCL</span>
            <input
              type="number" min="0" max="100" step="0.1"
              className={`${PCT_INP} !w-11`}
              placeholder={String(form.sscl_pct)}
              value={lc.sscl_pct ?? ''}
              onChange={(e) => onField('sscl_pct', e.target.value)}
              disabled={readOnly || !form.apply_sscl}
              title={form.apply_sscl ? `SSCL % of the ${typeLabel} amount only (blank = ${form.sscl_pct}%)` : 'SSCL is off for this costing'}
            />
            <span className="text-[9px] text-slate-400">% of {typeLabel}</span>
          </div>
          <span className="text-[11px] tabular-nums text-amber-600" title={total(item.sscl_amount_base)}>{fmt(item.sscl_amount_base)}{perUnitTag}</span>
        </div>

        {/* Margin — a typed addon AMOUNT per base unit */}
        <div className="flex items-center justify-between gap-1 py-0.5">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-500">+ Margin</span>
            <input
              type="number" min="0" step="0.01"
              className={`${PANEL_INP} !w-20 ${(lc.margin ?? '') !== '' ? 'border-indigo-300 bg-indigo-50/50' : ''}`}
              placeholder="0.00"
              value={lc.margin ?? ''}
              onChange={(e) => onField('margin', e.target.value)}
              disabled={readOnly}
              title={`Addon margin amount per ${baseSym || 'unit'}`}
            />
            <span className="text-[9px] text-slate-400">/{baseSym || 'unit'}</span>
          </div>
          <span className="text-[11px] tabular-nums text-slate-600" title={total(item.margin_amount_base)}>{fmt(item.margin_amount_base)}{perUnitTag}</span>
        </div>

        <div className="my-0.5 border-t border-slate-200" />
        <BuildUpRow label="= Before-Tax" value={item.before_tax_price_base} tag={perUnitTag} totalText={total(item.before_tax_price_base)} labelClass="font-bold text-slate-700" valueClass="font-bold text-slate-800" />

        {/* VAT — % of the before-tax price */}
        <div className="flex items-center justify-between gap-1 py-0.5">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-500">+ VAT</span>
            <input
              type="number" min="0" max="100" step="0.1"
              className={`${PCT_INP} !w-11`}
              placeholder={String(form.vat_pct)}
              value={lc.vat_pct ?? ''}
              onChange={(e) => onField('vat_pct', e.target.value)}
              disabled={readOnly || !form.apply_vat}
              title={form.apply_vat ? `VAT % of the before-tax price (blank = ${form.vat_pct}%)` : 'VAT is off for this costing'}
            />
            <span className="text-[9px] text-slate-400">%</span>
          </div>
          <span className="text-[11px] tabular-nums text-amber-600" title={total(item.vat_amount_base)}>{fmt(item.vat_amount_base)}{perUnitTag}</span>
        </div>

        <div className="my-0.5 border-t-2 border-indigo-200" />
        <BuildUpRow label="= After-Tax" value={item.after_tax_price_base} tag={perUnitTag} totalText={total(item.after_tax_price_base)} labelClass="font-bold text-indigo-700" valueClass="font-black text-indigo-700" />
        <div className="mt-0.5 flex items-center justify-between text-[9px] text-slate-400">
          <span>Line total ({fmt(baseQty)} {baseSym || 'unit'})</span>
          <span className="font-bold tabular-nums text-indigo-600">{fmt(item.after_tax_price_base * baseQty)} {CURRENCY}</span>
        </div>

        {!readOnly && hasData && (
          <button
            type="button"
            onClick={onReset}
            className="mt-1 flex items-center gap-1 rounded px-1 py-0.5 text-[9px] font-semibold text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            title="Clear this line's expenses, SSCL, margin and VAT"
          >
            <RotateCcw size={9} /> Reset line
          </button>
        )}
      </div>

    </div>
  )
}

function BuildUpRow({ label, value, tag, totalText, labelClass = 'text-slate-500', valueClass = 'text-slate-700' }) {
  return (
    <div className="flex items-center justify-between gap-1 py-0.5">
      <span className={`text-[10px] ${labelClass}`}>{label}</span>
      <span className={`text-[11px] tabular-nums ${valueClass}`} title={totalText}>{fmt(value)}{tag}</span>
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
