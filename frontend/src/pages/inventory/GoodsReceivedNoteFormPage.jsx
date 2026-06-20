import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ClipboardList, PackageCheck, Plus, Trash2, Warehouse, X } from 'lucide-react'
import {
  createGoodsReceivedNote,
  getGoodsReceivedNote,
  getLastGrnForSupplier,
  getNextGrnNo,
  getPoOutstandingItems,
  updateGoodsReceivedNote,
} from '../../api/goodsReceivedNotes'
import { getPurchaseOrders } from '../../api/purchaseOrders'
import { getAllSuppliers } from '../../api/suppliers'
import { getAllStores } from '../../api/stores'
import { getAllLocations } from '../../api/locations'
import Breadcrumb from '../../components/Breadcrumb'
import { showError, showSuccess } from '../../utils/alerts'

const INPUT_CLS           = 'block w-full rounded-md border-2 border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/15'
const INPUT_RO_CLS        = 'block w-full rounded-md border-2 border-slate-100 bg-slate-100 px-2 py-1 text-xs text-slate-500 outline-none cursor-default'
const INPUT_ERR_CLS       = 'block w-full rounded-md border-2 border-red-300 bg-red-50/40 px-2 py-1 text-xs text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-red-500 focus:bg-white focus:ring-2 focus:ring-red-500/15'
const SELECT_CLS          = 'block w-full rounded-md border-2 border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-800 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/15 cursor-pointer'
const SELECT_ERR_CLS      = 'block w-full rounded-md border-2 border-red-300 bg-red-50/40 px-2 py-1 text-xs text-slate-800 outline-none transition-all focus:border-red-500 focus:bg-white focus:ring-2 focus:ring-red-500/15 cursor-pointer'
const SELECT_DISABLED_CLS = 'block w-full rounded-md border-2 border-slate-200 bg-slate-100 px-2 py-1 text-xs text-slate-400 outline-none cursor-not-allowed'
const TABLE_INPUT_CLS     = 'block w-full rounded border-2 border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/15'
const LABEL_CLS           = 'block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5'
const ERR_CLS             = 'mt-0.5 text-[10px] text-red-500'

const FIELD_ROW = 'flex items-start gap-2'
const COLON_CLS = 'mt-1.5 text-xs text-slate-400 flex-shrink-0'
const LABEL_COL = 'w-28 flex-shrink-0 mt-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600'
const VALUE_COL = 'flex-1 min-w-0'

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

