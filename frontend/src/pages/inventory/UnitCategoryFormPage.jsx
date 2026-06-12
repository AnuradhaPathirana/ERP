import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Save } from 'lucide-react'
import {
  createUnitCategory,
  getUnitCategory,
  updateUnitCategory,
} from '../../api/unitCategories'
import Breadcrumb from '../../components/Breadcrumb'

const EMPTY_FORM = { name: '', description: '' }

function validate(field, value) {
  if (field === 'name') {
    if (!value.trim()) return 'Name is required.'
    if (value.length > 100) return 'Name must be 100 characters or less.'
  }
  if (field === 'description' && value.length > 255) {
    return 'Description must be 255 characters or less.'
  }
  return ''
}

export default function UnitCategoryFormPage() {
  const { id }    = useParams()
  const isEditing = Boolean(id)
  const navigate  = useNavigate()
  const queryClient = useQueryClient()
  const nameRef   = useRef(null)

  const [form,    setForm]    = useState(EMPTY_FORM)
  const [errors,  setErrors]  = useState({})
  const [touched, setTouched] = useState({})

  /* ── Fetch existing record when editing ── */
  const { isLoading: isFetching, data: fetchedData } = useQuery({
    queryKey: ['unit-category', id],
    queryFn: () => getUnitCategory(id),
    enabled: isEditing,
  })

  // Populate form before browser paint to avoid a visible empty-field flash
  const initialized = useRef(false)
  useLayoutEffect(() => {
    if (fetchedData?.data && !initialized.current) {
      const cat = fetchedData.data
      setForm({ name: cat.name ?? '', description: cat.description ?? '' })
      initialized.current = true
    }
  }, [fetchedData])

  // Auto-focus name field on mount
  useEffect(() => { nameRef.current?.focus() }, [])

  /* ── Inline validation ── */
  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (touched[name]) {
      setErrors((prev) => ({ ...prev, [name]: validate(name, value) }))
    }
  }

  const handleBlur = (e) => {
    const { name, value } = e.target
    setTouched((prev) => ({ ...prev, [name]: true }))
    setErrors((prev) => ({ ...prev, [name]: validate(name, value) }))
  }

  // Move focus to description when Enter is pressed inside name field
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.target.name === 'name') {
      e.preventDefault()
      document.getElementById('field-description')?.focus()
    }
  }

  /* ── Mutation ── */
  const mutation = useMutation({
    mutationFn: (payload) =>
      isEditing ? updateUnitCategory(id, payload) : createUnitCategory(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unit-categories'] })
      if (isEditing) queryClient.invalidateQueries({ queryKey: ['unit-category', id] })
      navigate('/inventory/unit-categories')
    },
    onError: (err) => {
      // Surface Laravel 422 field errors
      const apiErrors = err.response?.data?.errors ?? {}
      if (Object.keys(apiErrors).length) {
        setErrors(
          Object.fromEntries(Object.entries(apiErrors).map(([k, v]) => [k, v[0]]))
        )
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

    mutation.mutate({
      name: form.name.trim(),
      description: form.description.trim() || null,
    })
  }

  /* ── Layout ── */
  const crumbs = [
    { label: 'Inventory',        to: '/inventory/unit-categories' },
    { label: 'Unit Categories',  to: '/inventory/unit-categories' },
    { label: isEditing ? 'Edit Category' : 'New Category' },
  ]

  if (isEditing && isFetching) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-slate-400">
        Loading…
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <Breadcrumb crumbs={crumbs} />

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">
            {isEditing ? 'Edit Unit Category' : 'New Unit Category'}
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {isEditing
              ? 'Update the name or description of this category.'
              : 'Group related units of measure under a common label.'}
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        onKeyDown={handleKeyDown}
        noValidate
        className="mt-6"
      >
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="space-y-5 p-6">

            {/* Name */}
            <div>
              <label
                htmlFor="field-name"
                className="block text-sm font-medium text-slate-700"
              >
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
                className={[
                  'mt-1.5 block w-full rounded-lg border px-3.5 py-2.5 text-sm text-slate-800',
                  'placeholder-slate-300 outline-none transition-all',
                  'focus:ring-2 focus:ring-indigo-500/20',
                  errors.name && touched.name
                    ? 'border-red-400 focus:border-red-400'
                    : 'border-slate-300 focus:border-indigo-400',
                ].join(' ')}
              />
              {errors.name && touched.name && (
                <p className="mt-1 text-xs text-red-600">{errors.name}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="field-description"
                className="block text-sm font-medium text-slate-700"
              >
                Description{' '}
                <span className="text-xs font-normal text-slate-400">(optional)</span>
              </label>
              <textarea
                id="field-description"
                name="description"
                value={form.description}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Briefly describe what this category covers…"
                maxLength={255}
                rows={3}
                className={[
                  'mt-1.5 block w-full resize-none rounded-lg border px-3.5 py-2.5 text-sm text-slate-800',
                  'placeholder-slate-300 outline-none transition-all',
                  'focus:ring-2 focus:ring-indigo-500/20',
                  errors.description && touched.description
                    ? 'border-red-400 focus:border-red-400'
                    : 'border-slate-300 focus:border-indigo-400',
                ].join(' ')}
              />
              <div className="mt-1 flex items-start justify-between">
                <p className="text-xs text-red-600">
                  {errors.description && touched.description ? errors.description : ''}
                </p>
                <p className="text-xs text-slate-400">
                  {form.description.length}/255
                </p>
              </div>
            </div>
          </div>

          {/* Form footer */}
          <div className="flex items-center justify-end gap-3 rounded-b-xl border-t border-slate-100 bg-slate-50/60 px-6 py-4">
            <Link
              to="/inventory/unit-categories"
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={14} strokeWidth={2.5} />
              {mutation.isPending
                ? 'Saving…'
                : isEditing
                ? 'Save Changes'
                : 'Create Category'}
            </button>
          </div>
        </div>

        {/* Generic API error (non-422) */}
        {mutation.isError && !Object.keys(mutation.error?.response?.data?.errors ?? {}).length && (
          <p className="mt-3 text-sm text-red-600">
            {mutation.error?.response?.data?.message ?? 'An unexpected error occurred. Please try again.'}
          </p>
        )}
      </form>
    </div>
  )
}
