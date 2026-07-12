import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { AlertTriangle, FileText, RefreshCw, Save } from 'lucide-react'
import {
  createInvoice,
  getBillingSourceForDo,
  getBillingSourceForSo,
  getInvoice,
  getNextInvoiceNo,
  updateInvoice,
} from '../../api/invoices'
import { getAllCompanies } from '../../api/companies'
import Breadcrumb from '../../components/Breadcrumb'
import Money from '../../components/ui/Money'
import { showError, showSuccess } from '../../utils/alerts'
import { fmtMoney } from '../../utils/currency'

const INPUT_CLS =
  'block w-full rounded border border-slate-300 bg-slate-50 px-2 py-1 text-xs text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-indigo-400 focus:bg-white focus:ring-1 focus:ring-indigo-500/20'
const INPUT_ERR_CLS =
  'block w-full rounded border border-red-300 bg-red-50/40 px-2 py-1 text-xs text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-red-500 focus:bg-white focus:ring-1 focus:ring-red-500/20'
const INPUT_RO_CLS =
  'block w-full rounded border border-slate-200 bg-slate-100 px-2 py-1 text-xs font-mono text-slate-500 outline-none cursor-not-allowed'
const SELECT_CLS =
  'block w-full rounded border border-slate-300 bg-slate-50 px-2 py-1 text-xs text-slate-800 outline-none transition-all focus:border-indigo-400 focus:bg-white focus:ring-1 focus:ring-indigo-500/20 cursor-pointer'
const LABEL_CLS   = 'block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5'
const ERR_CLS     = 'text-[10px] text-red-500 leading-tight'

const PAYMENT_MODES = [
  { value: 'cash',          label: 'Cash' },
  { value: 'cheque',        label: 'Cheque' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'credit',        label: 'Credit' },
]
const TABLE_INPUT =
  'block w-full rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs text-slate-800 outline-none transition-all focus:border-indigo-400 focus:bg-white'
const TABLE_INPUT_RO =
  'block w-full rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500 outline-none cursor-not-allowed'

function calcLine(row) {
  const qty     = parseFloat(row.quantity)   || 0
  const price   = parseFloat(row.unit_price) || 0
  const discPct = parseFloat(row.discount)   || 0
  const taxPct  = parseFloat(row.tax)        || 0
  const gross   = qty * price
  return gross - (gross * discPct / 100) + (gross * taxPct / 100)
}

