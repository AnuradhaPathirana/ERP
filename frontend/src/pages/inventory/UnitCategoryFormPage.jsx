import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Save } from 'lucide-react'
import { createUnitCategory, getUnitCategory, updateUnitCategory } from '../../api/unitCategories'
import Breadcrumb from '../../components/Breadcrumb'

const EMPTY_FORM = { name: '', description: '' }

function validate(field, value) {
  if (field === 'name') {
    if (!value.trim()) return 'Name is required.'
    if (value.length > 100) return 'Max 100 characters.'
  }
  if (field === 'description' && value.length > 255) return 'Max 255 characters.'
  return ''
}

const inputBase =
  'block w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-300 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20'
const inputErr =
  'block w-full rounded border border-red-400 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-300 outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-500/20'

export default function UnitCategoryFormPage() {
  const { id }      = useParams()
  const isEditing   = Boolean(id)
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const nameRef     = useRef(null)

  const [form,    setForm]    = useState(EMPTY_FORM)
  const [errors,  setErrors]  = useState({})
  const [touched, setTouched] = useState({})

  const { isLoading: isFetching, data: fetchedData } = useQuery({
    queryKey: ['unit-category', id],
    queryFn:  () => getUnitCategory(id),
    enabled:  isEditing,
  })

  const initialized = useRef(false)
  useLayoutEffect(() => {
    if (fetchedData?.data && !initialized.current) {
      const cat = fetchedData.data
      setForm({ name: cat.name ?? '', description: cat.description ?? '' })
      initialized.current = true
    }
  }, [fetchedData])

  useEffect(() => { nameRef.current?.focus() }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (touched[name]) setErrors((prev) => ({ ...prev, [name]: validate(name, value) }))
  }

  const handleBlur = (e) => {
    const { name, value } = e.target
    setTouched((prev) => ({ ...prev, [name]: true }))
    setErrors((prev) => ({ ...prev, [name]: validate(name, value) }))
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.target.name === 'name') {
      e.preventDefault()
      document.getElementById('field-description')?.focus()
    }
  }

  const mutation = useMutation({
    mutationFn: (payload) =>
      isEditing ? updateUnitCategory(id, payload) : createUnitCategory(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unit-categories'] })
      if (isEditing) queryClient.invalidateQueries({ queryKey: ['unit-category', id] })
      navigate('/inventory/unit-categories')
    },
    onError: (err) => {
      const apiErrors = err.response?.data?.errors ?? {}
      if (Object.keys(apiErrors).length) {
        setErrors(Object.fromEntries(Object.entries(apiErrors).map(([k, v]) => [k, v[0]])))
        setTouched({ name: true, description: true })
      }
    },
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    const nameErr = validate('name', form.name)
    const descErr = validate('description', form.description)
    setErrors({ name: nameErr, description: descErr })
    setTouched({ name: true, description: true })
    if (nameErr || descErr) return
    mutation.mutate({ name: form.name.trim(), description: form.description.trim() || null })
  }

  const crumbs = [
    { label: 'Inventory',       to: '/inventory/unit-categories' },
    { label: 'Unit Categories', to: '/inventory/unit-categories' },
    { label: isEditing ? 'Edit Category' : 'New Category' },
  ]

  if (isEditing && isFetching) {
    return <div className="flex items-center justify-center py-16 text-sm text-slate-400">Loading…</div>
  }

  return (
    <div className="w-full">
      <Breadcrumb crumbs={crumbs} />

      <div className="mb-2">
        <h1 className="text-xl font-bold text-slate-800">
          {isEditing ? 'Edit Unit Category' : 'New Unit Category'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} noValidate>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 bg-slate-50 px-3 py-1.5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Category Details</h2>
          </div>

          {/* Name + Description side-by-side */}
          <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-3">
            {/* Name — 1 col */}
            <div>
              <label className="mb-0.5 block text-xs font-medium text-slate-600">
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
                placeholder="e.g. Weight, Length, Volume"
                maxLength={100}
                autoComplete="off"
                className={errors.name && touched.name ? inputErr : inputBase}
              />
              {errors.name && touched.name && (
                <p className="mt-0.5 text-[11px] text-red-600">{errors.name}</p>
              )}
            </div>

            {/* Description — 2 cols */}
            <div className="md:col-span-2">
              <label htmlFor="field-description" className="mb-0.5 block text-xs font-medium text-slate-600">
                Description <span className="text-xs font-normal text-slate-400">(optional)</span>
              </label>
              <div className="relative">
                <textarea
                  id="field-description"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Briefly describe what this category covers…"
                  maxLength={255}
                  rows={2}
                  className={`${errors.description && touched.description ? inputErr : inputBase} resize-none pr-14`}
                />
                <span className="absolute bottom-1.5 right-2 text-[10px] text-slate-400">
                  {form.description.length}/255
                </span>
              </div>
              {errors.description && touched.description && (
                <p className="mt-0.5 text-[11px] text-red-600">{errors.description}</p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-4 py-2">
            <Link
              to="/inventory/unit-categories"
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
              {mutation.isPending ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Category'}
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
