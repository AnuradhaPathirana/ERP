import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  CalendarDays, ClipboardList, Plus, RefreshCw, Save, Send, Trash2, Warehouse,
} from 'lucide-react'
import {
  createPurchaseRequest,
  getPurchaseRequest,
  updatePurchaseRequest,
} from '../../api/purchaseRequests'
import { getAllLocations } from '../../api/locations'
import { getAllStores } from '../../api/stores'
import Breadcrumb from '../../components/Breadcrumb'
import { showError, showSuccess } from '../../utils/alerts'
import api from '../../api/axios'

const TRANSPORT_MODES = ['Road', 'Rail', 'Air', 'Sea', 'Courier']

const INPUT_CLS =
  'block w-full rounded-md border-2 border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/15'
const INPUT_ERR_CLS =
  'block w-full rounded-md border-2 border-red-300 bg-red-50/40 px-2 py-1 text-xs text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-red-500 focus:bg-white focus:ring-2 focus:ring-red-500/15'
const SELECT_CLS =
  'block w-full rounded-md border-2 border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-800 outline-none transition-all focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/15 cursor-pointer'
const SELECT_ERR_CLS =
  'block w-full rounded-md border-2 border-red-300 bg-red-50/40 px-2 py-1 text-xs text-slate-800 outline-none transition-all focus:border-red-500 focus:bg-white focus:ring-2 focus:ring-red-500/15 cursor-pointer'
const SELECT_DISABLED_CLS =
  'block w-full rounded-md border-2 border-slate-200 bg-slate-100 px-2 py-1 text-xs text-slate-400 outline-none cursor-not-allowed'
const LABEL_CLS = 'block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5'
const ERR_CLS   = 'mt-0.5 text-[10px] text-red-500'

function SectionHeader({ icon: Icon, title, colorClass }) {
  return (
    <div className={`flex items-center gap-1.5 px-3 py-2 border-b ${colorClass}`}>
      {Icon && <Icon size={13} />}
      <h2 className="text-xs font-bold">{title}</h2>
    </div>
  )
}

function emptyRow() {
  return {
    _key:          Date.now() + Math.random(),
    product_id:    '',
    product_code:  '',
    product_name:  '',
    quantity:      '',
    stock_in_hand: null,
  }
}

