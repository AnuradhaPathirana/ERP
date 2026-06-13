import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Save } from 'lucide-react'
import { createAttribute, getAttribute, updateAttribute } from '../../api/attributes'
import { getAllAttributeTypes } from '../../api/attributeTypes'
import Breadcrumb from '../../components/Breadcrumb'

const EMPTY_FORM = {
  attribute_type_id: '',
  attribute_name: '',
}

function validate(field, value) {
  if (field === 'attribute_type_id' && !value) return 'Attribute type is required.'
  if (field === 'attribute_name') {
    if (!value.trim()) return 'Attribute name is required.'
    if (value.length > 100) return 'Max 100 characters.'
  }
  return ''
}

const inputBase =
  'block w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-300 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20'
const inputErr =
  'block w-full rounded border border-red-400 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-300 outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-500/20'

export default function AttributeFormPage() {
  const { id }      = useParams()
  const isEditing   = Boolean(id)
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const nameRef     = useRef(null)

  const [form,    setForm]    = useState(EMPTY_FORM)
  const [errors,  setErrors]  = useState({})
  const [touched, setTouched] = useState({})

  const { isLoading: isFetching, data: fetchedData } = useQuery({
    queryKey: ['attribute', id],
    queryFn:  () => getAttribute(id),
    enabled:  isEditing,
  })

  const { data: typesData } = useQuery({
    queryKey: ['attribute-types-all'],
    queryFn:  getAllAttributeTypes,
  })
  const attributeTypes = typesData?.data ?? []

  const initialized = useRef(false)
  useLayoutEffect(() => {
    if (fetchedData?.data && !initialized.current) {
      const a = fetchedData.data
      setForm({
        attribute_type_id: String(a.attribute_type_id ?? ''),
        attribute_name:    a.attribute_name ?? '',
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

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.target.name === 'attribute_type_id') {
      e.preventDefault()
      document.getElementById('field-attribute_name')?.focus()
    }
  }

  const mutation = useMutation({
    mutationFn: (payload) =>
      isEditing ? updateAttribute(id, payload) : createAttribute(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attributes'] })
      if (isEditing) queryClient.invalidateQueries({ queryKey: ['attribute', id] })
      navigate('/inventory/attributes')
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
    const fields = ['attribute_type_id', 'attribute_name']
    const newErrors  = Object.fromEntries(fields.map((f) => [f, validate(f, form[f])]))
    const newTouched = Object.fromEntries(fields.map((f) => [f, true]))
    setErrors(newErrors)
    setTouched(newTouched)
    if (Object.values(newErrors).some(Boolean)) return
    mutation.mutate({
      attribute_type_id: Number(form.attribute_type_id),
      attribute_name:    form.attribute_name.trim(),
    })
  }

  const crumbs = [
    { label: 'Inventory',  to: '/inventory/attributes' },
    { label: 'Attributes', to: '/inventory/attributes' },
    { label: isEditing ? 'Edit Attribute' : 'New Attribute' },
  ]

  if (isEditing && isFetching) {
    return <div className="flex items-center justify-center py-16 text-sm text-slate-400">Loading…</div>
  }

  return (
    <div className="w-full">
      <Breadcrumb crumbs={crumbs} />

      <div className="mb-2">
        <h1 className="text-xl font-bold text-slate-800">
          {isEditing ? 'Edit Attribute' : 'New Attribute'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} noValidate>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 bg-slate-50 px-3 py-1.5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Attribute Details
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 lg:grid-cols-3">

            {/* Attribute Type */}
            <div>
              <label htmlFor="field-attribute_type_id" className="mb-0.5 block text-xs font-medium text-slate-600">
                Attribute Type <span className="text-red-500">*</span>
              </label>
              <select
                id="field-attribute_type_id"
                name="attribute_type_id"
                value={form.attribute_type_id}
                onChange={handleChange}
                onBlur={handleBlur}
                className={errors.attribute_type_id && touched.attribute_type_id ? inputErr : inputBase}
              >
                <option value="">— Select attribute type —</option>
                {attributeTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.attribute_type_name}
                  </option>
                ))}
              </select>
              {errors.attribute_type_id && touched.attribute_type_id && (
                <p className="mt-0.5 text-[11px] text-red-600">{errors.attribute_type_id}</p>
              )}
            </div>

            {/* Attribute Name */}
            <div>
              <label htmlFor="field-attribute_name" className="mb-0.5 block text-xs font-medium text-slate-600">
                Attribute Name <span className="text-red-500">*</span>
              </label>
              <input
                ref={nameRef}
                id="field-attribute_name"
                name="attribute_name"
                type="text"
                value={form.attribute_name}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="e.g. Red, XL, Cotton"
                maxLength={100}
                autoComplete="off"
                className={errors.attribute_name && touched.attribute_name ? inputErr : inputBase}
              />
              {errors.attribute_name && touched.attribute_name && (
                <p className="mt-0.5 text-[11px] text-red-600">{errors.attribute_name}</p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-4 py-2">
            <Link
              to="/inventory/attributes"
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
              {mutation.isPending ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Attribute'}
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
