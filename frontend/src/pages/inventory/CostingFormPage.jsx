import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Calculator,
  CheckCircle,
  ClipboardList,
  DollarSign,
  Package,
  Receipt,
  Save,
  X,
} from 'lucide-react'
import {
  confirmCosting,
  createCosting,
  getCostingExpenseTypes,
  getCosting,
  getNextDocumentNo,
  getNextReferenceNo,
  getSupplierGrns,
  updateCosting,
} from '../../api/costings'
import { getAllSuppliers } from '../../api/suppliers'
import Breadcrumb from '../../components/Breadcrumb'
import { confirmAction, showError, showSuccess } from '../../utils/alerts'

/* ── Style tokens ───────────────────────────────────────────── */
const INPUT_CLS  = 'block w-full rounded border-2 border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/15'
const INPUT_RO   = 'block w-full rounded border-2 border-slate-100 bg-slate-100 px-2 py-1 text-xs text-slate-500 outline-none cursor-default'
const SELECT_CLS = 'block w-full rounded border-2 border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-800 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/15 cursor-pointer'
const LABEL_CLS  = 'text-[10px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap'
const ERR_CLS    = 'mt-0.5 text-[10px] text-red-500'
const TABLE_INP  = 'block w-full rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs text-slate-800 outline-none transition-all focus:border-indigo-500 focus:bg-white'

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

/* ── Canonical calculation (mirrors backend CostingService::compute) ── */
function calcSummary({ rawMaterialCost, expenses, valueAdditionPct, ssclPct, vatPct }) {
  const totalAdditional    = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0)
  const totalLanded        = rawMaterialCost + totalAdditional
  const valueAdditionAmt   = totalLanded * (valueAdditionPct / 100)
  const fobCifCost         = totalLanded + valueAdditionAmt
  const ssclAmount         = fobCifCost * (ssclPct / 100)
  const grossFobCif        = fobCifCost + ssclAmount
  const vatAmount          = grossFobCif * (vatPct / 100)
  const totalWithVat       = grossFobCif + vatAmount
  return { totalAdditional, totalLanded, valueAdditionAmt, fobCifCost, ssclAmount, grossFobCif, vatAmount, totalWithVat }
}

