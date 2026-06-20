import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ClipboardList, PackageCheck, Plus, ShoppingCart, Trash2, X } from 'lucide-react'
import {
  createGoodsReceivedNote,
  getGoodsReceivedNote,
  getLastGrn,
  getNextGrnNo,
  getPoOutstandingItemsMultiple,
  updateGoodsReceivedNote,
} from '../../api/goodsReceivedNotes'
import { getPurchaseOrders } from '../../api/purchaseOrders'
import { getAllSuppliers } from '../../api/suppliers'
import Breadcrumb from '../../components/Breadcrumb'
import { showError, showSuccess } from '../../utils/alerts'

/* ── Style tokens ─────────────────────────────────────────────── */
const INPUT_CLS   = 'block w-full rounded border-2 border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/15'
const INPUT_RO    = 'block w-full rounded border-2 border-slate-100 bg-slate-100 px-2 py-1 text-xs text-slate-500 outline-none cursor-default'
const SELECT_CLS  = 'block w-full rounded border-2 border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-800 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/15 cursor-pointer'
const TABLE_INPUT = 'block w-full rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs text-slate-800 outline-none transition-all focus:border-indigo-500 focus:bg-white'
const LABEL_CLS   = 'text-[10px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap'
const ERR_CLS     = 'mt-0.5 text-[10px] text-red-500'

function SectionHeader({ icon: Icon, title, colorClass, extra }) {
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

/* Inline label+field row matching image layout */
function FieldRow({ label, required, error, children }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className={LABEL_CLS}>
        {label}{required && <span className="text-red-500">*</span>}
      </span>
      <div className="min-w-0">
        {children}
        {error && <p className={ERR_CLS}>{error}</p>}
      </div>
    </div>
  )
}

/* ── Line item calculator (mirrors PO logic) ──────────────────── */
function calcItem(row) {
  const qty      = parseFloat(row.quantity_received) || 0
  const price    = parseFloat(row.unit_price)        || 0
  const discPct  = parseFloat(row.discount)          || 0
  const taxPct   = parseFloat(row.tax)               || 0
  const gross    = qty * price
  const discAmt  = gross * (discPct / 100)
  const taxAmt   = gross * (taxPct  / 100)
  const amount   = gross - discAmt + taxAmt
  return { gross, discAmt, taxAmt, amount }
}

/* ── Helpers ──────────────────────────────────────────────────── */
const STATUS_BADGE = {
  confirmed:          'bg-blue-50 text-blue-700 border-blue-200',
  partially_received: 'bg-amber-50 text-amber-700 border-amber-200',
}

