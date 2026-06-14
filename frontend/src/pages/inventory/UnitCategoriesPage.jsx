import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Edit2, Plus, Trash2 } from 'lucide-react'
import { deleteUnitCategory, getUnitCategories } from '../../api/unitCategories'
import Breadcrumb from '../../components/Breadcrumb'
import { confirmDelete, showError, showSuccess } from '../../utils/alerts'
import { usePermissions } from '../../hooks/usePermissions'

const CRUMBS = [
  { label: 'Inventory', to: '/inventory/unit-categories' },
  { label: 'Unit Categories' },
]

export default function UnitCategoriesPage() {
  const [page, setPage] = useState(1)
  const queryClient = useQueryClient()
  const { can } = usePermissions()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['unit-categories', page],
    queryFn: () => getUnitCategories(page),
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
    if (ok) deleteMutation.mutate(id)
  }

  const meta = data?.meta
  const rows = data?.data ?? []

  return (
    <div>
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold leading-none text-slate-800">Unit Categories</h1>
          <Breadcrumb crumbs={CRUMBS} />
        </div>
        {can('create_unit_categories') && (
          <Link
            to="/inventory/unit-categories/create"
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
          >
            <Plus size={15} strokeWidth={2.5} />
            New Category
          </Link>
        )}
      </div>

      {/* Table card */}
      <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {isLoading && (
          <div className="flex items-center justify-center py-16 text-sm text-slate-400">
            Loading…
          </div>
        )}

        {isError && (
          <div className="flex items-center justify-center py-16 text-sm text-red-500">
            Failed to load categories. Check that the backend is running.
          </div>
        )}

        {!isLoading && !isError && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left">
                    <th className="w-10 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      #
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Name
                    </th>
                    <th className="w-80 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Description
                    </th>
                    <th className="w-28 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Unit Types
                    </th>
                    <th className="w-32 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Created
                    </th>
                    <th className="w-20 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-14 text-center text-sm text-slate-400">
                        No categories yet.{' '}
                        {can('create_unit_categories') && (
                          <Link
                            to="/inventory/unit-categories/create"
                            className="font-medium text-indigo-600 hover:underline"
                          >
                            Create the first one.
                          </Link>
                        )}
                      </td>
                    </tr>
                  ) : (
                    rows.map((cat, i) => (
                      <tr
                        key={cat.id}
                        className="transition-colors hover:bg-slate-50"
                      >
                        {/* Row number */}
                        <td className="px-4 py-2.5 text-slate-400">
                          {(page - 1) * (meta?.per_page ?? 25) + i + 1}
                        </td>

                        {/* Name */}
                        <td className="px-4 py-2.5 font-medium text-slate-800">
                          {cat.name}
                        </td>

                        {/* Description — truncated with tooltip */}
                        <td className="max-w-xs px-4 py-2.5">
                          {cat.description ? (
                            <span
                              title={cat.description}
                              className="line-clamp-1 text-slate-500"
                            >
                              {cat.description}
                            </span>
                          ) : (
                            <span className="italic text-slate-300">—</span>
                          )}
                        </td>

                        {/* Unit types count */}
                        <td className="px-4 py-2.5 text-center text-slate-600">
                          {cat.unit_types_count ?? 0}
                        </td>

                        {/* Created date */}
                        <td className="whitespace-nowrap px-4 py-2.5 text-slate-400">
                          {new Date(cat.created_at).toLocaleDateString()}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            {can('edit_unit_categories') && (
                              <Link
                                to={`/inventory/unit-categories/${cat.id}/edit`}
                                title="Edit"
                                className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                              >
                                <Edit2 size={14} />
                              </Link>
                            )}
                            {can('delete_unit_categories') && (
                              <button
                                type="button"
                                title="Delete"
                                onClick={() => handleDelete(cat.id, cat.name)}
                                disabled={deleteMutation.isPending}
                                className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                              >
                                <Trash2 size={14} />
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

            {/* Pagination — only shown when multiple pages exist */}
            {meta && meta.last_page > 1 && (
              <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
                <p className="text-xs text-slate-500">
                  Showing{' '}
                  <span className="font-medium text-slate-700">
                    {(page - 1) * meta.per_page + 1}–
                    {Math.min(page * meta.per_page, meta.total)}
                  </span>{' '}
                  of <span className="font-medium text-slate-700">{meta.total}</span>
                </p>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPage((p) => p - 1)}
                    disabled={page === 1}
                    className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ← Prev
                  </button>
                  <span className="min-w-[4rem] text-center text-xs text-slate-400">
                    {page} / {meta.last_page}
                  </span>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page === meta.last_page}
                    className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
