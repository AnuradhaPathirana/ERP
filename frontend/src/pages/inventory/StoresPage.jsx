import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Edit2, Plus, Trash2 } from 'lucide-react'
import { deleteStore, getStores } from '../../api/stores'
import Breadcrumb from '../../components/Breadcrumb'

const CRUMBS = [
  { label: 'Inventory', to: '/inventory/stores' },
  { label: 'Stores' },
]

export default function StoresPage() {
  const [page, setPage] = useState(1)
  const queryClient = useQueryClient()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['stores', page],
    queryFn: () => getStores(page),
    placeholderData: (prev) => prev,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteStore,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stores'] }),
  })

  const handleDelete = (id, name) => {
    if (window.confirm(`Delete store "${name}"? This cannot be undone.`)) {
      deleteMutation.mutate(id)
    }
  }

  const meta = data?.meta
  const rows = data?.data ?? []

  return (
    <div className="w-full">
      <Breadcrumb crumbs={CRUMBS} />

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Stores</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Manage warehouses and storage locations.
          </p>
        </div>
        <Link
          to="/inventory/stores/create"
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
        >
          <Plus size={14} strokeWidth={2.5} />
          New Store
        </Link>
      </div>

      <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {isLoading && (
          <div className="flex items-center justify-center py-14 text-sm text-slate-400">Loading…</div>
        )}
        {isError && (
          <div className="flex items-center justify-center py-14 text-sm text-red-500">
            Failed to load stores. Check that the backend is running.
          </div>
        )}

        {!isLoading && !isError && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left">
                    <th className="w-8 px-3 py-2 font-semibold uppercase tracking-wider text-slate-500">#</th>
                    <th className="w-28 px-3 py-2 font-semibold uppercase tracking-wider text-slate-500">Code</th>
                    <th className="px-3 py-2 font-semibold uppercase tracking-wider text-slate-500">Store Name</th>
                    <th className="w-32 px-3 py-2 font-semibold uppercase tracking-wider text-slate-500">Type</th>
                    <th className="w-36 px-3 py-2 font-semibold uppercase tracking-wider text-slate-500">Location</th>
                    <th className="w-20 px-3 py-2 font-semibold uppercase tracking-wider text-slate-500">UOM</th>
                    <th className="w-24 px-3 py-2 text-right font-semibold uppercase tracking-wider text-slate-500">Capacity</th>
                    <th className="w-20 px-3 py-2 font-semibold uppercase tracking-wider text-slate-500">Status</th>
                    <th className="w-24 px-3 py-2 font-semibold uppercase tracking-wider text-slate-500">Created</th>
                    <th className="w-20 px-3 py-2 text-right font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-sm text-slate-400">
                        No stores yet.{' '}
                        <Link to="/inventory/stores/create" className="font-medium text-indigo-600 hover:underline">
                          Create the first one.
                        </Link>
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, i) => (
                      <tr key={row.id} className="transition-colors hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-400">
                          {(page - 1) * (meta?.per_page ?? 25) + i + 1}
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-500">{row.store_code}</td>
                        <td className="max-w-[200px] px-3 py-2 font-medium text-slate-800">
                          <Link
                            to={`/inventory/stores/${row.id}/edit`}
                            className="truncate hover:text-indigo-600 hover:underline"
                          >
                            {row.store_name}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-slate-500">
                          {row.store_type?.name ?? <span className="italic text-slate-300">—</span>}
                        </td>
                        <td className="max-w-[144px] truncate px-3 py-2 text-slate-500">
                          {row.location?.name ?? <span className="italic text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-2 text-slate-500">{row.uom}</td>
                        <td className="px-3 py-2 text-right font-medium text-slate-700">
                          {Number(row.capacity).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-2">
                          {row.is_active ? (
                            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold bg-green-50 text-green-700">Active</span>
                          ) : (
                            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-500">Inactive</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-400">
                          {new Date(row.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              to={`/inventory/stores/${row.id}/edit`}
                              title="Edit"
                              className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                            >
                              <Edit2 size={13} />
                            </Link>
                            <button
                              type="button"
                              title="Delete"
                              onClick={() => handleDelete(row.id, row.store_name)}
                              disabled={deleteMutation.isPending}
                              className="rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                            >
                              <Trash2 size={13} />
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
              <div className="flex items-center justify-between border-t border-slate-200 px-4 py-2">
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
                  <span className="min-w-[3.5rem] text-center text-xs text-slate-400">
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
    </div>
  )
}