function fmt(n) {
  return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/* ════════════════════════════════════════════════════════════ */
export default function CostingFormPage() {
  const { id }   = useParams()
  const isEdit   = Boolean(id)
  const navigate = useNavigate()
  const today    = new Date().toISOString().slice(0, 10)
  const isView   = window.location.pathname.match(/^\/inventory\/costings\/\d+$/)

  const CRUMBS = [
    { label: 'Inventory', to: '/inventory/products' },
    { label: 'Costings', to: '/inventory/costings' },
    { label: isEdit ? 'Edit Costing' : id ? 'View Costing' : 'New Costing' },
  ]

  /* ── Core form state ──────────────────────────────────────── */
  const [form, setForm] = useState({
    supplier_id:      '',
    costing_type:     'fob',
    material_cost:    '',
    bill_of_lading:   '',
    expected_date:    '',
    transaction_date: today,
    note:             '',
    value_addition_pct: 10,
    sscl_pct:           2.5,
    vat_pct:            18,
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

  /* ── Expense rows (one per expense type for current costing_type) ── */
  const [expenseRows, setExpenseRows] = useState([]) // { expense_type_id, name, amount, note }

  /* ── Derived totals ───────────────────────────────────────── */
  const filteredGrns  = grnSearch
    ? supplierGrns.filter((g) => g.grn_no?.toLowerCase().includes(grnSearch.toLowerCase()))
    : supplierGrns
  const selectedGrns  = supplierGrns.filter((g) => selectedGrnIds.has(g.id))
  const grnTotal      = selectedGrns.reduce((s, g) => s + (parseFloat(g.total_amount) || 0), 0)
  const totalItemsCount = selectedGrns.reduce((s, g) => s + (parseFloat(g.total_items) || 0), 0)

  // Summary uses material_cost (editable field) as raw material cost — not the GRN sum.
  // GRN selection auto-fills material_cost, but the user can override it.
  const summary = calcSummary({
    rawMaterialCost:  parseFloat(form.material_cost) || 0,
    expenses:         expenseRows,
    valueAdditionPct: parseFloat(form.value_addition_pct) || 0,
    ssclPct:          parseFloat(form.sscl_pct) || 0,
    vatPct:           parseFloat(form.vat_pct) || 0,
  })

  /* ── Auto-fill Material Cost from GRN selection (create mode only) ── */
  useEffect(() => {
    if (isEdit) return
    setField('material_cost', grnTotal > 0 ? grnTotal : '')
  }, [grnTotal])

  /* ── Fetch suppliers list ─────────────────────────────────── */
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-all'],
    queryFn:  getAllSuppliers,
    staleTime: 5 * 60 * 1000,
  })

  /* ── Fetch auto-gen numbers on create ─────────────────────── */
  useEffect(() => {
    if (isEdit) return
    getNextDocumentNo().then(setDocNoPreview).catch(() => setDocNoPreview('Auto-generated'))
    getNextReferenceNo().then(setRefNoPreview).catch(() => setRefNoPreview('Auto-generated'))
  }, [isEdit])

  /* ── Load GRNs when supplier changes ─────────────────────── */
  useEffect(() => {
    if (!form.supplier_id) { setSupplierGrns([]); return }
    let cancelled = false
    setLoadingGrns(true)
    getSupplierGrns(form.supplier_id)
      .then((grns) => {
        if (cancelled) return
        // Merge in already-linked GRNs (excluded from "available" list by the API
        // because they belong to a confirmed costing — but we still need to show them here)
        const freshIds = new Set(grns.map((g) => g.id))
        const combined = [...grns, ...linkedGrnsRef.current.filter((g) => !freshIds.has(g.id))]
        setSupplierGrns(combined)
      })
      .catch(() => { if (!cancelled) showError('Could not load supplier GRNs.') })
      .finally(() => { if (!cancelled) setLoadingGrns(false) })
    return () => { cancelled = true }
  }, [form.supplier_id])

  /* ── Load expense types when costing_type changes ─────────── */
  useEffect(() => {
    if (!form.costing_type) return
    let cancelled = false
    getCostingExpenseTypes(form.costing_type)
      .then((types) => {
        if (cancelled) return
        setExpenseRows((prev) => types.map((t) => {
          const existing = prev.find((r) => r.expense_type_id === t.id)
          return { expense_type_id: t.id, name: t.name, amount: existing?.amount ?? '', note: existing?.note ?? '' }
        }))
      })
      .catch(() => { if (!cancelled) showError('Could not load expense types.') })
    return () => { cancelled = true }
  }, [form.costing_type])

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
      supplier_id:        String(c.supplier_id),
      costing_type:       c.costing_type,
      material_cost:      c.material_cost,
      bill_of_lading:     c.bill_of_lading ?? '',
      expected_date:      c.expected_date ?? '',
      transaction_date:   c.transaction_date ?? today,
      note:               c.note ?? '',
      value_addition_pct: c.value_addition_pct,
      sscl_pct:           c.sscl_pct,
      vat_pct:            c.vat_pct,
    })

    // Rebuild selected GRNs from linked data
    const linkedGrnIds = (c.costing_grns ?? []).map((cg) => cg.grn_id)
    setSelectedGrnIds(new Set(linkedGrnIds))

    // Store already-linked GRNs in a ref BEFORE setting supplier_id.
    // The supplier_id useEffect will merge these into the fresh GRN list,
    // because the API excludes GRNs that belong to confirmed costings.
    linkedGrnsRef.current = (c.costing_grns ?? [])
      .filter((cg) => cg.grn)
      .map((cg) => ({
        id:           cg.grn_id,
        grn_no:       cg.grn.grn_no,
        grn_date:     cg.grn.grn_date,
        po_no:        null,
        total_amount: cg.grn.total_amount,
        total_items:  cg.grn.total_items ?? 0,
      }))

    // Rebuild expense rows
    if (c.expenses?.length) {
      setExpenseRows(
        c.expenses.map((e) => ({
          expense_type_id: e.expense_type_id,
          name:            e.expense_type?.name ?? `Expense ${e.expense_type_id}`,
          amount:          e.amount,
          note:            e.note ?? '',
        }))
      )
    }
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

  /* ── Field updater ────────────────────────────────────────── */
  function setField(name, value) {
    setForm((f) => ({ ...f, [name]: value }))
    setErrors((e) => ({ ...e, [name]: undefined }))
  }

  /* ── Expense row updater ──────────────────────────────────── */
  function setExpenseField(idx, field, value) {
    setExpenseRows((rows) => rows.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }

  /* ── Build payload ────────────────────────────────────────── */
  function buildPayload() {
    return {
      supplier_id:        parseInt(form.supplier_id),
      costing_type:       form.costing_type,
      grn_ids:            [...selectedGrnIds],
      material_cost:      parseFloat(form.material_cost) || 0,
      bill_of_lading:     form.bill_of_lading || null,
      expected_date:      form.expected_date || null,
      transaction_date:   form.transaction_date || null,
      note:               form.note || null,
      value_addition_pct: parseFloat(form.value_addition_pct) || 10,
      sscl_pct:           parseFloat(form.sscl_pct) || 2.5,
      vat_pct:            parseFloat(form.vat_pct) || 18,
      expenses:           expenseRows
        .filter((r) => parseFloat(r.amount) > 0)
        .map((r) => ({ expense_type_id: r.expense_type_id, amount: parseFloat(r.amount), note: r.note || null })),
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
    onSuccess: () => { showSuccess('Costing confirmed.'); navigate('/inventory/costings') },
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
      message: 'This will <strong>lock the costing</strong> and finalize all landed cost calculations. This action cannot be undone.',
      confirmText: 'Yes, Confirm',
    })
    if (ok) confirmMutation.mutate()
  }

  const isConfirmed = existingData?.data?.status === 'confirmed'
  const readOnly    = isConfirmed || (!isEdit && Boolean(id))

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
              <FieldRow label="Material Cost">
                <input type="number" min="0" step="0.01" className={INPUT_CLS} placeholder="0.00" value={form.material_cost} onChange={(e) => setField('material_cost', e.target.value)} disabled={readOnly} />
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
                    <span>Total Items: <span className="font-bold text-slate-700">{fmt(totalItemsCount)}</span></span>
                    <span>GRN Total: <span className="font-bold text-indigo-700">{fmt(grnTotal)}</span></span>
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
                        <td className="px-3 py-1.5 text-right font-medium text-slate-700">{fmt(grn.total_amount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3 — Costing Type + Expenses */}
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
            <SectionHeader
              icon={DollarSign}
              title="Additional Expenses"
              colorClass="text-emerald-700 bg-emerald-50 border-emerald-100"
              extra={
                !readOnly && (
                  <div className="flex overflow-hidden rounded-md border-2 border-slate-200 text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setField('costing_type', 'fob')}
                      className={`px-3 py-1 transition-colors ${form.costing_type === 'fob' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                    >
                      FOB
                    </button>
                    <button
                      type="button"
                      onClick={() => setField('costing_type', 'cif')}
                      className={`border-l-2 border-slate-200 px-3 py-1 transition-colors ${form.costing_type === 'cif' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                    >
                      CIF
                    </button>
                  </div>
                )
              }
            />
            {readOnly && (
              <div className="px-3 py-2 border-b border-slate-100">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${form.costing_type === 'fob' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                  {form.costing_type?.toUpperCase()}
                </span>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left">
                    <th className="px-3 py-2 font-semibold uppercase tracking-wider text-slate-500">Expense</th>
                    <th className="w-36 px-3 py-2 font-semibold uppercase tracking-wider text-slate-500">Amount</th>
                    <th className="px-3 py-2 font-semibold uppercase tracking-wider text-slate-500">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {expenseRows.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-slate-400">
                        {form.costing_type ? 'No expense types configured for this costing type.' : 'Select a costing type to load expenses.'}
                      </td>
                    </tr>
                  ) : (
                    expenseRows.map((row, idx) => (
                      <tr key={row.expense_type_id} className="hover:bg-slate-50">
                        <td className="px-3 py-1.5 font-medium text-slate-700">{row.name}</td>
                        <td className="px-3 py-1.5">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            className={TABLE_INP}
                            value={row.amount}
                            onChange={(e) => setExpenseField(idx, 'amount', e.target.value)}
                            disabled={readOnly}
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            type="text"
                            placeholder="Optional note…"
                            className={TABLE_INP}
                            value={row.note}
                            onChange={(e) => setExpenseField(idx, 'note', e.target.value)}
                            disabled={readOnly}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                  {expenseRows.length > 0 && (
                    <tr className="bg-slate-50 border-t border-slate-200">
                      <td className="px-3 py-1.5 font-bold text-slate-700">Total Additional Expenses</td>
                      <td className="px-3 py-1.5 font-bold text-indigo-700">{fmt(summary.totalAdditional)}</td>
                      <td />
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
            <SectionHeader icon={Calculator} title="Costing Summary" colorClass="text-violet-700 bg-violet-50 border-violet-100" />
            <div className="p-3 flex flex-col gap-0">

              {/* Summary rows */}
              <SummaryRow label="Total Additional Expenses" value={summary.totalAdditional} valueClass="text-slate-700" />
              <SummaryRow label="Raw Material Cost" value={parseFloat(form.material_cost) || 0} valueClass="text-slate-700" />
              <div className="border-t border-slate-200 my-1" />
              <SummaryRow label="Total Landed Cost" value={summary.totalLanded} valueClass="font-bold text-slate-800" />

              <div className="flex items-center justify-between py-0.5">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Value Addition</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    className="w-12 rounded border-2 border-slate-200 bg-slate-50 px-1 py-0.5 text-right text-xs outline-none focus:border-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    value={form.value_addition_pct}
                    onChange={(e) => setField('value_addition_pct', e.target.value)}
                    disabled={readOnly}
                  />
                  <span className="text-[10px] text-slate-400">%</span>
                </div>
                <span className="text-xs text-amber-600">{fmt(summary.valueAdditionAmt)}</span>
              </div>

              <div className="border-t border-slate-200 my-1" />
              <SummaryRow label={`${form.costing_type?.toUpperCase() || 'FOB/CIF'} Cost`} value={summary.fobCifCost} valueClass="font-bold text-slate-800" />

              <div className="flex items-center justify-between py-0.5">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">SSCL</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    className="w-12 rounded border-2 border-slate-200 bg-slate-50 px-1 py-0.5 text-right text-xs outline-none focus:border-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    value={form.sscl_pct}
                    onChange={(e) => setField('sscl_pct', e.target.value)}
                    disabled={readOnly}
                  />
                  <span className="text-[10px] text-slate-400">%</span>
                </div>
                <span className="text-xs text-amber-600">{fmt(summary.ssclAmount)}</span>
              </div>

              <div className="border-t border-slate-200 my-1" />
              <SummaryRow label={`Gross ${form.costing_type?.toUpperCase() || 'FOB/CIF'} Value`} value={summary.grossFobCif} valueClass="font-bold text-slate-800" />

              <div className="flex items-center justify-between py-0.5">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">VAT</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    className="w-12 rounded border-2 border-slate-200 bg-slate-50 px-1 py-0.5 text-right text-xs outline-none focus:border-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    value={form.vat_pct}
                    onChange={(e) => setField('vat_pct', e.target.value)}
                    disabled={readOnly}
                  />
                  <span className="text-[10px] text-slate-400">%</span>
                </div>
                <span className="text-xs text-amber-600">{fmt(summary.vatAmount)}</span>
              </div>

              <div className="border-t-2 border-indigo-200 mt-1 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">Total Price with VAT</span>
                  <span className="text-base font-black text-indigo-700">{fmt(summary.totalWithVat)}</span>
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
                <CheckCircle size={13} /> Confirmed
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

function SummaryRow({ label, value, valueClass = '' }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[10px] text-slate-500">{label}</span>
      <span className={`text-xs ${valueClass}`}>{Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
    </div>
  )
}
