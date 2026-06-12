import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Save } from 'lucide-react'
import { createSalesChannel, getSalesChannel, updateSalesChannel } from '../../api/salesChannels'
import Breadcrumb from '../../components/Breadcrumb'

const CHANNEL_TYPES  = ['Wholesale', 'e-commerce', 'Retail']
const STATUS_OPTIONS = ['Active', 'Inactive']

const EMPTY_FORM = {
  type:               '',
  sales_channel_name: '',
  max_qty:            '',
  applicable_from:    '',
  applicable_to:      '',
  description:        '',
  status:             '',
}

function validate(field, value, allValues) {
  switch (field) {
    case 'type':
      if (!value) return 'Channel type is required.'
      break
    case 'sales_channel_name':
      if (!String(value).trim()) return 'Sales channel name is required.'
      if (String(value).length > 100) return 'Max 100 characters.'
      break
    case 'max_qty':
      if (value !== '' && (isNaN(Number(value)) || Number(value) < 0))
        return 'Must be a positive number.'
      break
    case 'applicable_to':
      if (value && allValues.applicable_from && value < allValues.applicable_from)
        return 'End date must be on or after start date.'
      break
    case 'description':
      if (String(value).length > 255) return 'Max 255 characters.'
      break
  }
  return ''
}

const inputBase =
  'block w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-300 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20'
const inputErr =
  'block w-full rounded border border-red-400 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-300 outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-500/20'

const fieldCls = (errors, touched, name) =>
  errors[name] && touched[name] ? inputErr : inputBase

