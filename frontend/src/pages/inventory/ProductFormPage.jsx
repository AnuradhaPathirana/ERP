import { useLayoutEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { HelpCircle, Plus, Save, X } from 'lucide-react'
import { createProduct, getProduct, updateProduct } from '../../api/products'
import { getAllSalesChannels } from '../../api/salesChannels'
import { getAllSuppliers } from '../../api/suppliers'
import { getAllUnitTypes } from '../../api/unitTypes'
import Breadcrumb from '../../components/Breadcrumb'

const PRODUCT_TYPES   = ['Product', 'Service', 'Bundle', 'Raw Material']
const STOCK_METHODS   = ['FIFO', 'LIFO', 'FEFO']
const TRACKING_TYPES  = ['Batch', 'Serial']
const REORDER_PERIODS = ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly']

const BOOL_OPTIONS = [
  { key: 'lock_purchase',             label: 'Lock Purchase' },
  { key: 'allow_complimentary_items', label: 'Allow Complementary' },
  { key: 'free_issue',                label: 'Free Issue' },
  { key: 'allow_minus',               label: 'Allow Minus Stock' },
  { key: 'not_allow_direct_sale',     label: 'No Direct Sale' },
  { key: 'non_returnable',            label: 'Non-Returnable' },
  { key: 'is_empty',                  label: 'Is Empty' },
  { key: 'service_charge',            label: 'Service Charge' },
  { key: 'loyalty',                   label: 'Loyalty' },
  { key: 'is_batch',                  label: 'Batch Tracked' },
  { key: 'is_serial',                 label: 'Serial Tracked' },
]

const EMPTY_COST_ROW = {
  sales_channel_id:               '',
  uom:                            '',
  num_of_units:                   '',
  cost_price:                     '',
  margin:                         '',
  selling_price:                  '',
  max_price:                      '',
  min_price:                      '',
  wholesale_price:                '',
  sale_privileges_discount:       '',
  purchasing_privileges_discount: '',
}

const EMPTY_FORM = {
  product_code:              '',
  reference_no:              '',
  ean_13:                    '',
  name:                      '',
  display_name:              '',
  product_type:              '',
  description:               '',
  category:                  '',
  location:                  '',
  reorder_level:             '',
  reorder_qty:               '',
  reorder_period:            '',
  stock_releasing_method:    '',
  tracking_type:             '',
  lock_purchase:              false,
  allow_complimentary_items:  false,
  free_issue:                 false,
  allow_minus:                false,
  not_allow_direct_sale:      false,
  non_returnable:             false,
  is_empty:                   false,
  service_charge:             false,
  loyalty:                    false,
  is_batch:                   false,
  is_serial:                  false,
  supplier_ids:               [],
  cost_details:               [],
}

function validateField(field, value) {
  if (field === 'name') {
    if (!String(value).trim()) return 'Required.'
    if (String(value).length > 100) return 'Max 100 chars.'
  }
  if (field === 'product_code') {
    if (!String(value ?? '').trim()) return 'Required.'
    if (String(value).length > 50) return 'Max 50 chars.'
  }
  if (field === 'display_name') {
    if (!String(value ?? '').trim()) return 'Required.'
    if (String(value).length > 100) return 'Max 100 chars.'
  }
  if (field === 'product_type' && !value) return 'Required.'
  if (field === 'supplier_ids' && (!value || value.length === 0)) return 'At least one supplier required.'
  if (field === 'reference_no' && value && String(value).length > 50) return 'Max 50 chars.'
  if (field === 'ean_13' && value && String(value).length > 50) return 'Max 50 chars.'
  if (field === 'category' && value && String(value).length > 100) return 'Max 100 chars.'
  if (field === 'location' && value && String(value).length > 100) return 'Max 100 chars.'
  if ((field === 'reorder_level' || field === 'reorder_qty') && value !== '' && (isNaN(Number(value)) || Number(value) < 0)) {
    return 'Must be a positive number.'
  }
  return ''
}

// Compute average price = (cost_price + selling_price) / 2
function computeAverage(costPrice, sellingPrice) {
  const cp = parseFloat(costPrice)
  const sp = parseFloat(sellingPrice)
  if (isNaN(cp) && isNaN(sp)) return ''
  if (isNaN(cp)) return sp.toFixed(4)
  if (isNaN(sp)) return cp.toFixed(4)
  return ((cp + sp) / 2).toFixed(4)
}

function Field({ label, required, helpText, error, touched, children }) {
  return (
    <div>
      <label className="mb-0.5 flex items-center gap-1 text-xs font-medium text-slate-600">
        {label}
        {required && <span className="text-red-500">*</span>}
        {helpText && (
          <span title={helpText} className="cursor-help text-slate-400">
            <HelpCircle size={11} />
          </span>
        )}
      </label>
      {children}
      {error && touched && <p className="mt-0.5 text-xs text-red-600">{error}</p>}
    </div>
  )
}

function Input({ name, value, onChange, onBlur, error, touched, ...props }) {
  return (
    <input
      name={name}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      autoComplete="off"
      className={[
        'block w-full rounded border px-2 py-1 text-sm text-slate-800',
        'placeholder-slate-300 outline-none transition-all',
        'focus:ring-1 focus:ring-indigo-500/30',
        error && touched
          ? 'border-red-400 focus:border-red-400'
          : 'border-slate-300 focus:border-indigo-400',
      ].join(' ')}
      {...props}
    />
  )
}

function SelectField({ name, value, onChange, onBlur, error, touched, placeholder, options }) {
  return (
    <select
      name={name}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      className={[
        'block w-full rounded border px-2 py-1 text-sm text-slate-800 bg-white',
        'outline-none transition-all',
        'focus:ring-1 focus:ring-indigo-500/30',
        error && touched
          ? 'border-red-400 focus:border-red-400'
          : 'border-slate-300 focus:border-indigo-400',
      ].join(' ')}
    >
      <option value="">{placeholder ?? '— Select —'}</option>
      {options.map((o) => (
        <option key={typeof o === 'string' ? o : o.value} value={typeof o === 'string' ? o : o.value}>
          {typeof o === 'string' ? o : o.label}
        </option>
      ))}
    </select>
  )
}

// Inline input for cost detail rows — no Field wrapper, smaller
function CostInput({ value, onChange, disabled, placeholder, type = 'number', ...props }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder={placeholder}
      autoComplete="off"
      className={[
        'block w-full rounded border px-2 py-1 text-xs outline-none transition-all',
        disabled
          ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
          : 'border-slate-300 text-slate-800 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500/30',
      ].join(' ')}
      {...props}
    />
  )
}

