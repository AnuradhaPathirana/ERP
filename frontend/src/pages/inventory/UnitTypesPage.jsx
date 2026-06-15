import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Edit2, Save, Trash2, X } from 'lucide-react'
import { getAllUnitCategories } from '../../api/unitCategories'
import {
  createUnitType, deleteUnitType, getUnitType, getUnitTypes, updateUnitType,
} from '../../api/unitTypes'
import Breadcrumb from '../../components/Breadcrumb'
import { confirmDelete, showError, showSuccess } from '../../utils/alerts'
import { usePermissions } from '../../hooks/usePermissions'

const CRUMBS = [
  { label: 'Inventory', to: '/inventory/unit-categories' },
  { label: 'Unit Types' },
]

const POSITION_BADGE = {
  prefix: { label: 'Prefix', cls: 'bg-violet-50 text-violet-700' },
  suffix: { label: 'Suffix', cls: 'bg-sky-50 text-sky-700' },
}

const POSITION_OPTIONS = [
  { value: 'suffix', label: 'Suffix', example: (sym) => `100 ${sym || 'unit'}` },
  { value: 'prefix', label: 'Prefix', example: (sym) => `${sym || 'unit'}100` },
]

const EMPTY_FORM = {
  unit_category_id: '',
  name:             '',
  symbol:           '',
  country:          '',
  unit_position:    'suffix',
}