export default function InvoiceFormPage() {
  const { id }    = useParams()
  const isEdit    = Boolean(id)
  const navigate  = useNavigate()
  const [search]  = useSearchParams()
  const doFromUrl = search.get('do')
  const soFromUrl = search.get('so')

  const CRUMBS = [
    { label: 'Inventory', to: '/inventory/products' },
    { label: 'Invoices', to: '/inventory/invoices' },
    { label: isEdit ? 'Edit Invoice' : 'New Invoice' },
  ]

  const [form, setForm]   = useState({
    invoice_date:     new Date().toISOString().slice(0, 10),
    due_date:         '',
    transport_charge: '',
    delivery_address: '',
    remarks:          '',
    mode_of_payment:  '',
    company_id:       '',
  })
  const [lines, setLines]   = useState([]) // {so_item_id, do_item_id, product, unit, attribute, quantity, unit_price, discount, tax}
  const [errors, setErrors] = useState({})

  const { data: nextInvoiceNo, isLoading: loadingNo } = useQuery({
    queryKey: ['next-invoice-no'],
    queryFn:  getNextInvoiceNo,
    enabled:  !isEdit,
    staleTime: 0,
  })

  // The supplier printed on the tax invoice.
  const { data: companiesRes } = useQuery({
    queryKey: ['companies-all'],
    queryFn:  getAllCompanies,
    staleTime: 5 * 60 * 1000,
  })
  const companies = companiesRes?.data ?? []

  // A tax invoice must name a supplier, so a new invoice starts on the first company.
  useEffect(() => {
    if (isEdit || form.company_id || companies.length === 0) return
    setForm((f) => ({ ...f, company_id: String(companies[0].id) }))
  }, [companies, isEdit, form.company_id])

  /* ── Billing source (create mode) ─────────────────────────── */
  const { data: source, isLoading: loadingSource, isError: sourceError, error: sourceErrorObj } = useQuery({
    queryKey: ['invoice-billing-source', doFromUrl, soFromUrl],
    queryFn:  () => doFromUrl ? getBillingSourceForDo(doFromUrl) : getBillingSourceForSo(soFromUrl),
    enabled:  !isEdit && Boolean(doFromUrl || soFromUrl),
    retry:    false,
  })

  useEffect(() => {
    if (!source || isEdit) return
    setLines(source.items.map((it) => ({
      so_item_id: it.so_item_id,
      do_item_id: it.do_item_id,
      product:    it.product,
      unit:       it.unit,
      attribute:  it.attribute,
      quantity:   it.quantity,
      unit_price: String(it.unit_price),
      discount:   it.discount ? String(it.discount) : '',
      tax:        it.tax ? String(it.tax) : '',
    })))
    setForm((f) => ({
      ...f,
      transport_charge: String(source.default_transport_charge ?? 0),
      delivery_address: source.sales_order?.delivery_address ?? '',
    }))
  }, [source, isEdit])

  /* ── Edit-mode hydration ──────────────────────────────────── */
  const { data: existing, isLoading: loadingInvoice } = useQuery({
    queryKey: ['invoice', id],
    queryFn:  () => getInvoice(id),
    enabled:  isEdit,
  })

  useEffect(() => {
    if (!existing?.data) return
    const inv = existing.data
    setForm({
      invoice_date:     inv.invoice_date ?? '',
      due_date:         inv.due_date ?? '',
      transport_charge: String(inv.transport_charge ?? 0),
      delivery_address: inv.delivery_address ?? '',
      remarks:          inv.remarks ?? '',
      mode_of_payment:  inv.mode_of_payment ?? '',
      company_id:       inv.company_id ? String(inv.company_id) : '',
    })
    setLines((inv.items ?? []).map((it) => ({
      so_item_id: it.so_item_id,
      do_item_id: it.do_item_id,
      product:    it.product,
      unit:       it.unit,
      attribute:  it.attribute,
      quantity:   it.quantity,
      unit_price: String(it.unit_price),
      discount:   it.discount ? String(it.discount) : '',
      tax:        it.tax ? String(it.tax) : '',
    })))
  }, [existing])

  const setLineField = (idx, field, value) =>
    setLines((prev) => prev.map((row, i) => i === idx ? { ...row, [field]: value } : row))

  const totals = useMemo(() => {
    const lineTotal = lines.reduce((s, row) => s + calcLine(row), 0)
    const transport = parseFloat(form.transport_charge) || 0
    return { lineTotal, transport, grand: lineTotal + transport }
  }, [lines, form.transport_charge])

  const saveMutation = useMutation({
    mutationFn: (payload) => isEdit ? updateInvoice(id, payload) : createInvoice(payload),
    onSuccess: (res) => {
      showSuccess(isEdit ? 'Invoice updated.' : 'Invoice created.')
      navigate(`/inventory/invoices/${res.data.id}`)
    },
    onError: (e) => {
      const data = e.response?.data
      if (data?.errors) setErrors(data.errors)
      showError(data?.message ?? 'Failed to save invoice.')
    },
  })

  const handleSubmit = () => {
    const clientErrors = {}
    if (!form.invoice_date) clientErrors.invoice_date = ['Invoice date is required.']
    if (form.due_date && form.due_date < form.invoice_date)
      clientErrors.due_date = ['Due date must be on or after the invoice date.']

    if (Object.keys(clientErrors).length) {
      setErrors(clientErrors)
      showError('Please complete the highlighted fields.')
      return
    }

    setErrors({})
    saveMutation.mutate({
      ...(isEdit ? {} : (doFromUrl ? { do_id: parseInt(doFromUrl) } : { so_id: parseInt(soFromUrl) })),
      invoice_date:     form.invoice_date,
      due_date:         form.due_date || null,
      transport_charge: parseFloat(form.transport_charge) || 0,
      delivery_address: form.delivery_address.trim() || null,
      remarks:          form.remarks.trim() || null,
      mode_of_payment:  form.mode_of_payment || null,
      company_id:       form.company_id ? Number(form.company_id) : null,
      items: lines.map((row) => ({
        so_item_id: row.so_item_id,
        unit_price: parseFloat(row.unit_price) || 0,
        discount:   parseFloat(row.discount)   || 0,
        tax:        parseFloat(row.tax)        || 0,
      })),
    })
  }

  const err = (f) => errors[f]?.[0]

  if (!isEdit && !doFromUrl && !soFromUrl) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-slate-500">
          Invoices are created against a document — open a confirmed <b>Delivery Order</b> or a <b>Sales Order</b> and use its <i>Create Invoice</i> button.
        </p>
      </div>
    )
  }

  if ((isEdit && loadingInvoice) || (!isEdit && loadingSource)) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <RefreshCw size={14} className="animate-spin" /> Loading…
        </div>
      </div>
    )
  }

  if (!isEdit && sourceError) {
    return (
      <div className="py-16 text-center text-sm text-red-500">
        {sourceErrorObj?.response?.data?.message ?? 'Failed to load the billing source.'}
      </div>
    )
  }

  const blocked = !isEdit && source?.guards?.blocked

  return (
    <div className="w-full">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <h1 className="text-base font-bold leading-none text-slate-800">
            {isEdit ? 'Edit Invoice' : 'New Invoice'}
          </h1>
          <Breadcrumb crumbs={CRUMBS} />
        </div>
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-1.5 text-center">
          <Money value={totals.grand} className="block text-sm font-black leading-tight text-indigo-700" />
          <div className="text-[9px] font-bold uppercase tracking-wider text-indigo-400">Invoice Total</div>
        </div>
      </div>

      {blocked && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
          <AlertTriangle size={13} className="shrink-0" />
          This document cannot be invoiced — it is already invoiced, or the sales order uses a different billing mode.
        </div>
      )}

      <div className="flex flex-col gap-2">

        {/* ── Invoice Details ── */}
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-1.5 rounded-t-lg border-b border-indigo-100 bg-indigo-50 px-3 py-1.5 text-indigo-700">
            <FileText size={12} />
            <h2 className="text-xs font-bold">
              Invoice Details
              {!isEdit && source && (
                <span className="ml-2 font-normal text-indigo-400">
                  {source.source === 'do'
                    ? `for ${source.delivery_order?.do_no} (${source.sales_order?.so_no})`
                    : `direct for ${source.sales_order?.so_no}`}
                  {' — '}{source.sales_order?.customer?.name}
                </span>
              )}
            </h2>
          </div>
          <div className="p-3">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-5">
              <div>
                <label className={LABEL_CLS}>Invoice Number</label>
                <input
                  readOnly
                  className={INPUT_RO_CLS}
                  value={isEdit ? (existing?.data?.invoice_no ?? '') : (loadingNo ? 'Generating…' : (nextInvoiceNo ?? ''))}
                />
              </div>
              <div>
                <label className={LABEL_CLS}>Supplier (Company)</label>
                <select className={SELECT_CLS} value={form.company_id} onChange={(e) => setForm((f) => ({ ...f, company_id: e.target.value }))}>
                  <option value="">— Select —</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.company_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL_CLS}>Invoice Date <span className="text-red-500 normal-case font-bold">*</span></label>
                <input type="date" className={err('invoice_date') ? INPUT_ERR_CLS : INPUT_CLS} value={form.invoice_date} onChange={(e) => setForm((f) => ({ ...f, invoice_date: e.target.value }))} />
                {err('invoice_date') && <p className={ERR_CLS}>{err('invoice_date')}</p>}
              </div>
              <div>
                <label className={LABEL_CLS}>Due Date</label>
                <input type="date" className={err('due_date') ? INPUT_ERR_CLS : INPUT_CLS} value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} />
                {err('due_date') && <p className={ERR_CLS}>{err('due_date')}</p>}
              </div>
              <div>
                <label className={LABEL_CLS}>
                  Transport Charge
                  {!isEdit && source && Number(source.sales_order?.transport_charge) > 0 && (
                    <span className="ml-1 normal-case font-medium text-slate-400">(SO: {fmtMoney(source.sales_order.transport_charge)})</span>
                  )}
                </label>
                <input type="number" min="0" step="0.01" className={INPUT_CLS} value={form.transport_charge} onChange={(e) => setForm((f) => ({ ...f, transport_charge: e.target.value }))} />
              </div>
              <div>
                <label className={LABEL_CLS}>Mode of Payment</label>
                <select className={SELECT_CLS} value={form.mode_of_payment} onChange={(e) => setForm((f) => ({ ...f, mode_of_payment: e.target.value }))}>
                  <option value="">— Select —</option>
                  {PAYMENT_MODES.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL_CLS}>Remarks</label>
                <input className={INPUT_CLS} placeholder="Notes…" value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className={LABEL_CLS}>Billing / Delivery Address</label>
                <input className={INPUT_CLS} value={form.delivery_address} onChange={(e) => setForm((f) => ({ ...f, delivery_address: e.target.value }))} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Lines ── */}
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-left">
                  <th className="w-7 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">#</th>
                  <th className="w-24 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Code</th>
                  <th className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Product</th>
                  <th className="w-20 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Colour</th>
                  <th className="w-14 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">UOM</th>
                  <th className="w-20 px-2 py-1.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">Qty</th>
                  <th className="w-24 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Unit Price</th>
                  <th className="w-16 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-500">Disc%</th>
                  <th className="w-16 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-sky-500">Tax%</th>
                  <th className="w-24 px-2 py-1.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-700">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lines.map((row, idx) => (
                  <tr key={row.so_item_id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-2 py-1 text-slate-400 tabular-nums">{idx + 1}</td>
                    <td className="px-2 py-1 font-mono text-slate-500">{row.product?.product_code}</td>
                    <td className="px-2 py-1 font-medium text-slate-700">{row.product?.name}</td>
                    <td className="px-2 py-1 text-slate-600">{row.attribute?.name || <span className="italic text-slate-300">—</span>}</td>
                    <td className="px-2 py-1 text-slate-500">{row.unit?.name}</td>
                    <td className="px-2 py-1">
                      <input readOnly value={Number(row.quantity).toLocaleString(undefined, { maximumFractionDigits: 4 })} className={`${TABLE_INPUT_RO} text-right tabular-nums`} title="Quantity comes from the source document" />
                    </td>
                    <td className="px-2 py-1">
                      <input type="number" min="0" step="0.01" value={row.unit_price} onChange={(e) => setLineField(idx, 'unit_price', e.target.value)} className={TABLE_INPUT} />
                    </td>
                    <td className="px-2 py-1">
                      <input type="number" min="0" max="100" step="0.01" placeholder="0" value={row.discount} onChange={(e) => setLineField(idx, 'discount', e.target.value)} className="block w-full rounded border border-amber-200 bg-amber-50/50 px-1.5 py-0.5 text-xs text-slate-800 outline-none transition-all focus:border-amber-400 focus:bg-white" />
                    </td>
                    <td className="px-2 py-1">
                      <input type="number" min="0" max="100" step="0.01" placeholder="0" value={row.tax} onChange={(e) => setLineField(idx, 'tax', e.target.value)} className="block w-full rounded border border-sky-200 bg-sky-50/50 px-1.5 py-0.5 text-xs text-slate-800 outline-none transition-all focus:border-sky-400 focus:bg-white" />
                    </td>
                    <td className="px-2 py-1 text-right font-bold text-slate-800"><Money value={calcLine(row)} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-indigo-50 border-t border-indigo-100">
                  <td colSpan={8} className="px-3 py-1.5">
                    <div className="flex items-center gap-4 text-xs">
                      <span className="font-bold uppercase tracking-wider text-indigo-600">Summary</span>
                      <span className="text-slate-500">Lines: <Money value={totals.lineTotal} className="font-bold text-slate-700" /></span>
                      <span className="text-slate-500">Transport: <Money value={totals.transport} className="font-bold text-slate-700" /></span>
                    </div>
                  </td>
                  <td colSpan={2} className="px-3 py-1.5 text-right">
                    <div className="flex flex-col items-end leading-tight">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">Invoice Total</span>
                      <Money value={totals.grand} className="text-base font-black text-indigo-700" />
                    </div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-white px-3 py-2">
            <button
              type="button"
              disabled={saveMutation.isPending || blocked || lines.length === 0}
              onClick={handleSubmit}
              className="flex items-center gap-1 rounded bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-indigo-700 disabled:opacity-60 active:scale-95"
            >
              {saveMutation.isPending
                ? <><RefreshCw size={11} className="animate-spin" /> Saving…</>
                : <><Save size={11} /> {isEdit ? 'Update Invoice' : 'Create Invoice'}</>}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