function CostSelect({ value, onChange, children, placeholder }) {
  return (
    <select
      value={value}
      onChange={onChange}
      className="block w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 outline-none transition-all focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500/30"
    >
      <option value="">{placeholder ?? '— Select —'}</option>
      {children}
    </select>
  )
}

// Single cost detail card
function CostDetailCard({ row, idx, salesChannels, unitTypes, usedChannelIds, onChange, onRemove }) {
  const avgPrice = computeAverage(row.cost_price, row.selling_price)

  const handle = (field) => (e) => onChange(idx, field, e.target.value)

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2.5">
      {/* Card header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Channel {idx + 1}
        </span>
        <button
          type="button"
          onClick={() => onRemove(idx)}
          className="rounded p-0.5 text-slate-400 hover:bg-red-100 hover:text-red-600 transition-colors"
          title="Remove this channel"
        >
          <X size={14} />
        </button>
      </div>

      {/* Row 1: Sales Channel | UOM | Number of Units */}
      <div className="grid grid-cols-3 gap-2.5">
        <Field label="Price List / Sale Channel" required>
          <CostSelect
            value={row.sales_channel_id}
            onChange={handle('sales_channel_id')}
            placeholder="Channel..."
          >
            {salesChannels.map((c) => (
              <option
                key={c.id}
                value={c.id}
                disabled={usedChannelIds.includes(String(c.id)) && row.sales_channel_id !== String(c.id)}
              >
                {c.name}
              </option>
            ))}
          </CostSelect>
        </Field>
        <Field label="UOM" required helpText="Unit of Measure">
          <CostSelect
            value={row.uom}
            onChange={handle('uom')}
            placeholder="Unit..."
          >
            {unitTypes.map((u) => (
              <option key={u.id} value={u.symbol}>{u.name} ({u.symbol})</option>
            ))}
          </CostSelect>
        </Field>
        <Field label="Number Of Units" required>
          <CostInput
            value={row.num_of_units}
            onChange={handle('num_of_units')}
            min="0" step="0.0001"
            placeholder="0"
          />
        </Field>
      </div>

      {/* Row 2: Cost Price | Margin % | Selling Price */}
      <div className="grid grid-cols-3 gap-2.5">
        <Field label="Cost Price" required>
          <CostInput
            value={row.cost_price}
            onChange={handle('cost_price')}
            min="0" step="0.0001"
            placeholder="0.00"
          />
        </Field>
        <Field label="Margin %"  required>
          <CostInput
            value={row.margin}
            onChange={handle('margin')}
            step="0.01"
            placeholder="0.00"
          />
        </Field>
        <Field label="Selling Price" required>
          <CostInput
            value={row.selling_price}
            onChange={handle('selling_price')}
            min="0" step="0.0001"
            placeholder="0.00"
          />
        </Field>
      </div>

      {/* Row 3: Maximum Price | Minimum Price | Wholesale Price */}
      <div className="grid grid-cols-3 gap-2.5">
        <Field label="Maximum Price">
          <CostInput
            value={row.max_price}
            onChange={handle('max_price')}
            min="0" step="0.0001"
            placeholder="0.00"
          />
        </Field>
        <Field label="Minimum Price">
          <CostInput
            value={row.min_price}
            onChange={handle('min_price')}
            min="0" step="0.0001"
            placeholder="0.00"
          />
        </Field>
        <Field label="Wholesale Price">
          <CostInput
            value={row.wholesale_price}
            onChange={handle('wholesale_price')}
            min="0" step="0.0001"
            placeholder="0.00"
          />
        </Field>
      </div>

      {/* Row 4: Sale Privileges Discount | Purchasing Privileges Discount | Average Price (read-only) */}
      <div className="grid grid-cols-3 gap-2.5">
        <Field label="Sale Privileges Discount">
          <CostInput
            value={row.sale_privileges_discount}
            onChange={handle('sale_privileges_discount')}
            min="0" max="100" step="0.01"
            placeholder="0.00"
          />
        </Field>
        <Field label="Purchasing Privileges Discount">
          <CostInput
            value={row.purchasing_privileges_discount}
            onChange={handle('purchasing_privileges_discount')}
            min="0" max="100" step="0.01"
            placeholder="0.00"
          />
        </Field>
        <Field label="Average Price">
          <CostInput
            value={avgPrice}
            disabled
            placeholder="—"
          />
        </Field>
      </div>
    </div>
  )
}

