import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Edit2, Plus, Trash2 } from 'lucide-react'
import { deleteAttribute, getAttributes } from '../../api/attributes'
import Breadcrumb from '../../components/Breadcrumb'
import { confirmDelete, showError, showSuccess } from '../../utils/alerts'

const CRUMBS = [
  { label: 'Inventory', to: '/inventory/attributes' },
  { label: 'Attributes' },
]

export default function AttributesPage() {
  const [page, setPage] = useState(1)
  const queryClient = useQueryClient()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['attributes', page],
    queryFn: () => getAttributes(page),
    placeholderData: (prev) => prev,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteAttribute,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attributes'] }),
  })

  const handleDelete = (id, name) => {
    if (window.confirm(`Delete "${name}"? This cannot be undone.`)) {
      deleteMutation.mutate(id)
    }
  }

  const meta = data?.meta
  const rows = data?.data ?? []

  return (
    <div>
      <Breadcrumb crumbs={CRUMBS} />

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Attributes</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Individual attribute values grouped under attribute types (e.g. Red, XL, Cotton).
          </p>
        </div>
        <Link
          to="/inventory/attributes/create"
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
        >
          <Plus size={15} strokeWidth={2.5} />
          New Attribute
        </Link>
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {isLoading && (
          <div className="flex items-center justify-center py-16 text-sm text-slate-400">Loading…</div>
        )}
        {isError && (
          <div className="flex items-center justify-center py-16 text-sm text-red-500">
            Failed to load attributes. Check that the backend is running.
          </div>
        )}

        {!isLoading && !isError && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left">
                    <th className="w-10 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">#</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Attribute Name</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Attribute Type</th>
                    <th className="w-32 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Created</th>
                    <th className="w-20 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-14 text-center text-sm text-slate-400">
                        No attributes yet.{' '}
                        <Link
                          to="/inventory/attributes/create"
                          className="font-medium text-indigo-600 hover:underline"
                        >
                          Create the first one.
                        </Link>
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, i) => (
                      <tr key={row.id} className="transition-colors hover:bg-slate-50">
                        <td className="px-4 py-2.5 text-slate-400">
                          {(page - 1) * (meta?.per_page ?? 25) + i + 1}
                        </td>

                        <td className="px-4 py-2.5 font-medium text-slate-800">
                          {row.attribute_name}
                        </td>

                        <td className="px-4 py-2.5 text-slate-600">
                          {row.attribute_type_name ?? <span className="italic text-slate-300">—</span>}
                        </td>

                        <td className="whitespace-nowrap px-4 py-2.5 text-slate-400">
                          {new Date(row.created_at).toLocaleDateString()}
                        </td>

                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              to={`/inventory/attributes/${row.id}/edit`}
                              title="Edit"
                              className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                            >
                              <Edit2 size={14} />
                            </Link>
                            <button
                              type="button"
                              title="Delete"
                              onClick={() => handleDelete(row.id, row.attribute_name)}
                              disabled={deleteMutation.isPending}
                              className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {meta && meta.last_page > 1 && (
              <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
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
