import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Save } from 'lucide-react'
import { getAllUnitCategories } from '../../api/unitCategories'
import { createUnitType, getUnitType, updateUnitType } from '../../api/unitTypes'
import Breadcrumb from '../../components/Breadcrumb'

const EMPTY_FORM = {
  unit_category_id: '',
  name: '',
  symbol: '',
  country: '',
  unit_position: 'suffix',
}

const POSITION_OPTIONS = [
  { value: 'suffix',  label: 'Suffix',  example: (sym) => `100 ${sym || 'unit'}` },
  { value: 'prefix',  label: 'Prefix',  example: (sym) => `${sym || 'unit'}100` },
]

function validate(field, value, allValues) {
  switch (field) {
    case 'unit_category_id':
      if (!value) return 'Category is required.'
      break
    case 'name':
      if (!String(value).trim()) return 'Name is required.'
      if (String(value).length > 100) return 'Name must be 100 characters or less.'
      break
    case 'symbol':
      if (!String(value).trim()) return 'Symbol is required.'
      if (String(value).length > 45) return 'Symbol must be 45 characters or less.'
      break
    case 'country':
      if (String(value).length > 45) return 'Country must be 45 characters or less.'
      break
  }
  return ''
}

export default function UnitTypeFormPage() {
  const { id }    = useParams()
  const isEditing = Boolean(id)
  const navigate  = useNavigate()
  const queryClient = useQueryClient()
  const nameRef   = useRef(null)

  const [form,    setForm]    = useState(EMPTY_FORM)
  const [errors,  setErrors]  = useState({})
  const [touched, setTouched] = useState({})

  /* ── Categories for dropdown ── */
  const { data: categoriesData, isLoading: loadingCategories } = useQuery({
    queryKey: ['unit-categories-all'],
    queryFn:  getAllUnitCategories,
    staleTime: 1000 * 60 * 10,
  })
  const categories = categoriesData?.data ?? []

  /* ── Fetch existing record when editing ── */
  const { isLoading: isFetching, data: fetchedData } = useQuery({
    queryKey: ['unit-type', id],
    queryFn:  () => getUnitType(id),
    enabled:  isEditing,
  })

  const initialized = useRef(false)
  useLayoutEffect(() => {
    if (fetchedData?.data && !initialized.current) {
      const ut = fetchedData.data
      setForm({
        unit_category_id: String(ut.unit_category_id ?? ''),
        name:             ut.name ?? '',
        symbol:           ut.symbol ?? '',
        country:          ut.country ?? '',
        unit_position:    ut.unit_position ?? 'suffix',
      })
      initialized.current = true
    }
  }, [fetchedData])

  useEffect(() => { nameRef.current?.focus() }, [])

  /* ── Field handlers ── */
  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (touched[name]) {
      setErrors((prev) => ({ ...prev, [name]: validate(name, value, form) }))
    }
  }

  const handleBlur = (e) => {
    const { name, value } = e.target
    setTouched((prev) => ({ ...prev, [name]: true }))
    setErrors((prev) => ({ ...prev, [name]: validate(name, value, form) }))
  }

  // Tab-order shortcut: Enter on name → symbol, Enter on symbol → country
  const handleKeyDown = (e) => {
    if (e.key !== 'Enter') return
    const focusMap = {
      'field-name':    'field-symbol',
      'field-symbol':  'field-country',
      'field-country': 'field-name',  // loop back
    }
    const next = focusMap[e.target.id]
    if (next) {
      e.preventDefault()
      document.getElementById(next)?.focus()
    }
  }

  /* ── Mutation ── */
  const mutation = useMutation({
    mutationFn: (payload) =>
      isEditing ? updateUnitType(id, payload) : createUnitType(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unit-types'] })
      if (isEditing) queryClient.invalidateQueries({ queryKey: ['unit-type', id] })
      navigate('/inventory/unit-types')
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
    const fields = ['unit_category_id', 'name', 'symbol', 'country']
    const newErrors = Object.fromEntries(fields.map((f) => [f, validate(f, form[f], form)]))
    setErrors(newErrors)
    setTouched(Object.fromEntries(fields.map((f) => [f, true])))
    if (Object.values(newErrors).some(Boolean)) return

    mutation.mutate({
      unit_category_id: Number(form.unit_category_id),
      name:             form.name.trim(),
      symbol:           form.symbol.trim(),
      country:          form.country.trim() || null,
      unit_position:    form.unit_position,
    })
  }

  /* ── Layout ── */
  const crumbs = [
    { label: 'Inventory',   to: '/inventory/unit-types' },
    { label: 'Unit Types',  to: '/inventory/unit-types' },
    { label: isEditing ? 'Edit Unit Type' : 'New Unit Type' },
  ]

  const inputBase = 'mt-1.5 block w-full rounded-lg border px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-300 outline-none transition-all focus:ring-2 focus:ring-indigo-500/20'
  const inputOk   = 'border-slate-300 focus:border-indigo-400'
  const inputErr  = 'border-red-400 focus:border-red-400'

  const fieldCls = (name) =>
    `${inputBase} ${errors[name] && touched[name] ? inputErr : inputOk}`

  if (isEditing && isFetching) {
    return <div className="flex items-center justify-center py-16 text-sm text-slate-400">Loading…</div>
  }

  return (
    <div className="max-w-2xl">
      <Breadcrumb crumbs={crumbs} />

      <div>
        <h1 className="text-xl font-bold text-slate-800">
          {isEditing ? 'Edit Unit Type' : 'New Unit Type'}
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">
          {isEditing
            ? 'Update the details for this unit of measure.'
            : 'Define a unit of measure (e.g. Kilogram, Metre, Piece).'}
        </p>
      </div>

      <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} noValidate className="mt-6">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="space-y-5 p-6">

            {/* Category */}
            <div>
              <label htmlFor="field-category" className="block text-sm font-medium text-slate-700">
                Category <span className="text-red-500">*</span>
              </label>
              {loadingCategories ? (
                <div className="mt-1.5 h-10 animate-pulse rounded-lg bg-slate-100" />
              ) : categories.length === 0 ? (
                <p className="mt-2 text-sm text-amber-600">
                  No categories found.{' '}
                  <Link to="/inventory/unit-categories/create" className="underline">
                    Create one first.
                  </Link>
                </p>
              ) : (
                <select
                  id="field-category"
                  name="unit_category_id"
                  value={form.unit_category_id}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={fieldCls('unit_category_id')}
                >
                  <option value="">— Select a category —</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              )}
              {errors.unit_category_id && touched.unit_category_id && (
                <p className="mt-1 text-xs text-red-600">{errors.unit_category_id}</p>
              )}
            </div>

            {/* Name + Symbol — side by side */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="field-name" className="block text-sm font-medium text-slate-700">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  ref={nameRef}
                  id="field-name"
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="e.g. Kilogram"
                  maxLength={100}
                  autoComplete="off"
                  className={fieldCls('name')}
                />
                {errors.name && touched.name && (
                  <p className="mt-1 text-xs text-red-600">{errors.name}</p>
                )}
              </div>

              <div>
                <label htmlFor="field-symbol" className="block text-sm font-medium text-slate-700">
                  Symbol <span className="text-red-500">*</span>
                </label>
                <input
                  id="field-symbol"
                  name="symbol"
                  type="text"
                  value={form.symbol}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="e.g. kg"
                  maxLength={45}
                  autoComplete="off"
                  className={fieldCls('symbol')}
                />
                {errors.symbol && touched.symbol && (
                  <p className="mt-1 text-xs text-red-600">{errors.symbol}</p>
                )}
              </div>
            </div>

            {/* Unit Position */}
            <div>
              <p className="block text-sm font-medium text-slate-700">
                Unit Position <span className="text-red-500">*</span>
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                Where the symbol appears relative to the numeric value.
              </p>
              <div className="mt-2.5 grid grid-cols-2 gap-3">
                {POSITION_OPTIONS.map((opt) => {
                  const isSelected = form.unit_position === opt.value
                  return (
                    <label
                      key={opt.value}
                      className={[
                        'flex cursor-pointer flex-col gap-1.5 rounded-xl border-2 p-4 transition-all',
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50/60'
                          : 'border-slate-200 hover:border-slate-300',
                      ].join(' ')}
                    >
                      <input
                        type="radio"
                        name="unit_position"
                        value={opt.value}
                        checked={isSelected}
                        onChange={handleChange}
                        className="sr-only"
                      />
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-semibold ${isSelected ? 'text-indigo-700' : 'text-slate-700'}`}>
                          {opt.label}
                        </span>
                        <span className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-indigo-500' : 'border-slate-300'}`}>
                          {isSelected && <span className="h-2 w-2 rounded-full bg-indigo-500" />}
                        </span>
                      </div>
                      <code className="text-xs text-slate-500">
                        {opt.example(form.symbol)}
                      </code>
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Country (optional) */}
            <div>
              <label htmlFor="field-country" className="block text-sm font-medium text-slate-700">
                Country{' '}
                <span className="text-xs font-normal text-slate-400">(optional — for region-specific units)</span>
              </label>
              <input
                id="field-country"
                name="country"
                type="text"
                value={form.country}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="e.g. US, IN, GB"
                maxLength={45}
                autoComplete="off"
                className={fieldCls('country')}
              />
              {errors.country && touched.country && (
                <p className="mt-1 text-xs text-red-600">{errors.country}</p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 rounded-b-xl border-t border-slate-100 bg-slate-50/60 px-6 py-4">
            <Link
              to="/inventory/unit-types"
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={mutation.isPending || (categories.length === 0 && !isEditing)}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={14} strokeWidth={2.5} />
              {mutation.isPending ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Unit Type'}
            </button>
          </div>
        </div>

        {mutation.isError && !Object.keys(mutation.error?.response?.data?.errors ?? {}).length && (
          <p className="mt-3 text-sm text-red-600">
            {mutation.error?.response?.data?.message ?? 'An unexpected error occurred. Please try again.'}
          </p>
        )}
      </form>
    </div>
  )
}
