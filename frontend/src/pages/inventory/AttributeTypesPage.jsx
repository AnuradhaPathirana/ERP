import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Edit2, Save, Trash2, X } from 'lucide-react'
import { createAttributeType, deleteAttributeType, getAttributeType, getAttributeTypes, updateAttributeType } from '../../api/attributeTypes'
import { getAllCategories } from '../../api/categories'
import Breadcrumb from '../../components/Breadcrumb'
import { confirmDelete, showError, showSuccess } from '../../utils/alerts'
import { usePermissions } from '../../hooks/usePermissions'

const CRUMBS = [
  { label: 'Inventory', to: '/inventory/attribute-types' },
  { label: 'Attribute Types' },
]

const TYPE_BADGE = {
  product: 'bg-blue-50 text-blue-700',
  service: 'bg-violet-50 text-violet-700',
}

const EMPTY_FORM = {
  category_id:          '',
  product_service_type: 'product',
  attribute_type_name:  '',
  description:          '',
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

// ── Nested category tree ────────────────────────────────────────────────────
function buildTree(categories, parentId = null) {
  return categories
    .filter((c) => (c.parent_category_id ?? null) === parentId)
    .map((c) => ({ ...c, children: buildTree(categories, c.id) }))
}

function NestedCategorySelect({ value, onChange, onBlur, categories, hasError }) {
  const [open,       setOpen]       = useState(false)
  const [expanded,   setExpanded]   = useState({})
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
      setPanelStyle({ position: 'fixed', top: rect.bottom + 2, left: rect.left, width: rect.width, zIndex: 9999 })
    }
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

  useEffect(() => {
    if (!open) return
    const handler = () => setOpen(false)
    window.addEventListener('scroll', handler, true)
    return () => window.removeEventListener('scroll', handler, true)
  }, [open])

  const toggleExpand = (id) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  const handleSelect = (id) => { onChange({ target: { name: 'category_id', value: String(id) } }); setOpen(false) }

  const renderNode = (node, depth = 0) => {
    const hasChildren = node.children.length > 0
    const isExpanded  = !!expanded[node.id]
    const isSelected  = String(node.id) === String(value)
    return (
      <div key={node.id}>
        <div
          style={{ paddingLeft: `${6 + depth * 14}px` }}
          className={`flex items-center gap-0.5 py-1 pr-2 text-xs ${isSelected ? 'bg-indigo-50 font-medium text-indigo-700' : 'text-slate-700'}`}
        >
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => { e.stopPropagation(); if (hasChildren) toggleExpand(node.id) }}
            className={`flex w-5 shrink-0 items-center justify-center rounded text-slate-400 hover:text-slate-600 ${hasChildren ? 'cursor-pointer' : 'pointer-events-none cursor-default opacity-0'}`}
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
        <ChevronDown size={12} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && createPortal(
        <div ref={panelRef} style={panelStyle} className="rounded border border-slate-200 bg-white shadow-lg">
          <div className="max-h-60 overflow-y-auto py-1">
            {tree.length === 0
              ? <p className="px-3 py-2 text-xs text-slate-400">No categories available</p>
              : tree.map((node) => renderNode(node))
            }
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

// ── Inline form panel ───────────────────────────────────────────────────────
const inputBase =
  'block w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-300 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20'
const inputErr =
  'block w-full rounded border border-red-400 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-300 outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-500/20'

function AttributeTypeForm({ editId, onDone, onCancel }) {
  const isEditing   = Boolean(editId)
  const queryClient = useQueryClient()
  const nameRef     = useRef(null)

  const [form,    setForm]    = useState(EMPTY_FORM)
  const [errors,  setErrors]  = useState({})
  const [touched, setTouched] = useState({})

  const { data: categoriesData } = useQuery({
    queryKey: ['categories-all'],
    queryFn:  getAllCategories,
  })
  const categories = categoriesData ?? []

  const { isLoading: isFetching, data: fetchedData } = useQuery({
    queryKey: ['attribute-type', editId],
    queryFn:  () => getAttributeType(editId),
    enabled:  isEditing,
  })

  const initialized = useRef(false)
  useLayoutEffect(() => {
    initialized.current = false
    setForm(EMPTY_FORM)
    setErrors({})
    setTouched({})
  }, [editId])

  useLayoutEffect(() => {
    if (fetchedData?.data && !initialized.current) {
      const t = fetchedData.data
      setForm({
        category_id:          String(t.category_id ?? ''),
        product_service_type: t.product_service_type ?? 'product',
        attribute_type_name:  t.attribute_type_name  ?? '',
        description:          t.description          ?? '',
      })
      initialized.current = true
    }
  }, [fetchedData])

  useEffect(() => {
    if (!isFetching) nameRef.current?.focus()
  }, [isFetching, editId])

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
      isEditing ? updateAttributeType(editId, payload) : createAttributeType(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attribute-types'] })
      queryClient.invalidateQueries({ queryKey: ['attribute-types-all'] })
      if (isEditing) queryClient.invalidateQueries({ queryKey: ['attribute-type', editId] })
      showSuccess(isEditing ? 'Attribute type updated.' : 'Attribute type created.')
      onDone()
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
    const fields    = ['category_id', 'product_service_type', 'attribute_type_name', 'description']
    const newErrors = Object.fromEntries(fields.map((f) => [f, validate(f, form[f])]))
    setErrors(newErrors)
    setTouched(Object.fromEntries(fields.map((f) => [f, true])))
    if (Object.values(newErrors).some(Boolean)) return
    mutation.mutate({
      category_id:          Number(form.category_id),
      product_service_type: form.product_service_type,
      attribute_type_name:  form.attribute_type_name.trim(),
      description:          form.description.trim() || null,
    })
  }

  if (isEditing && isFetching) {
    return <div className="flex items-center justify-center py-12 text-xs text-slate-400">Loading…</div>
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3 p-4">

      {/* Category */}
      <div>
        <label className="mb-0.5 block text-xs font-medium text-slate-600">
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

      {/* Type radio */}
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
        <label className="mb-0.5 block text-xs font-medium text-slate-600">
          Attribute Type Name <span className="text-red-500">*</span>
        </label>
        <input
          ref={nameRef}
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
        <label className="mb-0.5 block text-xs font-medium text-slate-600">
          Description <span className="text-[11px] font-normal text-slate-400">(optional)</span>
        </label>
        <div className="relative">
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Briefly describe this attribute type…"
            maxLength={255}
            rows={3}
            className={`${errors.description && touched.description ? inputErr : inputBase} resize-none pb-5`}
          />
          <span className="absolute bottom-1.5 right-2 text-[10px] text-slate-400">
            {form.description.length}/255
          </span>
        </div>
        {errors.description && touched.description && (
          <p className="mt-0.5 text-[11px] text-red-600">{errors.description}</p>
        )}
      </div>

      {mutation.isError && !Object.keys(mutation.error?.response?.data?.errors ?? {}).length && (
        <p className="text-xs text-red-600">
          {mutation.error?.response?.data?.message ?? 'An unexpected error occurred.'}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-1">
        {isEditing && (
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-1 rounded px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200"
          >
            <X size={12} />
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={mutation.isPending}
          className="flex items-center gap-1.5 rounded bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save size={13} strokeWidth={2.5} />
          {mutation.isPending ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Attribute Type'}
        </button>
      </div>
    </form>
  )
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function AttributeTypesPage() {
  const [page,   setPage]   = useState(1)
  const [editId, setEditId] = useState(null)
  const queryClient = useQueryClient()
  const { can } = usePermissions()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['attribute-types', page],
    queryFn:  () => getAttributeTypes(page),
    placeholderData: (prev) => prev,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteAttributeType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attribute-types'] })
      showSuccess('Attribute type deleted.')
    },
    onError: () => showError('Failed to delete. The attribute type may be in use.'),
  })

  const handleDelete = async (id, name) => {
    const ok = await confirmDelete(name)
    if (ok) {
      if (editId === id) setEditId(null)
      deleteMutation.mutate(id)
    }
  }

  const handleDone = () => setEditId(null)

  const meta = data?.meta
  const rows = data?.data ?? []

  return (
    <div className="w-full">
      <div>
        <h1 className="text-xl font-bold leading-none text-slate-800">Attribute Types</h1>
        <Breadcrumb crumbs={CRUMBS} />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">

        {/* ── LEFT: Table ─────────────────────────────────────────────── */}
        <div className="lg:col-span-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {isLoading && (
            <div className="flex items-center justify-center py-16 text-sm text-slate-400">Loading…</div>
          )}
          {isError && (
            <div className="flex items-center justify-center py-16 text-sm text-red-500">
              Failed to load attribute types.
            </div>
          )}

          {!isLoading && !isError && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left">
                      <th className="w-8 px-3 py-2 font-semibold uppercase tracking-wider text-slate-500">#</th>
                      <th className="px-3 py-2 font-semibold uppercase tracking-wider text-slate-500">Name</th>
                      <th className="w-24 px-3 py-2 font-semibold uppercase tracking-wider text-slate-500">Type</th>
                      <th className="px-3 py-2 font-semibold uppercase tracking-wider text-slate-500">Category</th>
                      <th className="px-3 py-2 font-semibold uppercase tracking-wider text-slate-500">Description</th>
                      <th className="w-20 px-3 py-2 text-center font-semibold uppercase tracking-wider text-slate-500">Attrs</th>
                      <th className="w-24 px-3 py-2 font-semibold uppercase tracking-wider text-slate-500">Created</th>
                      <th className="w-16 px-3 py-2 text-right font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-400">
                          No attribute types yet. Use the form to create the first one.
                        </td>
                      </tr>
                    ) : (
                      rows.map((row, i) => (
                        <tr
                          key={row.id}
                          className={`transition-colors hover:bg-slate-50 ${editId === row.id ? 'bg-indigo-50/60' : ''}`}
                        >
                          <td className="px-3 py-2 text-slate-400">
                            {(page - 1) * (meta?.per_page ?? 25) + i + 1}
                          </td>
                          <td className="px-3 py-2 font-medium text-slate-800">
                            {row.attribute_type_name}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold capitalize ${TYPE_BADGE[row.product_service_type] ?? 'bg-slate-100 text-slate-600'}`}>
                              {row.product_service_type}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-500">
                            {row.category_name ?? <span className="italic text-slate-300">—</span>}
                          </td>
                          <td className="max-w-xs px-3 py-2 text-slate-500">
                            {row.description
                              ? <span className="line-clamp-1" title={row.description}>{row.description}</span>
                              : <span className="italic text-slate-300">—</span>}
                          </td>
                          <td className="px-3 py-2 text-center text-slate-600">
                            {row.attributes_count ?? 0}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-slate-400">
                            {new Date(row.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-end gap-1">
                              {can('edit_attribute_types') && (
                                <button
                                  type="button"
                                  title="Edit"
                                  onClick={() => setEditId(row.id)}
                                  className={`rounded p-1 transition-colors ${editId === row.id ? 'bg-indigo-100 text-indigo-600' : 'text-amber-500 hover:bg-amber-50 hover:text-amber-700'}`}
                                >
                                  <Edit2 size={13} />
                                </button>
                              )}
                              {can('delete_attribute_types') && (
                                <button
                                  type="button"
                                  title="Delete"
                                  onClick={() => handleDelete(row.id, row.attribute_type_name)}
                                  disabled={deleteMutation.isPending}
                                  className="rounded p-1 text-red-500 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {meta && meta.last_page > 1 && (
                <div className="flex items-center justify-between border-t border-slate-200 px-3 py-2">
                  <p className="text-xs text-slate-500">
                    Showing{' '}
                    <span className="font-medium text-slate-700">
                      {(page - 1) * meta.per_page + 1}–{Math.min(page * meta.per_page, meta.total)}
                    </span>{' '}
                    of <span className="font-medium text-slate-700">{meta.total}</span>
                  </p>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setPage((p) => p - 1)}
                      disabled={page === 1}
                      className="rounded px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      ← Prev
                    </button>
                    <span className="min-w-14 text-center text-xs text-slate-400">
                      {page} / {meta.last_page}
                    </span>
                    <button
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page === meta.last_page}
                      className="rounded px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── RIGHT: Form panel ───────────────────────────────────────── */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm self-start">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {editId ? 'Edit Attribute Type' : 'New Attribute Type'}
            </h2>
            {editId && (
              <span className="flex items-center gap-1 rounded bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-600">
                <Edit2 size={10} /> Editing
              </span>
            )}
          </div>

          {can('create_attribute_types') || can('edit_attribute_types') ? (
            <AttributeTypeForm
              key={editId ?? 'create'}
              editId={editId}
              onDone={handleDone}
              onCancel={() => setEditId(null)}
            />
          ) : (
            <div className="p-4 text-xs text-slate-400">
              You don't have permission to manage attribute types.
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
