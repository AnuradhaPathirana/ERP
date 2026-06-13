import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Save } from 'lucide-react'
import { createStoreType, getStoreType, updateStoreType } from '../../api/storeTypes'
import Breadcrumb from '../../components/Breadcrumb'

const EMPTY_FORM = {
  store_type_name: '',
  description: '',
  is_active: true,
}

function validate(field, value) {
  if (field === 'store_type_name') {
    if (!String(value).trim()) return 'Store type name is required.'
    if (String(value).length > 100) return 'Max 100 characters.'
  }
  return ''
}

const inputBase =
  'block w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-300 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20'
const inputErr =
  'block w-full rounded border border-red-400 bg-red-50/40 px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-300 outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-500/20'

export default function StoreTypeFormPage() {
  const { id }      = useParams()
  const isEditing   = Boolean(id)
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const nameRef     = useRef(null)

  const [form,    setForm]    = useState(EMPTY_FORM)
  const [errors,  setErrors]  = useState({})
  const [touched, setTouched] = useState({})

  const { isLoading: isFetching, data: fetchedData } = useQuery({
    queryKey: ['store-type', id],
    queryFn:  () => getStoreType(id),
    enabled:  isEditing,
  })

  const initialized = useRef(false)
  useLayoutEffect(() => {
    if (fetchedData?.data && !initialized.current) {
      const t = fetchedData.data
      setForm({
        store_type_name: t.store_type_name ?? '',
        description:     t.description ?? '',
        is_active:       t.is_active ?? true,
      })
      initialized.current = true
    }
  }, [fetchedData])

  useEffect(() => { nameRef.current?.focus() }, [])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    const newValue = type === 'checkbox' ? checked : value
    setForm((prev) => ({ ...prev, [name]: newValue }))
    if (touched[name]) setErrors((prev) => ({ ...prev, [name]: validate(name, newValue) }))
  }

  const handleBlur = (e) => {
    const { name, value } = e.target
    setTouched((prev) => ({ ...prev, [name]: true }))
    setErrors((prev) => ({ ...prev, [name]: validate(name, value) }))
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.target.name === 'store_type_name') {
      e.preventDefault()
      document.getElementById('field-description')?.focus()
    }
  }

  const mutation = useMutation({
    mutationFn: (payload) =>
      isEditing ? updateStoreType(id, payload) : createStoreType(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-types'] })
      queryClient.invalidateQueries({ queryKey: ['store-types-all'] })
      if (isEditing) queryClient.invalidateQueries({ queryKey: ['store-type', id] })
      navigate('/inventory/store-types')
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
    const fields = ['store_type_name']
    const newErrors  = Object.fromEntries(fields.map((f) => [f, validate(f, form[f])]))
    const newTouched = Object.fromEntries(fields.map((f) => [f, true]))
    setErrors(newErrors)
    setTouched(newTouched)
    if (Object.values(newErrors).some(Boolean)) return
    mutation.mutate({
      store_type_name: form.store_type_name.trim(),
      description:     form.description.trim() || null,
      is_active:       form.is_active,
    })
  }

  const crumbs = [
    { label: 'Inventory',    to: '/inventory/store-types' },
    { label: 'Store Types',  to: '/inventory/store-types' },
    { label: isEditing ? 'Edit Store Type' : 'New Store Type' },
  ]

  if (isEditing && isFetching) {
    return <div className="flex items-center justify-center py-16 text-sm text-slate-400">Loading…</div>
  }

  return (
    <div className="w-full">
      <Breadcrumb crumbs={crumbs} />

      <div className="mb-2">
        <h1 className="text-xl font-bold text-slate-800">
          {isEditing ? 'Edit Store Type' : 'New Store Type'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} noValidate>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

          {/* ── Left: main details ── */}
          <div className="lg:col-span-2 overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-100 bg-slate-50 px-3 py-1.5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Store Type Details
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2">

              {/* Store Type Name */}
              <div>
                <label htmlFor="field-store_type_name" className="mb-0.5 block text-xs font-medium text-slate-600">
                  Store Type Name <span className="text-red-500">*</span>
                </label>
                <input
                  ref={nameRef}
                  id="field-store_type_name"
                  name="store_type_name"
                  type="text"
                  value={form.store_type_name}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="e.g. Warehouse, Cold Storage, Retail"
                  maxLength={100}
                  autoComplete="off"
                  className={errors.store_type_name && touched.store_type_name ? inputErr : inputBase}
                />
                {errors.store_type_name && touched.store_type_name ? (
                  <p className="mt-0.5 text-[11px] text-red-600">{errors.store_type_name}</p>
                ) : (
                  <p className="mt-0.5 text-[11px] text-slate-400">{form.store_type_name.length}/100</p>
                )}
              </div>

              {/* Description */}
              <div className="md:col-span-2">
                <label htmlFor="field-description" className="mb-0.5 block text-xs font-medium text-slate-600">
                  Description{' '}
                  <span className="text-xs font-normal text-slate-400">(optional)</span>
                </label>
                <div className="relative">
                  <textarea
                    id="field-description"
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="Briefly describe what this store type represents…"
                    rows={3}
                    className={`${inputBase} resize-none pr-14`}
                  />
                  <span className="absolute bottom-1.5 right-2 text-[10px] text-slate-400">
                    {form.description.length}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Right: settings ── */}
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white self-start">
            <div className="border-b border-slate-100 bg-slate-50 px-3 py-1.5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Settings
              </h2>
            </div>

            <div className="p-4">
              <label className="flex cursor-pointer items-center gap-3">
                <div className="relative">
                  <input
                    type="checkbox"
                    name="is_active"
                    id="field-is_active"
                    checked={form.is_active}
                    onChange={handleChange}
                    className="sr-only peer"
                  />
                  <div className="h-5 w-9 rounded-full bg-slate-200 transition-colors peer-checked:bg-indigo-600" />
                  <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
                </div>
                <span className="text-xs font-medium text-slate-700">
                  {form.is_active ? 'Active' : 'Inactive'}
                </span>
              </label>
              <p className="mt-1 text-[11px] text-slate-400">
                Inactive types are hidden from store assignment dropdowns.
              </p>
            </div>
          </div>
        </div>

        {/* ── Action bar ── */}
        <div className="mt-3 flex items-center justify-end gap-2">
          <Link
            to="/inventory/store-types"
            className="rounded px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex items-center gap-1.5 rounded bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save size={13} strokeWidth={2.5} />
            {mutation.isPending ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Store Type'}
          </button>
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