function FieldRow({ label, required, children, error }) {
  return (
    <div className={FIELD_ROW}>
      <span className={LABEL_COL}>
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      <span className={COLON_CLS}>:</span>
      <div className={VALUE_COL}>
        {children}
        {error && <p className={ERR_CLS}>{error}</p>}
      </div>
    </div>
  )
}

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

  const [form, setForm] = useState({
    po_id:            poIdFromUrl ?? '',
    supplier_id:      '',
    grn_date:         today,
    transaction_date: today,
    reference_no:     '',
    store_id:         '',
    location_id:      '',
    remarks:          '',
    payment_terms:    '',
    attachments:      [],
  })
  const [grnNoPreview,   setGrnNoPreview]   = useState('')
  const [lastGrnDate,    setLastGrnDate]    = useState('')
  const [lastGrnAmount,  setLastGrnAmount]  = useState('')
  const [items,          setItems]          = useState([])
  const [errors,         setErrors]         = useState({})
  const [loadingPOItems, setLoadingPOItems] = useState(false)

  // Fetch next GRN number preview (create mode only)
  useEffect(() => {
    if (isEdit) return
    getNextGrnNo()
      .then((no) => setGrnNoPreview(no))
      .catch(() => setGrnNoPreview('Auto-generated'))
  }, [isEdit])

  // Stores / Locations
  const { data: stores    = [] } = useQuery({ queryKey: ['stores-all'],    queryFn: getAllStores })
  const { data: locations = [] } = useQuery({ queryKey: ['locations-all'], queryFn: getAllLocations })
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers-all'], queryFn: getAllSuppliers })

  const receivingStores = form.location_id
    ? stores.filter((s) => String(s.location_id) === String(form.location_id))
    : []

  // POs: confirmed + partially_received
  const { data: openPOs    } = useQuery({ queryKey: ['pos-open'],    queryFn: () => getPurchaseOrders(1, { status: 'confirmed' }) })
  const { data: partialPOs } = useQuery({ queryKey: ['pos-partial'], queryFn: () => getPurchaseOrders(1, { status: 'partially_received' }) })

  const availablePOs = [
    ...(openPOs?.data ?? []),
    ...(partialPOs?.data ?? []),
  ]

  // Filter POs by selected supplier
  const filteredPOs = form.supplier_id
    ? availablePOs.filter((po) => String(po.supplier_id) === String(form.supplier_id))
    : availablePOs

  // Load existing GRN for edit
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
      po_id:            grn.po_id            ?? '',
      supplier_id:      grn.supplier_id      ?? '',
      grn_date:         grn.grn_date         ?? today,
      transaction_date: grn.transaction_date ?? today,
      reference_no:     grn.reference_no     ?? '',
      store_id:         grn.store_id         ?? '',
      location_id:      grn.location_id      ?? '',
      remarks:          grn.remarks          ?? '',
      payment_terms:    grn.payment_terms    ?? '',
      attachments:      grn.attachments      ?? [],
    })
    if (grn.items?.length) {
      setItems(grn.items.map((it) => ({
        _key:              it.id,
        po_item_id:        it.po_item_id,
        product_id:        it.product_id,
        product_code:      it.product?.product_code ?? '',
        product_name:      it.product?.name ?? '',
        quantity_ordered:  it.quantity_ordered,
        quantity_received: it.quantity_received,
        unit_price:        it.unit_price,
        is_batch:          it.product?.is_batch ?? false,
        batch_no:          it.batch_no ?? '',
        expiry_date:       it.expiry_date ?? '',
      })))
    }
    // Load last GRN for the supplier
    if (grn.supplier_id) fetchLastGrn(grn.supplier_id)
  }, [existingGRN])

  // When PO is selected → auto-fill supplier, load PO items
  const handlePOChange = (poId) => {
    setForm((f) => ({ ...f, po_id: poId }))
    const po = availablePOs.find((p) => String(p.id) === String(poId))
    if (po?.supplier_id) {
      setForm((f) => ({ ...f, po_id: poId, supplier_id: String(po.supplier_id) }))
      fetchLastGrn(po.supplier_id)
    }
    loadPOItems(poId)
  }

  // When supplier changes → clear PO if it doesn't match + fetch last GRN
  const handleSupplierChange = (supplierId) => {
    setForm((f) => {
      const currentPO = availablePOs.find((p) => String(p.id) === String(f.po_id))
      const poStillValid = currentPO && String(currentPO.supplier_id) === String(supplierId)
      return { ...f, supplier_id: supplierId, po_id: poStillValid ? f.po_id : '' }
    })
    if (!supplierId) { setLastGrnDate(''); setLastGrnAmount(''); return }
    fetchLastGrn(supplierId)
  }

  const fetchLastGrn = (supplierId) => {
    getLastGrnForSupplier(supplierId)
      .then((data) => {
        setLastGrnDate(data?.grn_date   ?? '')
        setLastGrnAmount(data?.total_amount != null ? Number(data.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '')
      })
      .catch(() => { setLastGrnDate(''); setLastGrnAmount('') })
  }

  const loadPOItems = async (poId) => {
    if (!poId) { setItems([]); return }
    setLoadingPOItems(true)
    try {
      const result = await getPoOutstandingItems(poId)
      setItems((result.data ?? []).map((it) => ({
        _key:              Date.now() + Math.random(),
        po_item_id:        it.po_item_id,
        product_id:        it.product_id,
        product_code:      it.product?.product_code ?? '',
        product_name:      it.product?.name ?? '',
        quantity_ordered:  it.quantity_ordered,
        quantity_received: it.remaining_qty,
        unit_price:        it.unit_price,
        is_batch:          it.product?.is_batch ?? false,
        batch_no:          '',
        expiry_date:       '',
      })))
    } catch {
      showError('Failed to load PO items.')
    } finally {
      setLoadingPOItems(false)
    }
  }

  useEffect(() => {
    if (poIdFromUrl && !isEdit) {
      setForm((f) => ({ ...f, po_id: poIdFromUrl }))
      loadPOItems(poIdFromUrl)
      const po = availablePOs.find((p) => String(p.id) === String(poIdFromUrl))
      if (po?.supplier_id) {
        setForm((f) => ({ ...f, po_id: poIdFromUrl, supplier_id: String(po.supplier_id) }))
        fetchLastGrn(po.supplier_id)
      }
    }
  }, [poIdFromUrl, availablePOs.length])

  // Attachment handling
  const handleAddAttachment = (e) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    const names = files.map((f) => f.name)
    setForm((prev) => ({ ...prev, attachments: [...(prev.attachments ?? []), ...names] }))
    if (fileRef.current) fileRef.current.value = ''
  }

  const removeAttachment = (idx) =>
    setForm((prev) => ({ ...prev, attachments: prev.attachments.filter((_, i) => i !== idx) }))

  const setRowField = (idx, field, value) =>
    setItems((prev) => prev.map((row, i) => i === idx ? { ...row, [field]: value } : row))

  const removeRow = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx))

  const totalAmount = items.reduce(
    (sum, r) => sum + (parseFloat(r.quantity_received) || 0) * (parseFloat(r.unit_price) || 0), 0
  )

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
    const clientErrors = {}
    if (!form.location_id) clientErrors.location_id = ['Receiving location is required.']
    if (!form.store_id)    clientErrors.store_id    = ['Receiving store is required.']
    if (Object.keys(clientErrors).length) {
      setErrors(clientErrors)
      showError('Please fill in all required fields.')
      return
    }

    const payload = {
      po_id:            form.po_id            || null,
      supplier_id:      form.supplier_id      || null,
      grn_date:         form.grn_date,
      transaction_date: form.transaction_date  || null,
      reference_no:     form.reference_no     || null,
      store_id:         form.store_id         || null,
      location_id:      form.location_id      || null,
      remarks:          form.remarks          || null,
      payment_terms:    form.payment_terms    || null,
      attachments:      form.attachments.length ? form.attachments : null,
      items: items
        .filter((r) => r.po_item_id && parseFloat(r.quantity_received) > 0)
        .map((r) => ({
          po_item_id:        parseInt(r.po_item_id),
          product_id:        parseInt(r.product_id),
          quantity_received: parseFloat(r.quantity_received),
          unit_price:        parseFloat(r.unit_price) || 0,
          batch_no:          r.batch_no   || null,
          expiry_date:       r.expiry_date || null,
        })),
    }
    setErrors({})
    saveMutation.mutate(payload)
  }

  const err = (field) => errors[field]?.[0]

  if (isEdit && loadingGRN) return <div className="flex items-center justify-center py-20 text-sm text-slate-400">Loading…</div>

  return (
    <div className="w-full">
      {/* Page header */}
      <div className="mb-2 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold leading-none text-slate-800">{isEdit ? 'Edit GRN' : 'New Goods Received Note'}</h1>
          <Breadcrumb crumbs={CRUMBS} />
        </div>
      </div>

      <div className="space-y-2">
        {/* ── GRN Header card (matches image layout) ── */}
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <SectionHeader icon={ClipboardList} title="GRN Details" colorClass="text-indigo-700 bg-indigo-50 border-indigo-100" />
          <div className="grid grid-cols-1 gap-x-4 gap-y-2 p-3 lg:grid-cols-2">

            {/* Row 1: GRN Date | Transaction Date */}
            <FieldRow label="GRN Date" required>
              <input
                type="date"
                className={err('grn_date') ? INPUT_ERR_CLS : INPUT_CLS}
                value={form.grn_date}
                onChange={(e) => setForm((f) => ({ ...f, grn_date: e.target.value }))}
              />
              {err('grn_date') && <p className={ERR_CLS}>{err('grn_date')}</p>}
            </FieldRow>

            <FieldRow label="Transaction Date" required>
              <input
                type="date"
                className={INPUT_CLS}
                value={form.transaction_date}
                onChange={(e) => setForm((f) => ({ ...f, transaction_date: e.target.value }))}
              />
            </FieldRow>

            {/* Row 2: GRN Number (auto) | Reference Number */}
            <FieldRow label="GRN Number" required>
              <input
                type="text"
                className={INPUT_RO_CLS}
                value={isEdit ? grnNoPreview : (grnNoPreview || 'Auto-generated')}
                readOnly
                tabIndex={-1}
              />
            </FieldRow>

            <FieldRow label="Reference Number">
              <input
                type="text"
                className={INPUT_CLS}
                placeholder="e.g. RPO-000051"
                value={form.reference_no}
                onChange={(e) => setForm((f) => ({ ...f, reference_no: e.target.value }))}
              />
            </FieldRow>

            {/* Row 3: Last GRN Date | Last GRN Amount */}
            <FieldRow label="Last GRN Date">
              <input type="text" className={INPUT_RO_CLS} value={lastGrnDate || '—'} readOnly tabIndex={-1} />
            </FieldRow>

            <FieldRow label="Last GRN Amount">
              <input type="text" className={INPUT_RO_CLS} value={lastGrnAmount || '—'} readOnly tabIndex={-1} />
            </FieldRow>

            {/* Row 4: Supplier Code/Name | Attachments */}
            <FieldRow label="Supplier Code/Name" required error={err('supplier_id')}>
              <select
                className={err('supplier_id') ? SELECT_ERR_CLS : SELECT_CLS}
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

            <FieldRow label="Attachments">
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-dashed border-slate-300 text-slate-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors flex-shrink-0"
                  title="Add attachment"
                >
                  <Plus size={12} />
                </button>
                <input ref={fileRef} type="file" multiple className="hidden" onChange={handleAddAttachment} />
                {(form.attachments ?? []).map((name, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-0.5 rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600"
                  >
                    {name}
                    <button type="button" onClick={() => removeAttachment(idx)} className="text-slate-400 hover:text-red-500 ml-0.5">
                      <X size={9} />
                    </button>
                  </span>
                ))}
                {!(form.attachments ?? []).length && (
                  <span className="text-[10px] text-slate-400">No attachments</span>
                )}
              </div>
            </FieldRow>

            {/* Row 5: PO Number | Payment Terms */}
            <FieldRow label="PO Number" error={err('po_id')}>
              <select
                className={err('po_id') ? SELECT_ERR_CLS : SELECT_CLS}
                value={form.po_id}
                onChange={(e) => handlePOChange(e.target.value)}
                disabled={isEdit}
              >
                <option value="">Select</option>
                {filteredPOs.map((po) => (
                  <option key={po.id} value={po.id}>
                    {po.po_no} — {po.supplier?.name ?? ''} ({po.status_label})
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
          </div>
        </div>

        {/* ── Receiving Destination ── */}
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <SectionHeader icon={Warehouse} title="Receiving Destination" colorClass="text-emerald-700 bg-emerald-50 border-emerald-100" />
          <div className="grid grid-cols-1 gap-x-4 gap-y-2 p-3 lg:grid-cols-2">
            <FieldRow label="Receiving Location" required error={err('location_id')}>
              <select
                className={err('location_id') ? SELECT_ERR_CLS : SELECT_CLS}
                value={form.location_id}
                onChange={(e) => {
                  setForm((f) => ({ ...f, location_id: e.target.value, store_id: '' }))
                  if (errors.location_id) setErrors((prev) => ({ ...prev, location_id: undefined, store_id: undefined }))
                }}
              >
                <option value="">— Select location —</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.location_name ?? l.name}</option>)}
              </select>
            </FieldRow>

            <FieldRow
              label="Receiving Store"
              required
              error={err('store_id')}
            >
              {form.location_id ? (
                <select
                  className={err('store_id') ? SELECT_ERR_CLS : SELECT_CLS}
                  value={form.store_id}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, store_id: e.target.value }))
                    if (errors.store_id) setErrors((prev) => ({ ...prev, store_id: undefined }))
                  }}
                >
                  <option value="">— Select store —</option>
                  {receivingStores.map((s) => <option key={s.id} value={s.id}>{s.store_name}</option>)}
                </select>
              ) : (
                <select className={SELECT_DISABLED_CLS} disabled>
                  <option>— Select location first —</option>
                </select>
              )}
            </FieldRow>

            <div className="lg:col-span-2 rounded bg-amber-50 border border-amber-100 px-2.5 py-1.5">
              <p className="text-[10px] text-amber-700">
                <strong>Note:</strong> When confirmed, stock will be added to the selected store &amp; location. This action is irreversible.
              </p>
            </div>

            <FieldRow label="Remarks">
              <input
                className={INPUT_CLS}
                placeholder="Optional notes"
                value={form.remarks}
                onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
              />
            </FieldRow>
          </div>
        </div>

        {/* ── Items Table ── */}
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <SectionHeader
            icon={PackageCheck}
            title="Received Items"
            colorClass="text-blue-700 bg-blue-50 border-blue-100"
            extra={loadingPOItems && <span className="text-[10px] text-blue-400 italic">Loading items from PO…</span>}
          />

          {items.length === 0 && !loadingPOItems ? (
            <div className="py-6 text-center text-sm text-slate-400">
              Select a Purchase Order above to load its outstanding items.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 text-left border-b border-slate-200">
                    <th className="w-8 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">#</th>
                    <th className="w-28 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Code</th>
                    <th className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Product</th>
                    <th className="w-24 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-right">Ordered</th>
                    <th className="w-28 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Qty Received</th>
                    <th className="w-24 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Unit Price</th>
                    <th className="w-24 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Batch No</th>
                    <th className="w-24 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Expiry</th>
                    <th className="w-24 px-3 py-1.5 text-[10px] text-right font-bold uppercase tracking-wider text-slate-500">Line Total</th>
                    <th className="w-8 px-2 py-1.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((row, idx) => (
                    <tr key={row._key} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-3 py-1 text-slate-400">{idx + 1}</td>
                      <td className="px-2 py-1 font-mono text-slate-500">{row.product_code || '—'}</td>
                      <td className="px-2 py-1 font-medium text-slate-700">{row.product_name || '—'}</td>
                      <td className="px-3 py-1 text-right text-slate-500">{Number(row.quantity_ordered).toLocaleString()}</td>
                      <td className="px-2 py-1">
                        <input
                          type="number" min="0" step="0.0001" max={row.quantity_ordered}
                          className={TABLE_INPUT_CLS + ' w-24'}
                          value={row.quantity_received}
                          onChange={(e) => setRowField(idx, 'quantity_received', e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number" min="0" step="0.01"
                          className={TABLE_INPUT_CLS + ' w-24'}
                          value={row.unit_price}
                          onChange={(e) => setRowField(idx, 'unit_price', e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-1">
                        {row.is_batch ? (
                          <input
                            className={TABLE_INPUT_CLS + ' w-24'}
                            placeholder="Batch"
                            value={row.batch_no}
                            onChange={(e) => setRowField(idx, 'batch_no', e.target.value)}
                          />
                        ) : <span className="text-slate-300 italic px-2">—</span>}
                      </td>
                      <td className="px-2 py-1">
                        {row.is_batch ? (
                          <input
                            type="date"
                            className={TABLE_INPUT_CLS + ' w-28'}
                            value={row.expiry_date}
                            onChange={(e) => setRowField(idx, 'expiry_date', e.target.value)}
                          />
                        ) : <span className="text-slate-300 italic px-2">—</span>}
                      </td>
                      <td className="px-3 py-1 text-right font-medium text-slate-700">
                        {((parseFloat(row.quantity_received) || 0) * (parseFloat(row.unit_price) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-2 py-1 text-center">
                        <button type="button" onClick={() => removeRow(idx)} className="rounded p-0.5 text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50">
                    <td colSpan={8} className="px-3 py-1.5 text-right text-xs font-semibold text-slate-700">Total Amount:</td>
                    <td className="px-3 py-1.5 text-right text-xs font-bold text-slate-800">
                      {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-2 py-1.5"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-3 py-2">
            <button
              type="button"
              onClick={() => navigate('/inventory/goods-received-notes')}
              className="rounded border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saveMutation.isPending || items.length === 0}
              onClick={handleSubmit}
              className="rounded bg-indigo-600 px-4 py-1 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
            >
              {saveMutation.isPending ? 'Saving…' : isEdit ? 'Update GRN' : 'Create GRN (Draft)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