function StatusBadge({ label, value }) {
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${STATUS_BADGE[value] ?? 'bg-slate-50 text-slate-600 border-slate-200'}`}>
      {label}
    </span>
  )
}

/* ══════════════════════════════════════════════════════════════ */
export default function GoodsReceivedNoteFormPage() {
  const { id }      = useParams()
  const isEdit      = Boolean(id)
  const navigate    = useNavigate()
  const [search]    = useSearchParams()
  const poIdFromUrl = search.get('po_id')
  const fileRef     = useRef(null)

  const CRUMBS = [
    { label: 'Inventory', to: '/inventory/products' },
    { label: 'Goods Received Notes', to: '/inventory/goods-received-notes' },
    { label: isEdit ? 'Edit GRN' : 'New GRN' },
  ]

  const today = new Date().toISOString().slice(0, 10)

  /* ── Form header state ────────────────────────────────────── */
  const [form, setForm] = useState({
    supplier_id:      '',
    grn_date:         today,
    transaction_date: today,
    reference_no:     '',
    remarks:          '',
    payment_terms:    '',
    attachments:      [],
  })
  const [grnNoPreview,  setGrnNoPreview]  = useState('')
  const [lastGrnDate,   setLastGrnDate]   = useState('')
  const [lastGrnAmount, setLastGrnAmount] = useState('')

  /* ── PO selection state ───────────────────────────────────── */
  const [selectedPoIds, setSelectedPoIds] = useState(new Set())
  const [loadingItems,  setLoadingItems]  = useState(false)

  /* ── GRN items state ──────────────────────────────────────── */
  const [items,  setItems]  = useState([])
  const [errors, setErrors] = useState({})

  /* ── Next GRN number preview ─────────────────────────────── */
  useEffect(() => {
    if (isEdit) return
    getNextGrnNo()
      .then(setGrnNoPreview)
      .catch(() => setGrnNoPreview('Auto-generated'))
  }, [isEdit])

  /* ── Remote data ──────────────────────────────────────────── */
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-all'],
    queryFn:  getAllSuppliers,
  })

  // Load POs for the selected supplier only (fires when supplier is chosen)
  const { data: supplierConfirmedPOs, isLoading: loadingConfirmed } = useQuery({
    queryKey: ['pos-supplier-confirmed', form.supplier_id],
    queryFn:  () => getPurchaseOrders(1, { supplier_id: form.supplier_id, status: 'confirmed', per_page: 200 }),
    enabled:  Boolean(form.supplier_id) && !isEdit,
  })
  const { data: supplierPartialPOs, isLoading: loadingPartial } = useQuery({
    queryKey: ['pos-supplier-partial', form.supplier_id],
    queryFn:  () => getPurchaseOrders(1, { supplier_id: form.supplier_id, status: 'partially_received', per_page: 200 }),
    enabled:  Boolean(form.supplier_id) && !isEdit,
  })

  const displayedPOs  = [
    ...(supplierConfirmedPOs?.data ?? []),
    ...(supplierPartialPOs?.data  ?? []),
  ]
  const loadingPOs = loadingConfirmed || loadingPartial

  /* ── Load existing GRN for edit ───────────────────────────── */
  const { data: existingGRN, isLoading: loadingGRN } = useQuery({
    queryKey: ['grn', id],
    queryFn:  () => getGoodsReceivedNote(id),
    enabled:  isEdit,
  })

  useEffect(() => {
    if (!existingGRN?.data) return
    const grn = existingGRN.data
    setGrnNoPreview(grn.grn_no ?? '')
    setForm({
      supplier_id:      String(grn.supplier_id ?? ''),
      grn_date:         grn.grn_date         ?? today,
      transaction_date: grn.transaction_date ?? today,
      reference_no:     grn.reference_no     ?? '',
      remarks:          grn.remarks          ?? '',
      payment_terms:    grn.payment_terms    ?? '',
      attachments:      grn.attachments      ?? [],
    })
    if (grn.items?.length) {
      setItems(grn.items.map((it) => ({
        _key:              it.id,
        po_id:             grn.po_id ?? null,
        po_no:             grn.purchase_order?.po_no ?? '',
        po_item_id:        it.po_item_id,
        product_id:        it.product_id,
        product_code:      it.product?.product_code ?? '',
        product_name:      it.product?.name ?? '',
        quantity_ordered:  it.quantity_ordered,
        already_received:  null,  // not available in edit context
        remaining_qty:     null,
        quantity_received: it.quantity_received,
        unit_price:        it.unit_price,
        discount:          it.discount ?? '',
        tax:               it.tax      ?? '',
        is_batch:          it.product?.is_batch ?? false,
        batch_no:          it.batch_no    ?? '',
        expiry_date:       it.expiry_date ?? '',
      })))
    }
  }, [existingGRN])

  /* ── Last GRN (system-wide, loaded once on mount) ────────── */
  const { data: lastGrnData } = useQuery({
    queryKey: ['grn-last'],
    queryFn:  getLastGrn,
    enabled:  !isEdit,
  })

  useEffect(() => {
    if (!lastGrnData) return
    setLastGrnDate(lastGrnData.grn_date ?? '')
    setLastGrnAmount(
      lastGrnData.total_amount != null
        ? Number(lastGrnData.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })
        : ''
    )
  }, [lastGrnData])

  /* ── Supplier change — clear all PO selections ───────────── */
  const handleSupplierChange = (supplierId) => {
    setForm((f) => ({ ...f, supplier_id: supplierId }))
    setSelectedPoIds(new Set())
    setItems([])
  }

  /* ── PO item mapper (pure, no state captured) ────────────── */
  const mapPoItem = (it) => ({
    _key:              `${it.po_item_id}-${Date.now() + Math.random()}`,
    po_id:             it.po_id,
    po_no:             it.po_no ?? '',
    po_item_id:        it.po_item_id,
    product_id:        it.product_id,
    product_code:      it.product?.product_code ?? '',
    product_name:      it.product?.name ?? '',
    quantity_ordered:  it.quantity_ordered,
    already_received:  it.quantity_received,
    remaining_qty:     it.remaining_qty,
    quantity_received: it.remaining_qty,
    unit_price:        it.unit_price,
    discount:          it.discount ?? '',
    tax:               it.tax      ?? '',
    is_batch:          it.product?.is_batch ?? false,
    batch_no:          '',
    expiry_date:       '',
  })

  /* Select All — fetches all selected POs at once, replaces items */
  const loadItemsForPOs = useCallback(async (poIdSet) => {
    if (!poIdSet.size) { setItems([]); return }
    setLoadingItems(true)
    try {
      const data = await getPoOutstandingItemsMultiple(Array.from(poIdSet))
      setItems(data.map(mapPoItem))
    } catch {
      showError('Failed to load PO items.')
    } finally {
      setLoadingItems(false)
    }
  }, [])

  /* Individual add — fetches only the newly added PO and appends */
  const loadItemsForSinglePO = useCallback(async (poId) => {
    setLoadingItems(true)
    try {
      const data = await getPoOutstandingItemsMultiple([poId])
      setItems((prev) => [...prev, ...data.map(mapPoItem)])
    } catch {
      showError('Failed to load PO items.')
    } finally {
      setLoadingItems(false)
    }
  }, [])

  const togglePO = (poId) => {
    if (selectedPoIds.has(poId)) {
      setSelectedPoIds((prev) => { const s = new Set(prev); s.delete(poId); return s })
      setItems((prev) => prev.filter((it) => it.po_id !== poId))
    } else {
      setSelectedPoIds((prev) => new Set([...prev, poId]))
      loadItemsForSinglePO(poId)
    }
  }

  const toggleAllPOs = () => {
    if (selectedPoIds.size === displayedPOs.length && displayedPOs.length > 0) {
      setSelectedPoIds(new Set())
      setItems([])
    } else {
      const allIds = new Set(displayedPOs.map((po) => po.id))
      setSelectedPoIds(allIds)
      loadItemsForPOs(allIds)
    }
  }

  /* ── Item row editing ─────────────────────────────────────── */
  const setRowField = (idx, field, value) =>
    setItems((prev) => prev.map((row, i) => i === idx ? { ...row, [field]: value } : row))

  const removeRow = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx))

  /* ── Attachments ──────────────────────────────────────────── */
  const handleAddAttachment = (e) => {
    const names = Array.from(e.target.files ?? []).map((f) => f.name)
    if (!names.length) return
    setForm((prev) => ({ ...prev, attachments: [...(prev.attachments ?? []), ...names] }))
    if (fileRef.current) fileRef.current.value = ''
  }

  const removeAttachment = (idx) =>
    setForm((prev) => ({ ...prev, attachments: prev.attachments.filter((_, i) => i !== idx) }))

  /* ── Totals ───────────────────────────────────────────────── */
  const totals = items.reduce(
    (acc, r) => {
      const { gross, discAmt, taxAmt, amount } = calcItem(r)
      return { gross: acc.gross + gross, disc: acc.disc + discAmt, tax: acc.tax + taxAmt, total: acc.total + amount }
    },
    { gross: 0, disc: 0, tax: 0, total: 0 },
  )

  /* ── Save ─────────────────────────────────────────────────── */
  const saveMutation = useMutation({
    mutationFn: (payload) => isEdit
      ? updateGoodsReceivedNote(id, payload)
      : createGoodsReceivedNote(payload),
    onSuccess: () => {
      showSuccess(isEdit ? 'GRN updated.' : 'GRN created.')
      navigate('/inventory/goods-received-notes')
    },
    onError: (err) => {
      const data = err.response?.data
      if (data?.errors) setErrors(data.errors)
      showError(data?.message ?? 'Failed to save GRN.')
    },
  })

  const handleSubmit = () => {
    if (!form.supplier_id) {
      showError('Supplier is required. Please select a supplier.')
      return
    }
    const validItems = items.filter((r) => r.po_item_id && parseFloat(r.quantity_received) > 0)
    if (!validItems.length) {
      showError('Please select at least one Purchase Order with items to receive.')
      return
    }

    const payload = {
      supplier_id:      form.supplier_id      || null,
      grn_date:         form.grn_date,
      transaction_date: form.transaction_date  || null,
      reference_no:     form.reference_no     || null,
      remarks:          form.remarks          || null,
      payment_terms:    form.payment_terms    || null,
      attachments:      (form.attachments ?? []).length ? form.attachments : null,
      items: validItems.map((r) => ({
        po_item_id:        parseInt(r.po_item_id),
        product_id:        parseInt(r.product_id),
        quantity_received: parseFloat(r.quantity_received),
        unit_price:        parseFloat(r.unit_price) || 0,
        discount:          parseFloat(r.discount)   || 0,
        tax:               parseFloat(r.tax)        || 0,
        batch_no:          r.batch_no    || null,
        expiry_date:       r.expiry_date || null,
      })),
    }
    setErrors({})
    saveMutation.mutate(payload)
  }

  const err = (f) => errors[f]?.[0]

  const allSelected = displayedPOs.length > 0 && selectedPoIds.size === displayedPOs.length

  /* ── Loading state ────────────────────────────────────────── */
  if (isEdit && loadingGRN) {
    return <div className="flex items-center justify-center py-20 text-sm text-slate-400">Loading…</div>
  }

  return (
    <div className="w-full">
      {/* Page header */}
      <div className="mb-2 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold leading-none text-slate-800">
            {isEdit ? 'Edit GRN' : 'New Goods Received Note'}
          </h1>
          <Breadcrumb crumbs={CRUMBS} />
        </div>
      </div>

      <div className="space-y-2">

        {/* ══ 1. GRN Header ══════════════════════════════════════ */}
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <SectionHeader
            icon={ClipboardList}
            title="GRN Details"
            colorClass="text-indigo-700 bg-indigo-50 border-indigo-100"
          />
          <div className="grid grid-cols-1 gap-x-3 gap-y-1.5 p-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">

            {/* Row 1 */}
            <FieldRow label="GRN Date" required>
              <input
                type="date"
                className={INPUT_CLS}
                value={form.grn_date}
                onChange={(e) => setForm((f) => ({ ...f, grn_date: e.target.value }))}
              />
            </FieldRow>
            <FieldRow label="Transaction Date" required>
              <input
                type="date"
                className={INPUT_CLS}
                value={form.transaction_date}
                onChange={(e) => setForm((f) => ({ ...f, transaction_date: e.target.value }))}
              />
            </FieldRow>

            {/* Row 2 */}
            <FieldRow label="GRN Number" required>
              <input
                type="text"
                className={INPUT_RO}
                value={isEdit ? grnNoPreview : (grnNoPreview || 'Auto-generated')}
                readOnly
                tabIndex={-1}
              />
            </FieldRow>
            <FieldRow label="Reference Number">
              <input
                type="text"
                className={INPUT_CLS}
                placeholder="e.g. REF-0001"
                value={form.reference_no}
                onChange={(e) => setForm((f) => ({ ...f, reference_no: e.target.value }))}
              />
            </FieldRow>

            {/* Row 3 */}
            <FieldRow label="Last GRN Date">
              <input type="text" className={INPUT_RO} value={lastGrnDate || '—'} readOnly tabIndex={-1} />
            </FieldRow>
            <FieldRow label="Last GRN Amount">
              <input type="text" className={INPUT_RO} value={lastGrnAmount || '—'} readOnly tabIndex={-1} />
            </FieldRow>

            {/* Row 4 */}
            <FieldRow label="Supplier Code/Name" required error={err('supplier_id')}>
              <select
                className={SELECT_CLS}
                value={form.supplier_id}
                onChange={(e) => handleSupplierChange(e.target.value)}
              >
                <option value="">Select</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.supplier_code ? `${s.supplier_code} — ` : ''}{s.supplier_name ?? s.name}
                  </option>
                ))}
              </select>
            </FieldRow>
            <FieldRow label="Payment Terms">
              <select
                className={SELECT_CLS}
                value={form.payment_terms}
                onChange={(e) => setForm((f) => ({ ...f, payment_terms: e.target.value }))}
              >
                <option value="">Select</option>
                <option value="immediate">Immediate</option>
                <option value="net_15">Net 15</option>
                <option value="net_30">Net 30</option>
                <option value="net_45">Net 45</option>
                <option value="net_60">Net 60</option>
                <option value="net_90">Net 90</option>
                <option value="cod">Cash on Delivery</option>
              </select>
            </FieldRow>
            <FieldRow label="Remarks">
              <input
                className={INPUT_CLS}
                placeholder="Optional notes"
                value={form.remarks}
                onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
              />
            </FieldRow>
            <FieldRow label="Attachments">
              <div className="flex flex-wrap items-center gap-1 min-h-6.5">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-dashed border-slate-300 text-slate-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors shrink-0"
                  title="Add attachment"
                >
                  <Plus size={11} />
                </button>
                <input ref={fileRef} type="file" multiple className="hidden" onChange={handleAddAttachment} />
                {(form.attachments ?? []).map((name, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-0.5 rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600"
                  >
                    {name}
                    <button type="button" onClick={() => removeAttachment(idx)} className="ml-0.5 text-slate-400 hover:text-red-500">
                      <X size={9} />
                    </button>
                  </span>
                ))}
                {!(form.attachments ?? []).length && (
                  <span className="text-[10px] text-slate-400">No attachments</span>
                )}
              </div>
            </FieldRow>

          </div>
        </div>

        {/* ══ 2. Purchase Order Selection Table ══════════════════ */}
        {!isEdit && (
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <SectionHeader
              icon={ShoppingCart}
              title="Select Purchase Orders to Receive"
              colorClass="text-violet-700 bg-violet-50 border-violet-100"
              extra={
                selectedPoIds.size > 0 && (
                  <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white">
                    {selectedPoIds.size} selected
                  </span>
                )
              }
            />

            {!form.supplier_id ? (
              <div className="py-6 text-center text-sm text-slate-400">
                Select a supplier above to load available Purchase Orders.
              </div>
            ) : loadingPOs ? (
              <div className="py-6 text-center text-sm text-slate-400">Loading Purchase Orders…</div>
            ) : displayedPOs.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-400">
                No confirmed or partially-received Purchase Orders found for this supplier.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-left">
                      <th className="w-8 px-3 py-1.5">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 text-indigo-600 cursor-pointer"
                          checked={allSelected}
                          onChange={toggleAllPOs}
                        />
                      </th>
                      <th className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">PO No.</th>
                      <th className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Date</th>
                      <th className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Supplier</th>
                      <th className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</th>
                      <th className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-right">Amount</th>
                      <th className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-right">Items</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayedPOs.map((po) => {
                      const isSelected = selectedPoIds.has(po.id)
                      return (
                        <tr
                          key={po.id}
                          className={`cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50/60' : 'hover:bg-slate-50'}`}
                          onClick={() => togglePO(po.id)}
                        >
                          <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              className="rounded border-slate-300 text-indigo-600 cursor-pointer"
                              checked={isSelected}
                              onChange={() => togglePO(po.id)}
                            />
                          </td>
                          <td className="px-3 py-1.5 font-semibold text-indigo-700">{po.po_no}</td>
                          <td className="px-3 py-1.5 text-slate-500">{po.po_date ?? po.created_at?.slice(0, 10) ?? '—'}</td>
                          <td className="px-3 py-1.5 text-slate-700 max-w-45 truncate">{po.supplier?.name ?? '—'}</td>
                          <td className="px-3 py-1.5">
                            <StatusBadge label={po.status_label ?? po.status} value={po.status} />
                          </td>
                          <td className="px-3 py-1.5 text-right text-slate-700 font-medium">
                            {po.total_amount != null
                              ? Number(po.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })
                              : '—'}
                          </td>
                          <td className="px-3 py-1.5 text-right text-slate-500">
                            {po.items_count ?? po.items?.length ?? '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ══ 3. Received Items Table ═════════════════════════════ */}
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <SectionHeader
            icon={PackageCheck}
            title="Received Items"
            colorClass="text-blue-700 bg-blue-50 border-blue-100"
            extra={
              loadingItems
                ? <span className="text-[10px] text-blue-400 italic">Loading items…</span>
                : items.length > 0
                  ? <span className="text-[10px] text-slate-500">{items.length} line{items.length !== 1 ? 's' : ''}</span>
                  : null
            }
          />

          {items.length === 0 && !loadingItems ? (
            <div className="py-8 text-center text-sm text-slate-400">
              {isEdit
                ? 'No items found.'
                : 'Select one or more Purchase Orders above to load items.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 text-left border-b border-slate-200">
                    <th className="w-8 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">#</th>
                    <th className="w-24 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Code</th>
                    <th className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Product</th>
                    <th className="w-20 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-right">PO Qty</th>
                    <th className="w-20 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 text-right">Available</th>
                    <th className="w-28 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Qty Received</th>
                    <th className="w-24 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Unit Price</th>
                    <th className="w-20 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 text-center">Disc %</th>
                    <th className="w-20 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600 text-center">Tax %</th>
                    <th className="w-20 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Batch</th>
                    <th className="w-24 px-2 py-1.5 text-[10px] text-right font-bold uppercase tracking-wider text-slate-500">Total</th>
                    <th className="w-8 px-2 py-1.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((row, idx) => {
                    const { amount } = calcItem(row)
                    return (
                      <tr key={row._key} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-3 py-1 text-slate-400">{idx + 1}</td>
                        <td className="px-2 py-1 font-mono text-slate-500">{row.product_code || '—'}</td>
                        <td className="px-2 py-1 font-medium text-slate-700">{row.product_name || '—'}</td>
                        <td className="px-2 py-1 text-right text-slate-500">{Number(row.quantity_ordered).toLocaleString()}</td>
                        <td className="px-2 py-1 text-right">
                          {row.remaining_qty != null ? (
                            <span className={`font-semibold text-xs ${row.already_received > 0 ? 'text-amber-600' : 'text-slate-500'}`}>
                              {Number(row.remaining_qty).toLocaleString()}
                              {row.already_received > 0 && (
                                <span className="block text-[9px] font-normal text-slate-400">
                                  Prev: {Number(row.already_received).toLocaleString()}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="number" min="0" step="0.0001"
                            max={row.remaining_qty ?? undefined}
                            className={TABLE_INPUT + ' w-24'}
                            value={row.quantity_received}
                            onChange={(e) => setRowField(idx, 'quantity_received', e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="number" min="0" step="0.01"
                            className={TABLE_INPUT + ' w-20'}
                            value={row.unit_price}
                            onChange={(e) => setRowField(idx, 'unit_price', e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="number" min="0" max="100" step="0.01" placeholder="0"
                            className="block w-full rounded border border-amber-200 bg-amber-50/50 px-1.5 py-0.5 text-xs text-slate-800 outline-none transition-all focus:border-amber-400 focus:bg-white"
                            value={row.discount}
                            onChange={(e) => setRowField(idx, 'discount', e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="number" min="0" max="100" step="0.01" placeholder="0"
                            className="block w-full rounded border border-emerald-200 bg-emerald-50/50 px-1.5 py-0.5 text-xs text-slate-800 outline-none transition-all focus:border-emerald-400 focus:bg-white"
                            value={row.tax}
                            onChange={(e) => setRowField(idx, 'tax', e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-1">
                          {row.is_batch ? (
                            <input
                              className={TABLE_INPUT + ' w-20'}
                              placeholder="Batch"
                              value={row.batch_no}
                              onChange={(e) => setRowField(idx, 'batch_no', e.target.value)}
                            />
                          ) : <span className="text-slate-300 italic px-2">—</span>}
                        </td>
                        <td className="px-2 py-1 text-right font-bold text-slate-800 tabular-nums">
                          {amount > 0 ? amount.toLocaleString(undefined, { minimumFractionDigits: 2 }) : <span className="text-slate-300 font-normal">—</span>}
                        </td>
                        <td className="px-2 py-1 text-center">
                          <button
                            type="button"
                            onClick={() => removeRow(idx)}
                            className="rounded p-0.5 text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50/50">
                    <td colSpan={7} />
                    <td className="px-1.5 py-1.5 text-center text-xs font-bold text-amber-600 tabular-nums">
                      -{totals.disc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-1.5 py-1.5 text-center text-xs font-bold text-emerald-600 tabular-nums">
                      +{totals.tax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td colSpan={1} />
                    <td className="px-2 py-1.5 text-right text-sm font-black text-slate-800 tabular-nums">
                      {totals.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td />
                  </tr>
                  <tr className="bg-indigo-50 border-t border-indigo-100">
                    <td colSpan={7} className="px-3 py-1.5">
                      <div className="flex items-center gap-4 text-xs">
                        <span className="font-bold uppercase tracking-wider text-indigo-600">Summary</span>
                        <span className="text-slate-500">Gross: <span className="font-bold text-slate-700">{totals.gross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></span>
                        <span className="text-amber-600">Disc: <span className="font-bold">-{totals.disc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></span>
                        <span className="text-emerald-600">Tax: <span className="font-bold">+{totals.tax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></span>
                      </div>
                    </td>
                    <td colSpan={4} className="px-3 py-1.5 text-right">
                      <div className="flex flex-col items-end leading-tight">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">Net Total</span>
                        <span className="text-base font-black text-indigo-700 tabular-nums">
                          {totals.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-3 py-2">
            <button
              type="button"
              onClick={() => navigate('/inventory/goods-received-notes')}
              className="rounded border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saveMutation.isPending || items.length === 0}
              onClick={handleSubmit}
              className="rounded bg-indigo-600 px-4 py-1 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              {saveMutation.isPending ? 'Saving…' : isEdit ? 'Update GRN' : 'Create GRN (Draft)'}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