function validate(field, value) {
  switch (field) {
    case 'unit_category_id':
      if (!value) return 'Category is required.'
      break
    case 'name':
      if (!String(value).trim()) return 'Name is required.'
      if (String(value).length > 100) return 'Max 100 characters.'
      break
    case 'symbol':
      if (!String(value).trim()) return 'Symbol is required.'
      if (String(value).length > 45) return 'Max 45 characters.'
      break
    case 'country':
      if (String(value).length > 45) return 'Max 45 characters.'
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

// ── Inline form panel ───────────────────────────────────────────────────────
function UnitTypeForm({ editId, onDone, onCancel }) {
  const isEditing   = Boolean(editId)
  const queryClient = useQueryClient()
  const nameRef     = useRef(null)

  const [form,    setForm]    = useState(EMPTY_FORM)
  const [errors,  setErrors]  = useState({})
  const [touched, setTouched] = useState({})

  const { data: categoriesData, isLoading: loadingCategories } = useQuery({
    queryKey: ['unit-categories-all'],
    queryFn:  getAllUnitCategories,
  })
  const categories = categoriesData?.data ?? []

  const { isLoading: isFetching, data: fetchedData } = useQuery({
    queryKey: ['unit-type', editId],
    queryFn:  () => getUnitType(editId),
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
      const ut = fetchedData.data
      setForm({
        unit_category_id: String(ut.unit_category_id ?? ''),
        name:             ut.name          ?? '',
        symbol:           ut.symbol        ?? '',
        country:          ut.country       ?? '',
        unit_position:    ut.unit_position ?? 'suffix',
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
      isEditing ? updateUnitType(editId, payload) : createUnitType(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unit-types'] })
      queryClient.invalidateQueries({ queryKey: ['unit-types-all'] })
      if (isEditing) queryClient.invalidateQueries({ queryKey: ['unit-type', editId] })
      showSuccess(isEditing ? 'Unit type updated.' : 'Unit type created.')
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
    const fields    = ['unit_category_id', 'name', 'symbol', 'country']
    const newErrors = Object.fromEntries(fields.map((f) => [f, validate(f, form[f])]))
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

  if (isEditing && isFetching) {
    return (
      <div className="flex items-center justify-center py-12 text-xs text-slate-400">Loading…</div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3 p-4">

      {/* Category */}
      <div>
        <label className="mb-0.5 block text-xs font-medium text-slate-600">
          Category <span className="text-red-500">*</span>
        </label>
        {loadingCategories ? (
          <div className="h-7 animate-pulse rounded bg-slate-100" />
        ) : categories.length === 0 ? (
          <p className="text-xs text-amber-600">
            No categories found.{' '}
            <Link to="/inventory/unit-categories" className="underline">Create one first.</Link>
          </p>
        ) : (
          <select
            name="unit_category_id"
            value={form.unit_category_id}
            onChange={handleChange}
            onBlur={handleBlur}
            className={fieldCls(errors, touched, 'unit_category_id')}
          >
            <option value="">— Select a category —</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        )}
        {errors.unit_category_id && touched.unit_category_id && (
          <p className="mt-0.5 text-[11px] text-red-600">{errors.unit_category_id}</p>
        )}
      </div>

      {/* Name + Symbol */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-0.5 block text-xs font-medium text-slate-600">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            ref={nameRef}
            name="name"
            type="text"
            value={form.name}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="e.g. Kilogram"
            maxLength={100}
            autoComplete="off"
            className={fieldCls(errors, touched, 'name')}
          />
          {errors.name && touched.name && (
            <p className="mt-0.5 text-[11px] text-red-600">{errors.name}</p>
          )}
        </div>
        <div>
          <label className="mb-0.5 block text-xs font-medium text-slate-600">
            Symbol <span className="text-red-500">*</span>
          </label>
          <input
            name="symbol"
            type="text"
            value={form.symbol}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="e.g. kg"
            maxLength={45}
            autoComplete="off"
            className={fieldCls(errors, touched, 'symbol')}
          />
          {errors.symbol && touched.symbol && (
            <p className="mt-0.5 text-[11px] text-red-600">{errors.symbol}</p>
          )}
        </div>
      </div>

      {/* Country */}
      <div>
        <label className="mb-0.5 block text-xs font-medium text-slate-600">
          Country <span className="text-[11px] font-normal text-slate-400">(optional)</span>
        </label>
        <input
          name="country"
          type="text"
          value={form.country}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="e.g. US, IN, GB"
          maxLength={45}
          autoComplete="off"
          className={fieldCls(errors, touched, 'country')}
        />
        {errors.country && touched.country && (
          <p className="mt-0.5 text-[11px] text-red-600">{errors.country}</p>
        )}
      </div>

      {/* Unit Position */}
      <div>
        <p className="mb-1 text-xs font-medium text-slate-600">
          Unit Position <span className="text-red-500">*</span>
        </p>
        <div className="grid grid-cols-2 gap-2">
          {POSITION_OPTIONS.map((opt) => {
            const isSelected = form.unit_position === opt.value
            return (
              <label
                key={opt.value}
                className={[
                  'flex cursor-pointer flex-col gap-1.5 rounded-lg border-2 p-2.5 transition-all',
                  isSelected ? 'border-indigo-500 bg-indigo-50/60' : 'border-slate-200 hover:border-slate-300',
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
                  <span className={`text-xs font-semibold ${isSelected ? 'text-indigo-700' : 'text-slate-700'}`}>
                    {opt.label}
                  </span>
                  <span className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 ${isSelected ? 'border-indigo-500' : 'border-slate-300'}`}>
                    {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />}
                  </span>
                </div>
                <code className="text-[11px] text-slate-500">{opt.example(form.symbol)}</code>
              </label>
            )
          })}
        </div>
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
          disabled={mutation.isPending || (categories.length === 0 && !isEditing)}
          className="flex items-center gap-1.5 rounded bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save size={13} strokeWidth={2.5} />
          {mutation.isPending ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Unit Type'}
        </button>
      </div>
    </form>
  )
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function UnitTypesPage() {
  const [page,   setPage]   = useState(1)
  const [editId, setEditId] = useState(null)
  const queryClient = useQueryClient()
  const { can } = usePermissions()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['unit-types', page],
    queryFn:  () => getUnitTypes(page),
    placeholderData: (prev) => prev,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteUnitType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unit-types'] })
      showSuccess('Unit type deleted.')
    },
    onError: () => showError('Failed to delete. The unit type may be in use.'),
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
        <h1 className="text-xl font-bold leading-none text-slate-800">Unit Types</h1>
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
              Failed to load unit types.
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
                      <th className="w-20 px-3 py-2 font-semibold uppercase tracking-wider text-slate-500">Symbol</th>
                      <th className="px-3 py-2 font-semibold uppercase tracking-wider text-slate-500">Category</th>
                      <th className="w-20 px-3 py-2 font-semibold uppercase tracking-wider text-slate-500">Position</th>
                      <th className="w-20 px-3 py-2 font-semibold uppercase tracking-wider text-slate-500">Country</th>
                      <th className="w-24 px-3 py-2 font-semibold uppercase tracking-wider text-slate-500">Created</th>
                      <th className="w-16 px-3 py-2 text-right font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-400">
                          No unit types yet. Use the form to create the first one.
                        </td>
                      </tr>
                    ) : (
                      rows.map((ut, i) => {
                        const badge = POSITION_BADGE[ut.unit_position] ?? POSITION_BADGE.suffix
                        return (
                          <tr
                            key={ut.id}
                            className={`transition-colors hover:bg-slate-50 ${editId === ut.id ? 'bg-indigo-50/60' : ''}`}
                          >
                            <td className="px-3 py-2 text-slate-400">
                              {(page - 1) * (meta?.per_page ?? 25) + i + 1}
                            </td>
                            <td className="px-3 py-2 font-medium text-slate-800">{ut.name}</td>
                            <td className="px-3 py-2">
                              <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-700">
                                {ut.symbol}
                              </code>
                            </td>
                            <td className="px-3 py-2 text-slate-500">
                              {ut.category?.name ?? <span className="italic text-slate-300">—</span>}
                            </td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.cls}`}>
                                {badge.label}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-slate-400">
                              {ut.country || <span className="italic text-slate-300">—</span>}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-slate-400">
                              {new Date(ut.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center justify-end gap-1">
                                {can('edit_unit_types') && (
                                  <button
                                    type="button"
                                    title="Edit"
                                    onClick={() => setEditId(ut.id)}
                                    className={`rounded p-1 transition-colors ${editId === ut.id ? 'bg-indigo-100 text-indigo-600' : 'text-amber-500 hover:bg-amber-50 hover:text-amber-700'}`}
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                )}
                                {can('delete_unit_types') && (
                                  <button
                                    type="button"
                                    title="Delete"
                                    onClick={() => handleDelete(ut.id, ut.name)}
                                    disabled={deleteMutation.isPending}
                                    className="rounded p-1 text-red-500 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })
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
              {editId ? 'Edit Unit Type' : 'New Unit Type'}
            </h2>
            {editId && (
              <span className="flex items-center gap-1 rounded bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-600">
                <Edit2 size={10} /> Editing
              </span>
            )}
          </div>

          {can('create_unit_types') || can('edit_unit_types') ? (
            <UnitTypeForm
              key={editId ?? 'create'}
              editId={editId}
              onDone={handleDone}
              onCancel={() => setEditId(null)}
            />
          ) : (
            <div className="p-4 text-xs text-slate-400">
              You don't have permission to manage unit types.
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
