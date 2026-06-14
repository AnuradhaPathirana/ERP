import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Save } from 'lucide-react'
import { createAttributeType, getAttributeType, updateAttributeType } from '../../api/attributeTypes'
import { getAllCategories } from '../../api/categories'
import Breadcrumb from '../../components/Breadcrumb'
import { showError, showSuccess } from '../../utils/alerts'

const EMPTY_FORM = {
  category_id: '',
  product_service_type: 'product',
  attribute_type_name: '',
  description: '',
}

function validate(field, value) {
  if (field === 'category_id' && !value) return 'Category is required.'
  if (field === 'product_service_type' && !value) return 'Type is required.'
  if (field === 'attribute_type_name') {
    if (!value.trim()) return 'Attribute type name is required.'
    if (value.length > 100) return 'Max 100 characters.'
  }
  if (field === 'description' && value.length > 255) return 'Max 255 characters.'
  return ''
}

function buildTree(categories, parentId = null) {
  return categories
    .filter((c) => (c.parent_category_id ?? null) === parentId)
    .map((c) => ({ ...c, children: buildTree(categories, c.id) }))
}

function NestedCategorySelect({ value, onChange, onBlur, categories, hasError }) {
  const [open, setOpen]         = useState(false)
  const [expanded, setExpanded] = useState({})
  const [panelStyle, setPanelStyle] = useState({})
  const triggerRef = useRef(null)
  const panelRef   = useRef(null)

  const tree = useMemo(() => buildTree(categories), [categories])

  const selectedLabel = useMemo(
    () => categories.find((c) => String(c.id) === String(value))?.category_name ?? null,
    [categories, value],
  )

  const openDropdown = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setPanelStyle({
        position: 'fixed',
        top:   rect.bottom + 2,
        left:  rect.left,
        width: rect.width,
        zIndex: 9999,
      })
    }
    // Auto-expand ancestors of the currently selected item
    if (value) {
      const pathIds = {}
      let cur = categories.find((c) => String(c.id) === String(value))
      while (cur?.parent_category_id) {
        pathIds[cur.parent_category_id] = true
        cur = categories.find((c) => c.id === cur.parent_category_id)
      }
      setExpanded((prev) => ({ ...prev, ...pathIds }))
    }
    setOpen(true)
  }

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (triggerRef.current?.contains(e.target) || panelRef.current?.contains(e.target)) return
      setOpen(false)
      onBlur?.({ target: { name: 'category_id', value } })
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onBlur, value])

  // Close when page scrolls (trigger position would drift)
  useEffect(() => {
    if (!open) return
    const handler = () => setOpen(false)
    window.addEventListener('scroll', handler, true)
    return () => window.removeEventListener('scroll', handler, true)
  }, [open])

  const toggleExpand = (id) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))

  const handleSelect = (id) => {
    onChange({ target: { name: 'category_id', value: String(id) } })
    setOpen(false)
  }

  const renderNode = (node, depth = 0) => {
    const hasChildren = node.children.length > 0
    const isExpanded  = !!expanded[node.id]
    const isSelected  = String(node.id) === String(value)

    return (
      <div key={node.id}>
        <div
          style={{ paddingLeft: `${6 + depth * 14}px` }}
          className={`flex items-center gap-0.5 py-1 pr-2 text-xs ${
            isSelected ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-700'
          }`}
        >
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => { e.stopPropagation(); if (hasChildren) toggleExpand(node.id) }}
            className={`flex w-5 shrink-0 items-center justify-center rounded text-slate-400 hover:text-slate-600 ${
              hasChildren ? 'cursor-pointer' : 'cursor-default opacity-0 pointer-events-none'
            }`}
          >
            {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={() => handleSelect(node.id)}
            className={`flex-1 truncate text-left hover:text-indigo-600 ${isSelected ? 'text-indigo-700' : ''}`}
          >
            {node.category_name}
          </button>
        </div>
        {hasChildren && isExpanded && node.children.map((child) => renderNode(child, depth + 1))}
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        id="field-category_id"
        onClick={() => (open ? setOpen(false) : openDropdown())}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        className={`flex w-full items-center justify-between rounded border bg-white px-2.5 py-1.5 text-xs outline-none transition focus:ring-2 ${
          hasError
            ? 'border-red-400 focus:border-red-400 focus:ring-red-500/20'
            : 'border-slate-300 focus:border-indigo-400 focus:ring-indigo-500/20'
        }`}
      >
        <span className={selectedLabel ? 'text-slate-800' : 'text-slate-400'}>
          {selectedLabel ?? '— Select category —'}
        </span>
        <ChevronDown
          size={12}
          className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && createPortal(
        <div ref={panelRef} style={panelStyle} className="rounded border border-slate-200 bg-white shadow-lg">
          <div className="max-h-60 overflow-y-auto py-1">
            {tree.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-400">No categories available</p>
            ) : (
              tree.map((node) => renderNode(node))
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

const inputBase =
  'block w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-300 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20'
const inputErr =
  'block w-full rounded border border-red-400 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-300 outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-500/20'

export default function AttributeTypeFormPage() {
  const { id }      = useParams()
  const isEditing   = Boolean(id)
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const nameRef     = useRef(null)

  const [form,    setForm]    = useState(EMPTY_FORM)
  const [errors,  setErrors]  = useState({})
  const [touched, setTouched] = useState({})

  const { isLoading: isFetching, data: fetchedData } = useQuery({
    queryKey: ['attribute-type', id],
    queryFn:  () => getAttributeType(id),
    enabled:  isEditing,
  })

  const { data: categoriesData } = useQuery({
    queryKey: ['categories-all'],
    queryFn:  getAllCategories,
  })
  const categories = categoriesData ?? []

  const initialized = useRef(false)
  useLayoutEffect(() => {
    if (fetchedData?.data && !initialized.current) {
      const t = fetchedData.data
      setForm({
        category_id:          String(t.category_id ?? ''),
        product_service_type: t.product_service_type ?? 'product',
        attribute_type_name:  t.attribute_type_name ?? '',
        description:          t.description ?? '',
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
    if (e.key === 'Enter') {
      const order = ['product_service_type', 'attribute_type_name', 'description']
      const idx   = order.indexOf(e.target.name)
      if (idx !== -1 && idx < order.length - 1) {
        e.preventDefault()
        document.getElementById(`field-${order[idx + 1]}`)?.focus()
      }
    }
  }

  const mutation = useMutation({
    mutationFn: (payload) =>
      isEditing ? updateAttributeType(id, payload) : createAttributeType(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attribute-types'] })
      queryClient.invalidateQueries({ queryKey: ['attribute-types-all'] })
      if (isEditing) queryClient.invalidateQueries({ queryKey: ['attribute-type', id] })
      showSuccess(isEditing ? 'Attribute type updated successfully.' : 'Attribute type created successfully.')
      navigate('/inventory/attribute-types')
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
    const fields = ['category_id', 'product_service_type', 'attribute_type_name', 'description']
    const newErrors  = Object.fromEntries(fields.map((f) => [f, validate(f, form[f])]))
    const newTouched = Object.fromEntries(fields.map((f) => [f, true]))
    setErrors(newErrors)
    setTouched(newTouched)
    if (Object.values(newErrors).some(Boolean)) return
    mutation.mutate({
      category_id:          Number(form.category_id),
      product_service_type: form.product_service_type,
      attribute_type_name:  form.attribute_type_name.trim(),
      description:          form.description.trim() || null,
    })
  }

  const crumbs = [
    { label: 'Inventory',       to: '/inventory/attribute-types' },
    { label: 'Attribute Types', to: '/inventory/attribute-types' },
    { label: isEditing ? 'Edit Attribute Type' : 'New Attribute Type' },
  ]

  if (isEditing && isFetching) {
    return <div className="flex items-center justify-center py-16 text-sm text-slate-400">Loading…</div>
  }

  return (
    <div className="w-full">
      <div>
        <h1 className="text-xl font-bold leading-none text-slate-800">
          {isEditing ? 'Edit Attribute Type' : 'New Attribute Type'}
        </h1>
        <Breadcrumb crumbs={crumbs} />
      </div>
      <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} noValidate>
        <div className="w-full max-w-sm">
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-100 bg-slate-50 px-3 py-1.5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Attribute Type Details
              </h2>
            </div>

            <div className="space-y-2.5 p-3">

              {/* Category — collapsible nested tree */}
              <div>
                <label htmlFor="field-category_id" className="mb-0.5 block text-xs font-medium text-slate-600">
                  Category <span className="text-red-500">*</span>
                </label>
                <NestedCategorySelect
                  value={form.category_id}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  categories={categories}
                  hasError={!!(errors.category_id && touched.category_id)}
                />
                {errors.category_id && touched.category_id && (
                  <p className="mt-0.5 text-[11px] text-red-600">{errors.category_id}</p>
                )}
              </div>

              {/* Product / Service Type */}
              <div>
                <label className="mb-0.5 block text-xs font-medium text-slate-600">
                  Type <span className="text-red-500">*</span>
                </label>
                <div className={`flex items-center gap-4 rounded border px-2.5 py-1.5 ${
                  errors.product_service_type && touched.product_service_type
                    ? 'border-red-400 bg-red-50'
                    : 'border-slate-300 bg-white'
                }`}>
                  {[{ value: 'product', label: 'Product' }, { value: 'service', label: 'Service' }].map(({ value, label }) => (
                    <label key={value} className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-700 select-none">
                      <input
                        type="radio"
                        name="product_service_type"
                        value={value}
                        checked={form.product_service_type === value}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        className="accent-indigo-600"
                      />
                      {label}
                    </label>
                  ))}
                </div>
                {errors.product_service_type && touched.product_service_type && (
                  <p className="mt-0.5 text-[11px] text-red-600">{errors.product_service_type}</p>
                )}
              </div>

              {/* Attribute Type Name */}
              <div>
                <label htmlFor="field-attribute_type_name" className="mb-0.5 block text-xs font-medium text-slate-600">
                  Attribute Type Name <span className="text-red-500">*</span>
                </label>
                <input
                  ref={nameRef}
                  id="field-attribute_type_name"
                  name="attribute_type_name"
                  type="text"
                  value={form.attribute_type_name}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="e.g. Color, Size, Material"
                  maxLength={100}
                  autoComplete="off"
                  className={errors.attribute_type_name && touched.attribute_type_name ? inputErr : inputBase}
                />
                {errors.attribute_type_name && touched.attribute_type_name && (
                  <p className="mt-0.5 text-[11px] text-red-600">{errors.attribute_type_name}</p>
                )}
              </div>

              {/* Description */}
              <div>
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
                    placeholder="Briefly describe this attribute type…"
                    maxLength={255}
                    rows={3}
                    className={`${errors.description && touched.description ? inputErr : inputBase} resize-none pr-12`}
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

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-3 py-2">
              <Link
                to="/inventory/attribute-types"
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
                {mutation.isPending ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Attribute Type'}
              </button>
            </div>
          </div>

          {mutation.isError && !Object.keys(mutation.error?.response?.data?.errors ?? {}).length && (
            <p className="mt-2 text-xs text-red-600">
              {mutation.error?.response?.data?.message ?? 'An unexpected error occurred. Please try again.'}
            </p>
          )}
        </div>
      </form>
    </div>
  )
}
