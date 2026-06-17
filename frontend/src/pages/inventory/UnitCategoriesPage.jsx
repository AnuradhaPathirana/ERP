import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Edit2, Save, Trash2, X } from 'lucide-react'
import {
  createUnitCategories, deleteUnitCategory, getUnitCategories, getUnitCategory, updateUnitCategory,
} from '../../api/unitCategories'
import Breadcrumb from '../../components/Breadcrumb'
import { confirmDelete, showError, showSuccess } from '../../utils/alerts'
import { usePermissions } from '../../hooks/usePermissions'

const CRUMBS = [
  { label: 'Inventory', to: '/inventory/unit-categories' },
  { label: 'Unit Categories' },
]

const EMPTY_FORM = { name: '', description: '' }

const inputBase =
  'block w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-300 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20'
const inputErr =
  'block w-full rounded border border-red-400 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-300 outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-500/20'

// ── Inline form panel ───────────────────────────────────────────────────────
function UnitCategoryForm({ editId, onDone, onCancel }) {
  const isEditing   = Boolean(editId)
  const queryClient = useQueryClient()
  const nameRef     = useRef(null)

  const [form,    setForm]    = useState(EMPTY_FORM)
  const [errors,  setErrors]  = useState({})
  const [touched, setTouched] = useState({})

  const { isLoading: isFetching, data: fetchedData } = useQuery({
    queryKey: ['unit-category', editId],
    queryFn:  () => getUnitCategory(editId),
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
      const cat = fetchedData.data
      setForm({ name: cat.name ?? '', description: cat.description ?? '' })
      initialized.current = true
    }
  }, [fetchedData])

  useEffect(() => {
    if (!isFetching) nameRef.current?.focus()
  }, [isFetching, editId])

  // Parsed name chips — only relevant in create mode
  const parsedNames = !isEditing
    ? form.name.split(',').map((s) => s.trim()).filter(Boolean)
    : []

  const validate = (field, value) => {
    if (field === 'name') {
      if (!value.trim()) return 'Name is required.'
      if (isEditing) {
        if (value.length > 100) return 'Max 100 characters.'
      } else {
        const names = value.split(',').map((s) => s.trim()).filter(Boolean)
        const overLimit = names.find((n) => n.length > 100)
        if (overLimit) return `"${overLimit.substring(0, 25)}…" exceeds 100 characters.`
        const lower = names.map((n) => n.toLowerCase())
        if (lower.some((n, i) => lower.indexOf(n) !== i)) return 'Duplicate names detected.'
      }
    }
    if (field === 'description' && value.length > 255) return 'Max 255 characters.'
    return ''
  }

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
      isEditing ? updateUnitCategory(editId, payload) : createUnitCategories(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['unit-categories'] })
      queryClient.invalidateQueries({ queryKey: ['unit-categories-all'] })
      if (isEditing) queryClient.invalidateQueries({ queryKey: ['unit-category', editId] })
      const count = !isEditing ? (data?.data?.length ?? 1) : null
      showSuccess(
        isEditing ? 'Unit category updated.'
          : count > 1 ? `${count} unit categories created.` : 'Unit category created.',
      )
      onDone()
    },
    onError: (err) => {
      const apiErrors = err.response?.data?.errors ?? {}
      if (Object.keys(apiErrors).length) {
        setErrors(Object.fromEntries(Object.entries(apiErrors).map(([k, v]) => [k, v[0]])))
        setTouched({ name: true, description: true })
      }
      showError('Failed to save. Please check the form and try again.')
    },
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    const nameErr = validate('name', form.name)
    const descErr = validate('description', form.description)
    setErrors({ name: nameErr, description: descErr })
    setTouched({ name: true, description: true })
    if (nameErr || descErr) return
    if (isEditing) {
      mutation.mutate({ name: form.name.trim(), description: form.description.trim() || null })
    } else {
      const names = form.name.split(',').map((s) => s.trim()).filter(Boolean)
      mutation.mutate({ names, description: form.description.trim() || null })
    }
  }

  if (isEditing && isFetching) {
    return (
      <div className="flex items-center justify-center py-12 text-xs text-slate-400">Loading…</div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3 p-4">

      {/* Name(s) */}
      <div>
        <label className="mb-0.5 block text-xs font-medium text-slate-600">
          {isEditing ? 'Name' : 'Name(s)'} <span className="text-red-500">*</span>
        </label>
        <input
          ref={nameRef}
          name="name"
          type="text"
          value={form.name}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={isEditing ? 'e.g. Weight' : 'e.g. Weight, Length, Volume'}
          maxLength={isEditing ? 100 : undefined}
          autoComplete="off"
          className={errors.name && touched.name ? inputErr : inputBase}
        />
        {errors.name && touched.name ? (
          <p className="mt-0.5 text-[11px] text-red-600">{errors.name}</p>
        ) : isEditing ? (
          <p className="mt-0.5 text-[11px] text-slate-400">{form.name.length}/100</p>
        ) : (
          <p className="mt-0.5 text-[11px] text-slate-400">Separate multiple names with commas</p>
        )}
        {/* Parsed name chips — visible when 2+ names are detected */}
        {!isEditing && parsedNames.length > 1 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {parsedNames.map((name, i) => (
              <span
                key={i}
                className="inline-flex items-center rounded border border-indigo-100 bg-indigo-50 px-1.5 py-0.5 text-[11px] font-medium text-indigo-700"
              >
                {name}
              </span>
            ))}
          </div>
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
            placeholder="Briefly describe what this category covers…"
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
          {mutation.isPending
            ? 'Saving…'
            : isEditing
              ? 'Save Changes'
              : parsedNames.length > 1
                ? `Create ${parsedNames.length} Categories`
                : 'Create Category'}
        </button>
      </div>
    </form>
  )
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function UnitCategoriesPage() {
  const [page,   setPage]   = useState(1)
  const [editId, setEditId] = useState(null)
  const queryClient = useQueryClient()
  const { can } = usePermissions()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['unit-categories', page],
    queryFn:  () => getUnitCategories(page),
    placeholderData: (prev) => prev,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteUnitCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unit-categories'] })
      showSuccess('Unit category deleted.')
    },
    onError: () => showError('Failed to delete. The unit category may be in use.'),
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
        <h1 className="text-xl font-bold leading-none text-slate-800">Unit Categories</h1>
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
              Failed to load categories.
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
                      <th className="px-3 py-2 font-semibold uppercase tracking-wider text-slate-500">Description</th>
                      <th className="w-24 px-3 py-2 text-center font-semibold uppercase tracking-wider text-slate-500">Unit Types</th>
                      <th className="w-24 px-3 py-2 font-semibold uppercase tracking-wider text-slate-500">Created</th>
                      <th className="w-16 px-3 py-2 text-right font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-400">
                          No categories yet. Use the form to create the first one.
                        </td>
                      </tr>
                    ) : (
                      rows.map((cat, i) => (
                        <tr
                          key={cat.id}
                          className={`transition-colors hover:bg-slate-50 ${editId === cat.id ? 'bg-indigo-50/60' : ''}`}
                        >
                          <td className="px-3 py-2 text-slate-400">
                            {(page - 1) * (meta?.per_page ?? 25) + i + 1}
                          </td>
                          <td className="px-3 py-2 font-medium text-slate-800">{cat.name}</td>
                          <td className="max-w-xs px-3 py-2 text-slate-500">
                            {cat.description
                              ? <span className="line-clamp-1" title={cat.description}>{cat.description}</span>
                              : <span className="italic text-slate-300">—</span>}
                          </td>
                          <td className="px-3 py-2 text-center text-slate-600">
                            {cat.unit_types_count ?? 0}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-slate-400">
                            {new Date(cat.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-end gap-1">
                              {can('edit_unit_categories') && (
                                <button
                                  type="button"
                                  title="Edit"
                                  onClick={() => setEditId(cat.id)}
                                  className={`rounded p-1 transition-colors ${editId === cat.id ? 'bg-indigo-100 text-indigo-600' : 'text-amber-500 hover:bg-amber-50 hover:text-amber-700'}`}
                                >
                                  <Edit2 size={13} />
                                </button>
                              )}
                              {can('delete_unit_categories') && (
                                <button
                                  type="button"
                                  title="Delete"
                                  onClick={() => handleDelete(cat.id, cat.name)}
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
              {editId ? 'Edit Category' : 'New Category'}
            </h2>
            {editId && (
              <span className="flex items-center gap-1 rounded bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-600">
                <Edit2 size={10} /> Editing
              </span>
            )}
          </div>

          {can('create_unit_categories') || can('edit_unit_categories') ? (
            <UnitCategoryForm
              key={editId ?? 'create'}
              editId={editId}
              onDone={handleDone}
              onCancel={() => setEditId(null)}
            />
          ) : (
            <div className="p-4 text-xs text-slate-400">
              You don't have permission to manage unit categories.
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
