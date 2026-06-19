import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ClipboardList, Plus, Trash2, Warehouse, PackageCheck } from 'lucide-react'
import {
  createGoodsReceivedNote,
  getGoodsReceivedNote,
  getPoOutstandingItems,
  updateGoodsReceivedNote,
} from '../../api/goodsReceivedNotes'
import { getPurchaseOrders } from '../../api/purchaseOrders'
import { getAllStores } from '../../api/stores'
import { getAllLocations } from '../../api/locations'
import Breadcrumb from '../../components/Breadcrumb'
import { showError, showSuccess } from '../../utils/alerts'

const INPUT_CLS  = 'block w-full rounded-md border-2 border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/15'
const SELECT_CLS = 'block w-full rounded-md border-2 border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-800 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/15 cursor-pointer'
const TABLE_INPUT_CLS = 'block w-full rounded border-2 border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/15'
const LABEL_CLS  = 'block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5'
const ERR_CLS    = 'mt-0.5 text-[10px] text-red-500'

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

export default function GoodsReceivedNoteFormPage() {
  const { id }     = useParams()
  const isEdit     = Boolean(id)
  const navigate   = useNavigate()
  const [search]   = useSearchParams()
  const poIdFromUrl = search.get('po_id')

  const CRUMBS = [
    { label: 'Inventory', to: '/inventory/products' },
    { label: 'Goods Received Notes', to: '/inventory/goods-received-notes' },
    { label: isEdit ? 'Edit GRN' : 'New GRN' },
  ]

  const today = new Date().toISOString().slice(0, 10)

  const [form, setForm] = useState({
    po_id:       poIdFromUrl ?? '',
    grn_date:    today,
    store_id:    '',
    location_id: '',
    remarks:     '',
  })
  const [items, setItems]   = useState([])
  const [errors, setErrors] = useState({})
  const [loadingPOItems, setLoadingPOItems] = useState(false)

  const { data: stores    = [] } = useQuery({ queryKey: ['stores-all'],    queryFn: getAllStores })
  const { data: locations = [] } = useQuery({ queryKey: ['locations-all'], queryFn: getAllLocations })

  // Confirmed/partially-received POs for dropdown
  const { data: openPOs } = useQuery({
    queryKey: ['pos-open'],
    queryFn:  () => getPurchaseOrders(1, { status: 'confirmed' }),
  })
  const { data: partialPOs } = useQuery({
    queryKey: ['pos-partial'],
    queryFn:  () => getPurchaseOrders(1, { status: 'partially_received' }),
  })

  const availablePOs = [
    ...(openPOs?.data ?? []),
    ...(partialPOs?.data ?? []),
  ]

  // Load existing GRN for edit
  const { data: existingGRN, isLoading: loadingGRN } = useQuery({
    queryKey: ['grn', id],
    queryFn:  () => getGoodsReceivedNote(id),
    enabled:  isEdit,
  })

  useEffect(() => {
    if (!existingGRN?.data) return
    const grn = existingGRN.data
    setForm({
      po_id:       grn.po_id       ?? '',
      grn_date:    grn.grn_date    ?? today,
      store_id:    grn.store_id    ?? '',
      location_id: grn.location_id ?? '',
      remarks:     grn.remarks     ?? '',
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
        batch_no:          '',
        expiry_date:       '',
      })))
    }
  }, [existingGRN])

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
    }
  }, [poIdFromUrl])

  const handlePOChange = (poId) => {
    setForm((f) => ({ ...f, po_id: poId }))
    loadPOItems(poId)
  }

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
    const payload = {
      ...form,
      po_id:       form.po_id       || null,
      store_id:    form.store_id    || null,
      location_id: form.location_id || null,
      items: items
        .filter((r) => r.po_item_id && parseFloat(r.quantity_received) > 0)
        .map((r) => ({
          po_item_id:        parseInt(r.po_item_id),
          product_id:        parseInt(r.product_id),
          quantity_received: parseFloat(r.quantity_received),
          unit_price:        parseFloat(r.unit_price) || 0,
          batch_no:          r.batch_no || null,
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
      <div className="mb-2 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold leading-none text-slate-800">{isEdit ? 'Edit GRN' : 'New Goods Received Note'}</h1>
          <Breadcrumb crumbs={CRUMBS} />
        </div>
      </div>

      <div className="space-y-2">
        {/* ── GRN Header + Receiving Details ── */}
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {/* PO & Date */}
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <SectionHeader icon={ClipboardList} title="GRN Details" colorClass="text-indigo-700 bg-indigo-50 border-indigo-100" />
            <div className="grid grid-cols-2 gap-2 p-2.5">
              <div className="col-span-2">
                <label className={LABEL_CLS}>Purchase Order <span className="text-red-500">*</span></label>
                <select
                  className={SELECT_CLS}
                  value={form.po_id}
                  onChange={(e) => handlePOChange(e.target.value)}
                  disabled={isEdit}
                >
                  <option value="">Select PO…</option>
                  {availablePOs.map((po) => (
                    <option key={po.id} value={po.id}>
                      {po.po_no} — {po.supplier?.name} ({po.status_label})
                    </option>
                  ))}
                </select>
                {err('po_id') && <p className={ERR_CLS}>{err('po_id')}</p>}
              </div>
              <div>
                <label className={LABEL_CLS}>GRN Date <span className="text-red-500">*</span></label>
                <input type="date" className={INPUT_CLS} value={form.grn_date} onChange={(e) => setForm((f) => ({ ...f, grn_date: e.target.value }))} />
                {err('grn_date') && <p className={ERR_CLS}>{err('grn_date')}</p>}
              </div>
              <div>
                <label className={LABEL_CLS}>Remarks</label>
                <input className={INPUT_CLS} placeholder="Optional notes" value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} />
              </div>
            </div>
          </div>

          {/* Receiving Location */}
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <SectionHeader icon={Warehouse} title="Receiving Destination" colorClass="text-emerald-700 bg-emerald-50 border-emerald-100" />
            <div className="grid grid-cols-2 gap-2 p-2.5">
              <div className="col-span-2">
                <label className={LABEL_CLS}>Receiving Store <span className="text-red-500">*</span></label>
                <select className={SELECT_CLS} value={form.store_id} onChange={(e) => setForm((f) => ({ ...f, store_id: e.target.value }))}>
                  <option value="">Select store…</option>
                  {stores.map((s) => <option key={s.id} value={s.id}>{s.store_name}</option>)}
                </select>
                {err('store_id') && <p className={ERR_CLS}>{err('store_id')}</p>}
              </div>
              <div className="col-span-2">
                <label className={LABEL_CLS}>Receiving Location</label>
                <select className={SELECT_CLS} value={form.location_id} onChange={(e) => setForm((f) => ({ ...f, location_id: e.target.value }))}>
                  <option value="">No specific location</option>
                  {locations.map((l) => <option key={l.id} value={l.id}>{l.location_name ?? l.name}</option>)}
                </select>
              </div>
              <div className="col-span-2 rounded bg-amber-50 border border-amber-100 px-2.5 py-1.5">
                <p className="text-[10px] text-amber-700">
                  <strong>Note:</strong> When confirmed, stock will be added to the selected store & location above. This action is irreversible.
                </p>
              </div>
            </div>
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
                          type="number"
                          min="0"
                          step="0.0001"
                          max={row.quantity_ordered}
                          className={TABLE_INPUT_CLS + ' w-24'}
                          value={row.quantity_received}
                          onChange={(e) => setRowField(idx, 'quantity_received', e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
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
                        <button type="button" onClick={() => removeRow(idx)} className="rounded p-0.5 text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"><Trash2 size={12} /></button>
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
            <button type="button" onClick={() => navigate('/inventory/goods-received-notes')} className="rounded border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50">Cancel</button>
            <button type="button" disabled={saveMutation.isPending || items.length === 0} onClick={handleSubmit} className="rounded bg-indigo-600 px-4 py-1 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60">
              {saveMutation.isPending ? 'Saving…' : isEdit ? 'Update GRN' : 'Create GRN (Draft)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