function Label({ children, required }) {
  return (
    <label className="mb-0.5 block text-xs font-medium text-slate-600">
      {children}{required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
  )
}

function FieldError({ errors, touched, name }) {
  if (!errors[name] || !touched[name]) return null
  return <p className="mt-0.5 text-[11px] text-red-600">{errors[name]}</p>
}

export default function SalesChannelFormPage() {
  const { id }      = useParams()
  const isEditing   = Boolean(id)
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const nameRef     = useRef(null)

  const [form,    setForm]    = useState(EMPTY_FORM)
  const [errors,  setErrors]  = useState({})
  const [touched, setTouched] = useState({})

  const { isLoading: isFetching, data: fetchedData } = useQuery({
    queryKey: ['sales-channel', id],
    queryFn:  () => getSalesChannel(id),
    enabled:  isEditing,
  })

  const initialized = useRef(false)
  useLayoutEffect(() => {
    if (fetchedData?.data && !initialized.current) {
      const c = fetchedData.data
      setForm({
        type:               c.type               ?? '',
        sales_channel_name: c.sales_channel_name ?? '',
        max_qty:            c.max_qty != null ? String(c.max_qty) : '',
        applicable_from:    c.applicable_from    ?? '',
        applicable_to:      c.applicable_to      ?? '',
        description:        c.description        ?? '',
        status:             c.status             ?? '',
      })
      initialized.current = true
    }
  }, [fetchedData])

  useEffect(() => { nameRef.current?.focus() }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (touched[name]) setErrors((prev) => ({ ...prev, [name]: validate(name, value, { ...form, [name]: value }) }))
  }

  const handleBlur = (e) => {
    const { name, value } = e.target
    setTouched((prev) => ({ ...prev, [name]: true }))
    setErrors((prev) => ({ ...prev, [name]: validate(name, value, form) }))
  }

  const mutation = useMutation({
    mutationFn: (payload) =>
      isEditing ? updateSalesChannel(id, payload) : createSalesChannel(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-channels'] })
      queryClient.invalidateQueries({ queryKey: ['sales-channels-all'] })
      if (isEditing) queryClient.invalidateQueries({ queryKey: ['sales-channel', id] })
      navigate('/inventory/sales-channels')
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
    const fields    = Object.keys(EMPTY_FORM)
    const newErrors = Object.fromEntries(fields.map((f) => [f, validate(f, form[f], form)]))
    setErrors(newErrors)
    setTouched(Object.fromEntries(fields.map((f) => [f, true])))
    if (Object.values(newErrors).some(Boolean)) return

    mutation.mutate({
      type:               form.type,
      sales_channel_name: form.sales_channel_name.trim(),
      max_qty:            form.max_qty !== '' ? Number(form.max_qty) : null,
      applicable_from:    form.applicable_from || null,
      applicable_to:      form.applicable_to   || null,
      description:        form.description.trim() || null,
      status:             form.status || null,
    })
  }

  const crumbs = [
    { label: 'Inventory',      to: '/inventory/products' },
    { label: 'Sales Channels', to: '/inventory/sales-channels' },
    { label: isEditing ? 'Edit Channel' : 'New Channel' },
  ]

  if (isEditing && isFetching) {
    return <div className="flex items-center justify-center py-14 text-sm text-slate-400">Loading…</div>
  }

  return (
    <div className="w-full">
      <Breadcrumb crumbs={crumbs} />

      <div className="mb-2">
        <h1 className="text-xl font-bold text-slate-800">
          {isEditing ? 'Edit Sales Channel' : 'New Sales Channel'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 bg-slate-50 px-3 py-1.5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Channel Details</h2>
          </div>

          {/* 2-column grid: fields left, description right */}
          <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2">

            {/* Left — structured fields */}
            <div className="space-y-3">
              {/* Row: Type | Name | Status */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label required>Channel Type</Label>
                  <select
                    name="type"
                    value={form.type}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={fieldCls(errors, touched, 'type')}
                  >
                    <option value="">— Select —</option>
                    {CHANNEL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <FieldError errors={errors} touched={touched} name="type" />
                </div>
                <div>
                  <Label required>Channel Name</Label>
                  <input
                    ref={nameRef}
                    name="sales_channel_name"
                    type="text"
                    value={form.sales_channel_name}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="e.g. Main Retail Store"
                    maxLength={100}
                    autoComplete="off"
                    className={fieldCls(errors, touched, 'sales_channel_name')}
                  />
                  <FieldError errors={errors} touched={touched} name="sales_channel_name" />
                </div>
                <div>
                  <Label>Status</Label>
                  <select
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={fieldCls(errors, touched, 'status')}
                  >
                    <option value="">— Select —</option>
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <FieldError errors={errors} touched={touched} name="status" />
                </div>
              </div>

              {/* Row: Max Qty | Applicable From | Applicable To */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label>Max Quantity</Label>
                  <input
                    name="max_qty"
                    type="number"
                    min="0"
                    step="any"
                    value={form.max_qty}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="e.g. 1000"
                    className={fieldCls(errors, touched, 'max_qty')}
                  />
                  <FieldError errors={errors} touched={touched} name="max_qty" />
                </div>
                <div>
                  <Label>Applicable From</Label>
                  <input
                    name="applicable_from"
                    type="date"
                    value={form.applicable_from}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={fieldCls(errors, touched, 'applicable_from')}
                  />
                  <FieldError errors={errors} touched={touched} name="applicable_from" />
                </div>
                <div>
                  <Label>Applicable To</Label>
                  <input
                    name="applicable_to"
                    type="date"
                    value={form.applicable_to}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={fieldCls(errors, touched, 'applicable_to')}
                  />
                  <FieldError errors={errors} touched={touched} name="applicable_to" />
                </div>
              </div>
            </div>

            {/* Right — description */}
            <div className="flex flex-col">
              <Label>Description</Label>
              <div className="relative flex-1">
                <textarea
                  name="description"
                  rows={5}
                  value={form.description}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  maxLength={255}
                  placeholder="Optional notes about this channel…"
                  className={`${fieldCls(errors, touched, 'description')} h-full min-h-24 resize-none pb-5`}
                />
                <span className="absolute bottom-1.5 right-2 text-[10px] text-slate-400">
                  {form.description.length}/255
                </span>
              </div>
              <FieldError errors={errors} touched={touched} name="description" />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-4 py-2">
            <Link
              to="/inventory/sales-channels"
              className="rounded px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex items-center gap-1.5 rounded bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={13} strokeWidth={2.5} />
              {mutation.isPending ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Channel'}
            </button>
          </div>
        </div>

        {mutation.isError && !Object.keys(mutation.error?.response?.data?.errors ?? {}).length && (
          <p className="mt-2 text-xs text-red-600">
            {mutation.error?.response?.data?.message ?? 'An unexpected error occurred. Please try again.'}
          </p>
        )}
      </form>
    </div>
  )
}
