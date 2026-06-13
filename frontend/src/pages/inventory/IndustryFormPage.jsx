import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Save } from 'lucide-react'
import { createIndustry, getIndustry, updateIndustry } from '../../api/industries'
import Breadcrumb from '../../components/Breadcrumb'
import { showError, showSuccess } from '../../utils/alerts'

const EMPTY_FORM = {
  name:        '',
  description: '',
}

function validate(field, value) {
  switch (field) {
    case 'name':
      if (!String(value).trim()) return 'Industry name is required.'
      if (String(value).length > 100) return 'Max 100 characters.'
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

export default function IndustryFormPage() {
  const { id }      = useParams()
  const isEditing   = Boolean(id)
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const nameRef     = useRef(null)

  const [form,    setForm]    = useState(EMPTY_FORM)
  const [errors,  setErrors]  = useState({})
  const [touched, setTouched] = useState({})

  const { isLoading: isFetching, data: fetchedData } = useQuery({
    queryKey: ['industry', id],
    queryFn:  () => getIndustry(id),
    enabled:  isEditing,
  })

  const initialized = useRef(false)
  useLayoutEffect(() => {
    if (fetchedData?.data && !initialized.current) {
      const i = fetchedData.data
      setForm({
        name:        i.name        ?? '',
        description: i.description ?? '',
      })
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

  const mutation = useMutation({
    mutationFn: (payload) =>
      isEditing ? updateIndustry(id, payload) : createIndustry(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['industries'] })
      queryClient.invalidateQueries({ queryKey: ['industries-all'] })
      if (isEditing) queryClient.invalidateQueries({ queryKey: ['industry', id] })
      showSuccess(isEditing ? 'Industry updated successfully.' : 'Industry created successfully.')
      navigate('/inventory/industries')
    },
    onError: (err) => {
      const apiErrors = err.response?.data?.errors ?? {}
      if (Object.keys(apiErrors).length) {
        setErrors(Object.fromEntries(Object.entries(apiErrors).map(([k, v]) => [k, v[0]])))
        setTouched(Object.fromEntries(Object.keys(apiErrors).map((k) => [k, true])))
      }
      showError('Failed to save. Please check the form and try again.')
    },
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    const fields    = Object.keys(EMPTY_FORM)
    const newErrors = Object.fromEntries(fields.map((f) => [f, validate(f, form[f])]))
    setErrors(newErrors)
    setTouched(Object.fromEntries(fields.map((f) => [f, true])))
    if (Object.values(newErrors).some(Boolean)) return

    mutation.mutate({
      name:        form.name.trim(),
      description: form.description.trim() || null,
    })
  }

  const crumbs = [
    { label: 'Inventory',   to: '/inventory/products' },
    { label: 'Industries',  to: '/inventory/industries' },
    { label: isEditing ? 'Edit Industry' : 'New Industry' },
  ]

  if (isEditing && isFetching) {
    return <div className="flex items-center justify-center py-14 text-sm text-slate-400">Loading…</div>
  }

  return (
    <div className="w-full">
      <Breadcrumb crumbs={crumbs} />

      <div className="mb-2">
        <h1 className="text-xl font-bold text-slate-800">
          {isEditing ? 'Edit Industry' : 'New Industry'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 bg-slate-50 px-3 py-1.5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Industry Details</h2>
          </div>

          {/* 2-column: name left, description right */}
          <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2">

            {/* Left — name */}
            <div className="space-y-3">
              <div>
                <Label required>Industry Name</Label>
                <input
                  ref={nameRef}
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="e.g. Agriculture"
                  maxLength={100}
                  autoComplete="off"
                  className={fieldCls(errors, touched, 'name')}
                />
                <FieldError errors={errors} touched={touched} name="name" />
              </div>
            </div>

            {/* Right — description */}
            <div className="flex flex-col">
              <Label>Description</Label>
              <div className="relative flex-1">
                <textarea
                  name="description"
                  rows={4}
                  value={form.description}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  maxLength={255}
                  placeholder="Optional notes about this industry…"
                  className={`${fieldCls(errors, touched, 'description')} h-full min-h-20 resize-none pb-5`}
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
              to="/inventory/industries"
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
              {mutation.isPending ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Industry'}
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