export default function PurchaseRequestFormPage() {
  const { id }   = useParams()
  const isEdit   = Boolean(id)
  const navigate = useNavigate()

  const CRUMBS = [
    { label: 'Inventory', to: '/inventory/products' },
    { label: 'Purchase Requests', to: '/inventory/purchase-requests' },
    { label: isEdit ? 'Edit PR' : 'New PR' },
  ]

  const today = new Date().toISOString().slice(0, 10)

  const [form, setForm] = useState({
    request_date:        today,
    reference_no:        '',
    purpose:             '',
    source_location_id:  '',
    source_store_id:     '',
    target_location_id:  '',
    target_store_id:     '',
    required_date:       '',
    transport_mode:      '',
    remarks:             '',
    submit_for_approval: false,
  })
  const [items, setItems]     = useState([emptyRow()])
  const [errors, setErrors]   = useState({})
  const [products, setProducts] = useState([])
  const stockCache = useRef({})

  const { data: locations = [] } = useQuery({ queryKey: ['locations-all'], queryFn: getAllLocations })
  const { data: stores = [] }    = useQuery({ queryKey: ['stores-all'],    queryFn: getAllStores })

  // Stores filtered by their location_id — resets child store when location changes
  const sourceStores = form.source_location_id
    ? stores.filter((s) => String(s.location_id) === String(form.source_location_id))
    : []

  const targetStores = form.target_location_id
    ? stores.filter((s) => String(s.location_id) === String(form.target_location_id))
    : []

  useEffect(() => {
    api.get('/api/v1/products', { params: { per_page: 1000 } })
      .then((r) => setProducts(r.data.data ?? []))
      .catch(() => {})
  }, [])

  const { data: existingPR, isLoading: loadingPR } = useQuery({
    queryKey: ['purchase-request', id],
    queryFn:  () => getPurchaseRequest(id),
    enabled:  isEdit,
  })

  useEffect(() => {
    if (!existingPR?.data) return
    const pr = existingPR.data
    setForm({
      request_date:        pr.request_date        ?? today,
      reference_no:        pr.reference_no        ?? '',
      purpose:             pr.purpose             ?? '',
      source_location_id:  pr.source_location_id  ?? '',
      source_store_id:     pr.source_store_id     ?? '',
      target_location_id:  pr.target_location_id  ?? '',
      target_store_id:     pr.target_store_id     ?? '',
      required_date:       pr.required_date       ?? '',
      transport_mode:      pr.transport_mode      ?? '',
      remarks:             pr.remarks             ?? '',
      submit_for_approval: false,
    })
    if (pr.items?.length) {
      setItems(pr.items.map((it) => ({
        _key:          it.id,
        product_id:    it.product_id,
        product_code:  it.product?.product_code ?? '',
        product_name:  it.product?.name         ?? '',
        quantity:      it.quantity,
        stock_in_hand: null,
      })))
    }
  }, [existingPR])

  const fetchStock = useCallback(async (productId, storeId) => {
    if (!productId || !storeId) return null
    const cacheKey = `${productId}_${storeId}`
    if (stockCache.current[cacheKey] !== undefined) return stockCache.current[cacheKey]
    try {
      const r   = await api.get('/api/v1/stock/product', { params: { product_id: productId, store_id: storeId } })
      const qty = r.data?.data?.total_stock ?? 0
      stockCache.current[cacheKey] = qty
      return qty
    } catch {
      return null
    }
  }, [])

  const handleProductSelect = async (idx, productId) => {
    const product = products.find((p) => p.id === parseInt(productId))
    const stock   = product ? await fetchStock(product.id, form.source_store_id) : null
    setItems((prev) => prev.map((row, i) =>
      i === idx
        ? { ...row, product_id: productId, product_code: product?.product_code ?? '', product_name: product?.name ?? '', stock_in_hand: stock }
        : row,
    ))
  }

  const addRows = (n = 1) => setItems((prev) => [...prev, ...Array.from({ length: n }, emptyRow)])
  const removeRow = (idx) => setItems((prev) => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev)
  const setRowField = (idx, field, value) => setItems((prev) => prev.map((row, i) => i === idx ? { ...row, [field]: value } : row))
  const setField = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const totalQty = items.reduce((sum, r) => sum + (parseFloat(r.quantity) || 0), 0)

  const saveMutation = useMutation({
    mutationFn: (payload) => isEdit ? updatePurchaseRequest(id, payload) : createPurchaseRequest(payload),
    onSuccess: () => {
      showSuccess(isEdit ? 'Purchase request updated.' : 'Purchase request created.')
      navigate('/inventory/purchase-requests')
    },
    onError: (e) => {
      const data = e.response?.data
      if (data?.errors) setErrors(data.errors)
      showError(data?.message ?? 'Failed to save purchase request.')
    },
  })

  const handleSubmit = (submitForApproval) => {
    const clientErrors = {}

    if (!form.reference_no.trim())  clientErrors.reference_no        = ['Reference No is required.']
    if (!form.source_location_id)   clientErrors.source_location_id  = ['Location is required.']
    if (!form.source_store_id)      clientErrors.source_store_id     = ['Store is required.']

    const validItems = items.filter((r) => r.product_id && parseFloat(r.quantity) > 0)
    if (validItems.length === 0)    clientErrors.items = ['At least one product with a valid quantity is required.']

    if (Object.keys(clientErrors).length) {
      setErrors(clientErrors)
      showError('Please fill in all required fields.')
      return
    }

    setErrors({})
    saveMutation.mutate({
      ...form,
      submit_for_approval: submitForApproval,
      source_location_id:  form.source_location_id || null,
      source_store_id:     form.source_store_id    || null,
      target_location_id:  form.target_location_id || null,
      target_store_id:     form.target_store_id    || null,
      items: validItems.map((r) => ({ product_id: parseInt(r.product_id), quantity: parseFloat(r.quantity) })),
    })
  }

  const handleClear = () => {
    setForm({
      request_date: today, reference_no: '', purpose: '',
      source_location_id: '', source_store_id: '',
      target_location_id: '', target_store_id: '',
      required_date: '', transport_mode: '', remarks: '',
      submit_for_approval: false,
    })
    setItems([emptyRow()])
    setErrors({})
  }

  const err = (f) => errors[f]?.[0]

  if (isEdit && loadingPR) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <RefreshCw size={14} className="animate-spin" /> Loading…
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* Page Header */}
      <div className="mb-2 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold leading-none text-slate-800">
            {isEdit ? 'Edit Purchase Request' : 'New Purchase Request'}
          </h1>
          <Breadcrumb crumbs={CRUMBS} />
        </div>
      </div>

      {/* Main 3-column grid: Items (2/3) | Detail cards (1/3) */}
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">

        {/* ══════════════ LEFT: Request Items ══════════════ */}
        <div className="lg:col-span-2">
          <div className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <SectionHeader
              icon={ClipboardList}
              title="Request Items"
              colorClass="text-indigo-700 bg-indigo-50 border-indigo-100"
            />

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="w-9 px-3 py-1.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">#</th>
                    <th className="w-28 px-3 py-1.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Code</th>
                    <th className="px-3 py-1.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Product Name</th>
                    <th className="w-32 px-3 py-1.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Qty</th>
                    <th className="w-32 px-3 py-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">Stock in Hand</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((row, idx) => {
                    // IDs already chosen in every OTHER row — exclude them from this row's dropdown
                    const usedIds = new Set(
                      items
                        .filter((_, i) => i !== idx)
                        .map((r) => r.product_id)
                        .filter(Boolean)
                        .map(Number),
                    )
                    const availableProducts = products.filter((p) => !usedIds.has(p.id))

                    return (
                    <tr key={row._key} className="group hover:bg-slate-50/60 transition-colors">
                      <td className="px-3 py-1 text-slate-400 font-medium tabular-nums">{idx + 1}</td>
                      <td className="px-1.5 py-1">
                        <input
                          readOnly
                          value={row.product_code}
                          placeholder="—"
                          className="block w-full rounded-md border-2 border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-500 outline-none cursor-not-allowed"
                        />
                      </td>
                      <td className="px-1.5 py-1 min-w-40">
                        <select
                          value={row.product_id}
                          onChange={(e) => handleProductSelect(idx, e.target.value)}
                          className="block w-full rounded-md border-2 border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-800 outline-none transition-all focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/15 cursor-pointer"
                        >
                          <option value="">— Select product —</option>
                          {availableProducts.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-1.5 py-1">
                        <input
                          type="number"
                          min="0"
                          step="0.0001"
                          placeholder="0.00"
                          value={row.quantity}
                          onChange={(e) => setRowField(idx, 'quantity', e.target.value)}
                          className="block w-full rounded-md border-2 border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-800 outline-none transition-all focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/15"
                        />
                      </td>
                      <td className="px-3 py-1 text-center">
                        {row.stock_in_hand !== null ? (
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${
                            Number(row.stock_in_hand) > 0
                              ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                              : 'bg-red-50 text-red-600 ring-1 ring-red-200'
                          }`}>
                            {Number(row.stock_in_hand).toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-1.5 py-1 text-center">
                        <button
                          type="button"
                          onClick={() => removeRow(idx)}
                          className="rounded-md p-1 text-slate-300 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 transition-all"
                          title="Remove"
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  )})}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50">
                    <td colSpan={3} className="px-3 py-1.5">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => addRows(1)}
                          className="flex items-center gap-1 rounded border-2 border-indigo-200 bg-white px-2.5 py-1 text-xs font-bold text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 transition-colors"
                        >
                          <Plus size={10} /> Add Row
                        </button>
                        <button
                          type="button"
                          onClick={() => addRows(5)}
                          className="flex items-center gap-1 rounded border-2 border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-500 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                        >
                          <Plus size={10} /> Add 5 Rows
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-1.5 text-left text-sm font-black text-slate-700 tabular-nums">
                      {totalQty > 0 ? totalQty.toLocaleString(undefined, { maximumFractionDigits: 4 }) : '—'}
                    </td>
                    <td colSpan={2} className="px-3 py-1.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Total Qty
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Items validation error */}
            {err('items') && (
              <div className="border-t border-red-100 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600">
                {err('items')}
              </div>
            )}

            {/* Bottom Actions Bar */}
            <div className="mt-auto flex items-center justify-between border-t-2 border-slate-100 bg-white px-3 py-2">
              {/* Custom Checkbox */}
              <label className="flex cursor-pointer select-none items-center gap-2 group">
                <input
                  id="submit-approval-check"
                  type="checkbox"
                  checked={form.submit_for_approval}
                  onChange={(e) => setForm((f) => ({ ...f, submit_for_approval: e.target.checked }))}
                  className="sr-only"
                />
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-all ${
                  form.submit_for_approval
                    ? 'border-emerald-500 bg-emerald-500'
                    : 'border-slate-300 bg-white group-hover:border-emerald-400'
                }`}>
                  {form.submit_for_approval && (
                    <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
                <span className="text-xs font-semibold text-slate-600 group-hover:text-slate-800 transition-colors">
                  Submit for Approval
                </span>
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClear}
                  className="flex items-center gap-1 rounded border-2 border-red-200 bg-white px-3 py-1 text-xs font-bold text-red-500 transition-all hover:bg-red-50 hover:border-red-300 active:scale-95"
                >
                  <RefreshCw size={11} /> Clear
                </button>
                <button
                  type="button"
                  disabled={saveMutation.isPending}
                  onClick={() => handleSubmit(form.submit_for_approval)}
                  className={`flex items-center gap-1 rounded px-4 py-1 text-xs font-bold text-white shadow-sm transition-all disabled:opacity-60 active:scale-95 ${
                    form.submit_for_approval
                      ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100'
                      : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'
                  }`}
                >
                  {saveMutation.isPending ? (
                    <><RefreshCw size={11} className="animate-spin" /> Saving…</>
                  ) : isEdit ? (
                    <><Save size={11} /> Update</>
                  ) : form.submit_for_approval ? (
                    <><Send size={11} /> Save &amp; Submit</>
                  ) : (
                    <><Save size={11} /> Save Draft</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════ RIGHT: Detail Cards ══════════════ */}
        <div className="space-y-2">

          {/* ── Request Details ── */}
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <SectionHeader
              icon={CalendarDays}
              title="Request Details"
              colorClass="text-indigo-700 bg-indigo-50 border-indigo-100"
            />
            <div className="space-y-2 p-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={LABEL_CLS}>
                    Date <span className="text-red-500 normal-case font-bold">*</span>
                  </label>
                  <input
                    type="date"
                    className={INPUT_CLS}
                    value={form.request_date}
                    onChange={setField('request_date')}
                  />
                  {err('request_date') && <p className={ERR_CLS}>{err('request_date')}</p>}
                </div>
                <div>
                  <label className={LABEL_CLS}>
                    Reference No. <span className="text-red-500 normal-case font-bold">*</span>
                  </label>
                  <input
                    className={err('reference_no') ? INPUT_ERR_CLS : INPUT_CLS}
                    placeholder="e.g. REF-001"
                    value={form.reference_no}
                    onChange={(e) => {
                      setField('reference_no')(e)
                      if (errors.reference_no) setErrors((prev) => ({ ...prev, reference_no: undefined }))
                    }}
                  />
                  {err('reference_no') && <p className={ERR_CLS}>{err('reference_no')}</p>}
                </div>
              </div>

              <div>
                <label className={LABEL_CLS}>Purpose</label>
                <input
                  className={INPUT_CLS}
                  placeholder="Purpose of this request"
                  value={form.purpose}
                  onChange={setField('purpose')}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={LABEL_CLS}>
                    Source Location <span className="text-red-500 normal-case font-bold">*</span>
                  </label>
                  <select
                    className={err('source_location_id') ? SELECT_ERR_CLS : SELECT_CLS}
                    value={form.source_location_id}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, source_location_id: e.target.value, source_store_id: '' }))
                      if (errors.source_location_id) setErrors((prev) => ({ ...prev, source_location_id: undefined, source_store_id: undefined }))
                    }}
                  >
                    <option value="">— Select location —</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>{l.location_name ?? l.name}</option>
                    ))}
                  </select>
                  {err('source_location_id') && <p className={ERR_CLS}>{err('source_location_id')}</p>}
                </div>
                <div>
                  <label className={LABEL_CLS}>
                    Source Store <span className="text-red-500 normal-case font-bold">*</span>
                    {!form.source_location_id && (
                      <span className="ml-1 normal-case font-medium text-amber-500 text-[10px]">↑ first</span>
                    )}
                  </label>
                  {form.source_location_id ? (
                    <select
                      className={err('source_store_id') ? SELECT_ERR_CLS : SELECT_CLS}
                      value={form.source_store_id}
                      onChange={(e) => {
                        setField('source_store_id')(e)
                        if (errors.source_store_id) setErrors((prev) => ({ ...prev, source_store_id: undefined }))
                      }}
                    >
                      <option value="">— Select store —</option>
                      {sourceStores.map((s) => (
                        <option key={s.id} value={s.id}>{s.store_name}</option>
                      ))}
                    </select>
                  ) : (
                    <select className={SELECT_DISABLED_CLS} disabled>
                      <option>— Select location first —</option>
                    </select>
                  )}
                  {err('source_store_id') && <p className={ERR_CLS}>{err('source_store_id')}</p>}
                </div>
              </div>

              <div>
                <label className={LABEL_CLS}>Remarks</label>
                <textarea
                  rows={2}
                  className={INPUT_CLS + ' resize-none'}
                  placeholder="Optional remarks…"
                  value={form.remarks}
                  onChange={setField('remarks')}
                />
              </div>
            </div>
          </div>

          {/* ── Target Warehouse Details ── */}
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <SectionHeader
              icon={Warehouse}
              title="Target Warehouse Details"
              colorClass="text-emerald-700 bg-emerald-50 border-emerald-100"
            />
            <div className="space-y-2 p-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={LABEL_CLS}>Target Location</label>
                  <select
                    className={SELECT_CLS}
                    value={form.target_location_id}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, target_location_id: e.target.value, target_store_id: '' }))
                    }
                  >
                    <option value="">— Select location —</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>{l.location_name ?? l.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={LABEL_CLS}>
                    Target Store
                    {!form.target_location_id && (
                      <span className="ml-1 normal-case font-medium text-amber-500 text-[10px]">↑ first</span>
                    )}
                  </label>
                  {form.target_location_id ? (
                    <select
                      className={SELECT_CLS}
                      value={form.target_store_id}
                      onChange={setField('target_store_id')}
                    >
                      <option value="">— Select store —</option>
                      {targetStores.map((s) => (
                        <option key={s.id} value={s.id}>{s.store_name}</option>
                      ))}
                    </select>
                  ) : (
                    <select className={SELECT_DISABLED_CLS} disabled>
                      <option>— Select location first —</option>
                    </select>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={LABEL_CLS}>Required Date</label>
                  <input
                    type="date"
                    className={INPUT_CLS}
                    value={form.required_date}
                    onChange={setField('required_date')}
                  />
                  {err('required_date') && <p className={ERR_CLS}>{err('required_date')}</p>}
                </div>
                <div>
                  <label className={LABEL_CLS}>Transport Mode</label>
                  <select
                    className={SELECT_CLS}
                    value={form.transport_mode}
                    onChange={setField('transport_mode')}
                  >
                    <option value="">— Select —</option>
                    {TRANSPORT_MODES.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

        </div>{/* end right column */}
      </div>{/* end main grid */}
    </div>
  )
}
