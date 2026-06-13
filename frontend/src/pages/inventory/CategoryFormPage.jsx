import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Save } from 'lucide-react'
import { createCategory, getAllCategories, getCategory, updateCategory } from '../../api/categories'
import { getAllIndustries } from '../../api/industries'
import { getAllCompanies } from '../../api/companies'
import Breadcrumb from '../../components/Breadcrumb'

// ── Tree helpers ──────────────────────────────────────────────────────────────

/** Convert flat array into a nested tree, excluding a subtree rooted at excludeId. */
function buildTree(flat, parentId = null, excludeId = null) {
  return flat
    .filter((c) => (c.parent_category_id ?? null) === parentId && c.id !== excludeId)
    .map((c) => ({
      ...c,
      children: buildTree(flat, c.id, excludeId),
    }))
}

/** Walk the tree to find a node by id and return its name. */
function findName(nodes, id) {
  for (const node of nodes) {
    if (node.id === id) return node.category_name
    const found = findName(node.children, id)
    if (found) return found
  }
  return null
}

// ── CategoryTreeSelect ────────────────────────────────────────────────────────

function TreeNode({ node, selectedId, onSelect, depth = 0 }) {
  const hasChildren = node.children.length > 0
  const isSelected  = node.id === selectedId
  const [open, setOpen] = useState(true)

  return (
    <div>
      <div
        className={[
          'flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs transition-colors',
          isSelected
            ? 'bg-indigo-600 text-white'
            : 'text-slate-700 hover:bg-slate-100',
        ].join(' ')}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        {/* Chevron toggle — only for nodes with children */}
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
            className={[
              'flex shrink-0 items-center rounded p-0.5 transition-colors',
              isSelected ? 'hover:bg-indigo-500' : 'hover:bg-slate-200',
            ].join(' ')}
          >
            {open
              ? <ChevronDown size={11} strokeWidth={2.5} />
              : <ChevronRight size={11} strokeWidth={2.5} />}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}

        {/* Label — click to select */}
        <span
          className="flex-1 select-none truncate"
          onClick={() => onSelect(node.id)}
        >
          {node.category_name}
        </span>
      </div>

      {/* Children */}
      {hasChildren && open && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CategoryTreeSelect({ tree, value, onChange, hasError }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const selectedName = value ? findName(tree, Number(value)) : null

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleSelect = (id) => {
    onChange(id)
    setOpen(false)
  }

  const handleClear = (e) => {
    e.stopPropagation()
    onChange('')
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[
          'flex w-full items-center justify-between rounded border px-2.5 py-1.5 text-xs outline-none transition',
          hasError
            ? 'border-red-400 bg-white focus:border-red-400 focus:ring-2 focus:ring-red-500/20'
            : 'border-slate-300 bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20',
        ].join(' ')}
      >
        <span className={selectedName ? 'text-slate-800' : 'text-slate-400'}>
          {selectedName ?? '— None (top-level) —'}
        </span>
        <div className="flex items-center gap-1">
          {value && (
            <span
              onClick={handleClear}
              className="rounded px-0.5 text-slate-400 hover:text-slate-700"
              title="Clear"
            >
              ✕
            </span>
          )}
          <ChevronDown
            size={12}
            strokeWidth={2.5}
            className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          {/* "None" option */}
          <div
            onClick={() => handleSelect('')}
            className={[
              'cursor-pointer px-3 py-1.5 text-xs transition-colors',
              !value
                ? 'bg-indigo-600 text-white'
                : 'text-slate-500 italic hover:bg-slate-50',
            ].join(' ')}
          >
            — None (top-level) —
          </div>

          {/* Tree */}
          <div className="max-h-56 overflow-y-auto border-t border-slate-100 py-1">
            {tree.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-400">No categories available.</p>
            ) : (
              tree.map((node) => (
                <TreeNode
                  key={node.id}
                  node={node}
                  selectedId={value ? Number(value) : null}
                  onSelect={handleSelect}
                  depth={0}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Form helpers ──────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  category_name:        '',
  product_service_type: 'product',
  parent_category_id:   '',
  reference_name:       '',
  industry_id:          '',
  company_id:           '',
}

function validate(field, value) {
  switch (field) {
    case 'category_name':
      if (!String(value).trim()) return 'Category name is required.'
      if (String(value).length > 100) return 'Max 100 characters.'
      break
    case 'reference_name':
      if (String(value).length > 100) return 'Max 100 characters.'
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CategoryFormPage() {
  const { id }      = useParams()
  const isEditing   = Boolean(id)
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const nameRef     = useRef(null)

  const [form,    setForm]    = useState(EMPTY_FORM)
  const [errors,  setErrors]  = useState({})
  const [touched, setTouched] = useState({})

  const { data: allCategories = [] } = useQuery({
    queryKey: ['categories-all'],
    queryFn:  getAllCategories,
  })
  const { data: allIndustries = [] } = useQuery({
    queryKey: ['industries-all'],
    queryFn:  getAllIndustries,
  })
  const { data: allCompanies = [] } = useQuery({
    queryKey: ['companies-all'],
    queryFn:  getAllCompanies,
  })

  const { isLoading: isFetching, data: fetchedData } = useQuery({
    queryKey: ['category', id],
    queryFn:  () => getCategory(id),
    enabled:  isEditing,
  })

  const initialized = useRef(false)
  useLayoutEffect(() => {
    if (fetchedData?.data && !initialized.current) {
      const c = fetchedData.data
      setForm({
        category_name:        c.category_name        ?? '',
        product_service_type: c.product_service_type ?? 'product',
        parent_category_id:   c.parent_category_id   ?? '',
        reference_name:       c.reference_name       ?? '',
        industry_id:          c.industry_id           ?? '',
        company_id:           c.company_id            ?? '',
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
      isEditing ? updateCategory(id, payload) : createCategory(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      queryClient.invalidateQueries({ queryKey: ['categories-all'] })
      if (isEditing) queryClient.invalidateQueries({ queryKey: ['category', id] })
      navigate('/inventory/categories')
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
    const fields    = ['category_name', 'reference_name']
    const newErrors = Object.fromEntries(fields.map((f) => [f, validate(f, form[f])]))
    setErrors(newErrors)
    setTouched(Object.fromEntries(fields.map((f) => [f, true])))
    if (Object.values(newErrors).some(Boolean)) return

    mutation.mutate({
      category_name:        form.category_name.trim(),
      product_service_type: form.product_service_type,
      parent_category_id:   form.parent_category_id || null,
      reference_name:       form.reference_name.trim() || null,
      industry_id:          form.industry_id           || null,
      company_id:           form.company_id            || null,
    })
  }

  // Build tree — exclude self + descendants when editing
  const categoryTree = buildTree(allCategories, null, isEditing ? Number(id) : null)

  const crumbs = [
    { label: 'Inventory',  to: '/inventory/products' },
    { label: 'Categories', to: '/inventory/categories' },
    { label: isEditing ? 'Edit Category' : 'New Category' },
  ]

  if (isEditing && isFetching) {
    return <div className="flex items-center justify-center py-14 text-sm text-slate-400">Loading…</div>
  }

  return (
    <div className="w-full">
      <Breadcrumb crumbs={crumbs} />

      <div className="mb-2">
        <h1 className="text-xl font-bold text-slate-800">
          {isEditing ? 'Edit Category' : 'New Category'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">

          {/* Left — core fields */}
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-100 bg-slate-50 px-3 py-1.5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Category Details</h2>
            </div>
            <div className="space-y-3 p-4">

              <div>
                <Label required>Category Name</Label>
                <input
                  ref={nameRef}
                  name="category_name"
                  type="text"
                  value={form.category_name}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="e.g. Electronics"
                  maxLength={100}
                  autoComplete="off"
                  className={fieldCls(errors, touched, 'category_name')}
                />
                <FieldError errors={errors} touched={touched} name="category_name" />
              </div>

              {/* Type — radio buttons */}
              <div>
                <Label required>Type</Label>
                <div className="mt-1 flex items-center gap-4">
                  {[
                    { value: 'product', label: 'Product' },
                    { value: 'service', label: 'Service' },
                  ].map(({ value, label }) => (
                    <label key={value} className="flex cursor-pointer items-center gap-1.5">
                      <input
                        type="radio"
                        name="product_service_type"
                        value={value}
                        checked={form.product_service_type === value}
                        onChange={handleChange}
                        className="h-3.5 w-3.5 accent-indigo-600"
                      />
                      <span className="text-xs text-slate-700">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label>Reference Name</Label>
                <input
                  name="reference_name"
                  type="text"
                  value={form.reference_name}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Internal code or alias"
                  maxLength={100}
                  autoComplete="off"
                  className={fieldCls(errors, touched, 'reference_name')}
                />
                <FieldError errors={errors} touched={touched} name="reference_name" />
              </div>

            </div>
          </div>

          {/* Right — hierarchy & classification */}
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-100 bg-slate-50 px-3 py-1.5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Hierarchy &amp; Classification</h2>
            </div>
            <div className="space-y-3 p-4">

              <div>
                <Label>Parent Category</Label>
                <CategoryTreeSelect
                  tree={categoryTree}
                  value={form.parent_category_id}
                  onChange={(val) => setForm((prev) => ({ ...prev, parent_category_id: val }))}
                  hasError={Boolean(errors.parent_category_id && touched.parent_category_id)}
                />
                {errors.parent_category_id && touched.parent_category_id && (
                  <p className="mt-0.5 text-[11px] text-red-600">{errors.parent_category_id}</p>
                )}
                <p className="mt-1 text-[11px] text-slate-400">
                  Leave empty to create a top-level category.
                </p>
              </div>

              <div>
                <Label>Industry</Label>
                <select
                  name="industry_id"
                  value={form.industry_id}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={fieldCls(errors, touched, 'industry_id')}
                >
                  <option value="">— Select industry —</option>
                  {allIndustries.map((ind) => (
                    <option key={ind.id} value={ind.id}>{ind.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label>Company</Label>
                <select
                  name="company_id"
                  value={form.company_id}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={fieldCls(errors, touched, 'company_id')}
                >
                  <option value="">— Select company —</option>
                  {allCompanies.map((co) => (
                    <option key={co.id} value={co.id}>{co.name}</option>
                  ))}
                </select>
              </div>

            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-3 flex items-center justify-end gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2">
          <Link
            to="/inventory/categories"
            className="rounded px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100"
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

        {mutation.isError && !Object.keys(mutation.error?.response?.data?.errors ?? {}).length && (
          <p className="mt-2 text-xs text-red-600">
            {mutation.error?.response?.data?.message ?? 'An unexpected error occurred. Please try again.'}
          </p>
        )}
      </form>
    </div>
  )
}