export default function ProductFormPage() {
  const { id }      = useParams()
  const isEditing   = Boolean(id)
  const navigate    = useNavigate()
  const queryClient = useQueryClient()

  const [form,    setForm]    = useState(EMPTY_FORM)
  const [errors,  setErrors]  = useState({})
  const [touched, setTouched] = useState({})

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers-all'],
    queryFn:  getAllSuppliers,
    staleTime: 5 * 60 * 1000,
  })
  const { data: channelsData } = useQuery({
    queryKey: ['sales-channels-all'],
    queryFn:  getAllSalesChannels,
    staleTime: 5 * 60 * 1000,
  })
  const { data: unitTypesData } = useQuery({
    queryKey: ['unit-types-all'],
    queryFn:  getAllUnitTypes,
    staleTime: 5 * 60 * 1000,
  })

  const suppliers     = suppliersData ?? []
  const salesChannels = channelsData  ?? []
  const unitTypes     = unitTypesData ?? []

  const { isLoading: isFetching, data: fetchedData } = useQuery({
    queryKey: ['product', id],
    queryFn:  () => getProduct(id),
    enabled:  isEditing,
  })

  const initialized = useRef(false)
  useLayoutEffect(() => {
    if (fetchedData?.data && !initialized.current) {
      const p = fetchedData.data
      setForm({
        product_code:              p.product_code             ?? '',
        reference_no:              p.reference_no             ?? '',
        ean_13:                    p.ean_13                   ?? '',
        name:                      p.name                     ?? '',
        display_name:              p.display_name             ?? '',
        product_type:              p.product_type             ?? '',
        description:               p.description              ?? '',
        category:                  p.category                 ?? '',
        location:                  p.location                 ?? '',
        reorder_level:             p.reorder_level            != null ? String(p.reorder_level) : '',
        reorder_qty:               p.reorder_qty              != null ? String(p.reorder_qty) : '',
        reorder_period:            p.reorder_period           ?? '',
        stock_releasing_method:    p.stock_releasing_method   ?? '',
        tracking_type:             p.tracking_type            ?? '',
        lock_purchase:              Boolean(p.lock_purchase),
        allow_complimentary_items:  Boolean(p.allow_complimentary_items),
        free_issue:                 Boolean(p.free_issue),
        allow_minus:                Boolean(p.allow_minus),
        not_allow_direct_sale:      Boolean(p.not_allow_direct_sale),
        non_returnable:             Boolean(p.non_returnable),
        is_empty:                   Boolean(p.is_empty),
        service_charge:             Boolean(p.service_charge),
        loyalty:                    Boolean(p.loyalty),
        is_batch:                   Boolean(p.is_batch),
        is_serial:                  Boolean(p.is_serial),
        supplier_ids:               (p.suppliers ?? []).map((s) => s.id),
        cost_details:               (p.cost_details ?? []).map((c) => ({
          sales_channel_id:               String(c.sales_channel_id),
          uom:                            c.uom                            ?? '',
          num_of_units:                   c.num_of_units                   != null ? String(c.num_of_units) : '',
          cost_price:                     c.cost_price                     != null ? String(c.cost_price) : '',
          margin:                         c.margin                         != null ? String(c.margin) : '',
          selling_price:                  c.selling_price                  != null ? String(c.selling_price) : '',
          max_price:                      c.max_price                      != null ? String(c.max_price) : '',
          min_price:                      c.min_price                      != null ? String(c.min_price) : '',
          wholesale_price:                c.wholesale_price                != null ? String(c.wholesale_price) : '',
          sale_privileges_discount:       c.sale_privileges_discount       != null ? String(c.sale_privileges_discount) : '',
          purchasing_privileges_discount: c.purchasing_privileges_discount != null ? String(c.purchasing_privileges_discount) : '',
        })),
      })
      initialized.current = true
    }
  }, [fetchedData])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (touched[name]) {
      setErrors((prev) => ({ ...prev, [name]: validateField(name, value) }))
    }
  }

  const handleBlur = (e) => {
    const { name, value } = e.target
    setTouched((prev) => ({ ...prev, [name]: true }))
    setErrors((prev) => ({ ...prev, [name]: validateField(name, value) }))
  }

  const handleCheck = (key) => setForm((prev) => ({ ...prev, [key]: !prev[key] }))

  const toggleSupplier = (supplierId) => {
    setForm((prev) => {
      const ids = prev.supplier_ids.includes(supplierId)
        ? prev.supplier_ids.filter((id) => id !== supplierId)
        : [...prev.supplier_ids, supplierId]
      return { ...prev, supplier_ids: ids }
    })
    setTouched((prev) => ({ ...prev, supplier_ids: true }))
  }

  const addCostRow = () => {
    setForm((prev) => ({ ...prev, cost_details: [...prev.cost_details, { ...EMPTY_COST_ROW }] }))
  }

  const removeCostRow = (idx) => {
    setForm((prev) => ({ ...prev, cost_details: prev.cost_details.filter((_, i) => i !== idx) }))
  }

  const handleCostChange = (idx, field, value) => {
    setForm((prev) => ({
      ...prev,
      cost_details: prev.cost_details.map((row, i) => i === idx ? { ...row, [field]: value } : row),
    }))
  }

  const mutation = useMutation({
    mutationFn: (payload) =>
      isEditing ? updateProduct(id, payload) : createProduct(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      if (isEditing) queryClient.invalidateQueries({ queryKey: ['product', id] })
      navigate('/inventory/products')
    },
    onError: (err) => {
      const apiErrors = err.response?.data?.errors ?? {}
      if (Object.keys(apiErrors).length) {
        setErrors(Object.fromEntries(Object.entries(apiErrors).map(([k, v]) => [k, v[0]])))
        setTouched(Object.fromEntries(Object.keys(apiErrors).map((k) => [k, true])))
      }
    },
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    const fieldErrors = {}
    const allTouched  = {}
    const validateFields = ['name', 'product_code', 'display_name', 'product_type', 'supplier_ids', 'reference_no', 'ean_13', 'category', 'location', 'reorder_level', 'reorder_qty']
    validateFields.forEach((f) => {
      fieldErrors[f] = validateField(f, form[f])
      allTouched[f]  = true
    })
    setErrors(fieldErrors)
    setTouched(allTouched)
    if (Object.values(fieldErrors).some(Boolean)) return

    const toNum = (v) => v !== '' ? Number(v) : null
    const payload = {
      ...form,
      product_code:           form.product_code.trim(),
      reference_no:           form.reference_no.trim() || null,
      ean_13:                 form.ean_13.trim() || null,
      name:                   form.name.trim(),
      display_name:           form.display_name.trim(),
      product_type:           form.product_type,
      description:            form.description.trim() || null,
      category:               form.category.trim() || null,
      location:               form.location.trim() || null,
      reorder_level:          toNum(form.reorder_level),
      reorder_qty:            toNum(form.reorder_qty),
      reorder_period:         form.reorder_period || null,
      stock_releasing_method: form.stock_releasing_method || null,
      tracking_type:          form.tracking_type || null,
      supplier_ids:           form.supplier_ids,
      cost_details:           form.cost_details
        .filter((r) => r.sales_channel_id)
        .map((r) => ({
          sales_channel_id:               Number(r.sales_channel_id),
          uom:                            r.uom || null,
          num_of_units:                   toNum(r.num_of_units),
          cost_price:                     toNum(r.cost_price),
          margin:                         toNum(r.margin),
          selling_price:                  toNum(r.selling_price),
          max_price:                      toNum(r.max_price),
          min_price:                      toNum(r.min_price),
          wholesale_price:                toNum(r.wholesale_price),
          sale_privileges_discount:       toNum(r.sale_privileges_discount),
          purchasing_privileges_discount: toNum(r.purchasing_privileges_discount),
        })),
    }
    mutation.mutate(payload)
  }

  const crumbs = [
    { label: 'Inventory', to: '/inventory/products' },
    { label: 'Products',  to: '/inventory/products' },
    { label: isEditing ? 'Edit Product' : 'New Product' },
  ]

  if (isEditing && isFetching) {
    return <div className="flex items-center justify-center py-16 text-sm text-slate-400">Loading…</div>
  }

  const f = form
  const e = errors
  const t = touched
  const usedChannelIds = f.cost_details.map((r) => r.sales_channel_id).filter(Boolean)

  return (
    <div className="w-full">
      <Breadcrumb crumbs={crumbs} />

      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">
            {isEditing ? 'Edit Product' : 'New Product'}
          </h1>
          <p className="text-xs text-slate-500">
            {isEditing ? 'Update the product master record.' : 'Add a new product to the inventory master.'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-2.5">

        {/* ── Basic Information ── */}
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 bg-slate-50 px-3 py-1.5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Basic Information</h2>
          </div>
          <div className="space-y-2.5 p-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <Field label="Product Code" required error={e.product_code} touched={t.product_code}>
                <Input name="product_code" value={f.product_code} onChange={handleChange} onBlur={handleBlur}
                  error={e.product_code} touched={t.product_code} placeholder="e.g. PRD-0001" maxLength={50} />
              </Field>
              <Field label="Reference No" error={e.reference_no} touched={t.reference_no}>
                <Input name="reference_no" value={f.reference_no} onChange={handleChange} onBlur={handleBlur}
                  error={e.reference_no} touched={t.reference_no} placeholder="Supplier / internal ref" maxLength={50} />
              </Field>
              <Field label="EAN / Barcode" error={e.ean_13} touched={t.ean_13}>
                <Input name="ean_13" value={f.ean_13} onChange={handleChange} onBlur={handleBlur}
                  error={e.ean_13} touched={t.ean_13} placeholder="EAN-13 barcode" maxLength={50} />
              </Field>
              <Field label="Product Type" required error={e.product_type} touched={t.product_type}>
                <SelectField name="product_type" value={f.product_type} onChange={handleChange} onBlur={handleBlur}
                  error={e.product_type} touched={t.product_type} options={PRODUCT_TYPES} placeholder="— Select type —" />
              </Field>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <Field label="Product Name" required error={e.name} touched={t.name}>
                <Input name="name" value={f.name} onChange={handleChange} onBlur={handleBlur}
                  error={e.name} touched={t.name} placeholder="Full product name" maxLength={100} />
              </Field>
              <Field label="Display Name" required error={e.display_name} touched={t.display_name}>
                <Input name="display_name" value={f.display_name} onChange={handleChange} onBlur={handleBlur}
                  error={e.display_name} touched={t.display_name} placeholder="Short / POS name" maxLength={100} />
              </Field>
              <Field label="Category" error={e.category} touched={t.category}>
                <Input name="category" value={f.category} onChange={handleChange} onBlur={handleBlur}
                  error={e.category} touched={t.category} placeholder="e.g. Electronics" maxLength={100} />
              </Field>
              <Field label="Location" error={e.location} touched={t.location}>
                <Input name="location" value={f.location} onChange={handleChange} onBlur={handleBlur}
                  error={e.location} touched={t.location} placeholder="Warehouse / shelf" maxLength={100} />
              </Field>
            </div>

            <Field label="Description">
              <textarea name="description" value={f.description} onChange={handleChange} rows={2}
                placeholder="Optional product description…"
                className="block w-full resize-none rounded border border-slate-300 px-2 py-1 text-sm text-slate-800 placeholder-slate-300 outline-none transition-all focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500/30" />
            </Field>
          </div>
        </section>

        {/* ── Supplier ── */}
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 bg-slate-50 px-3 py-1.5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Supplier <span className="text-red-500">*</span>
            </h2>
          </div>
          <div className="p-3">
            {e.supplier_ids && t.supplier_ids && (
              <p className="mb-1.5 text-xs text-red-600">{e.supplier_ids}</p>
            )}
            {suppliers.length === 0 ? (
              <p className="text-xs italic text-slate-400">No suppliers available.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-1.5">
                {suppliers.map((s) => (
                  <label key={s.id} className="flex cursor-pointer items-center gap-1.5">
                    <input type="checkbox" checked={f.supplier_ids.includes(s.id)}
                      onChange={() => toggleSupplier(s.id)}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0" />
                    <span className="truncate text-xs text-slate-700" title={s.name}>{s.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── Stock & Reorder Settings ── */}
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 bg-slate-50 px-3 py-1.5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Stock &amp; Reorder Settings</h2>
          </div>
          <div className="p-3">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
              <Field label="Reorder Level" error={e.reorder_level} touched={t.reorder_level}>
                <Input name="reorder_level" value={f.reorder_level} onChange={handleChange} onBlur={handleBlur}
                  error={e.reorder_level} touched={t.reorder_level} type="number" min="0" step="0.0001" placeholder="0.0000" />
              </Field>
              <Field label="Reorder Qty" error={e.reorder_qty} touched={t.reorder_qty}>
                <Input name="reorder_qty" value={f.reorder_qty} onChange={handleChange} onBlur={handleBlur}
                  error={e.reorder_qty} touched={t.reorder_qty} type="number" min="0" step="0.0001" placeholder="0.0000" />
              </Field>
              <Field label="Reorder Period">
                <SelectField name="reorder_period" value={f.reorder_period} onChange={handleChange} onBlur={handleBlur}
                  options={REORDER_PERIODS} placeholder="— Select —" />
              </Field>
              <Field label="Stock Method">
                <SelectField name="stock_releasing_method" value={f.stock_releasing_method} onChange={handleChange} onBlur={handleBlur}
                  options={STOCK_METHODS} placeholder="— Select —" />
              </Field>
              <Field label="Tracking Type">
                <SelectField name="tracking_type" value={f.tracking_type} onChange={handleChange} onBlur={handleBlur}
                  options={TRACKING_TYPES} placeholder="— None —" />
              </Field>
            </div>
          </div>
        </section>

        {/* ── Cost Details ── */}
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 bg-slate-50 px-3 py-1.5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Cost Details</h2>
          </div>
          <div className="p-3 space-y-2.5">
            {f.cost_details.length === 0 && (
              <p className="text-xs italic text-slate-400">
                No cost details added. Click <strong>+</strong> to configure pricing per sales channel.
              </p>
            )}

            {f.cost_details.map((row, idx) => (
              <CostDetailCard
                key={idx}
                row={row}
                idx={idx}
                salesChannels={salesChannels}
                unitTypes={unitTypes}
                usedChannelIds={usedChannelIds}
                onChange={handleCostChange}
                onRemove={removeCostRow}
              />
            ))}

            {/* Add button */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={addCostRow}
                disabled={salesChannels.length === 0 || f.cost_details.length >= salesChannels.length}
                title="Add sales channel"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
              >
                <Plus size={16} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </section>

        {/* ── Product Options ── */}
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 bg-slate-50 px-3 py-1.5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Product Options</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-2 p-3">
            {BOOL_OPTIONS.map(({ key, label }) => (
              <label key={key} className="flex cursor-pointer items-center gap-1.5">
                <input type="checkbox" checked={f[key]} onChange={() => handleCheck(key)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0" />
                <span className="text-xs text-slate-700">{label}</span>
              </label>
            ))}
          </div>
        </section>

        {/* ── Footer ── */}
        <div className="flex items-center justify-end gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
          {mutation.isError && !Object.keys(mutation.error?.response?.data?.errors ?? {}).length && (
            <p className="mr-auto text-xs text-red-600">
              {mutation.error?.response?.data?.message ?? 'An unexpected error occurred.'}
            </p>
          )}
          <Link to="/inventory/products"
            className="rounded px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100">
            Cancel
          </Link>
          <button type="submit" disabled={mutation.isPending}
            className="flex items-center gap-1.5 rounded bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">
            <Save size={13} strokeWidth={2.5} />
            {mutation.isPending ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Product'}
          </button>
        </div>

      </form>
    </div>
  )
}
