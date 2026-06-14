import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Edit2, Eye, Plus, Trash2 } from 'lucide-react'
import { deleteIndustry, getIndustries } from '../../api/industries'
import Breadcrumb from '../../components/Breadcrumb'
import { confirmDelete, showError, showSuccess } from '../../utils/alerts'
import { usePermissions } from '../../hooks/usePermissions'

const CRUMBS = [
  { label: 'Inventory', to: '/inventory/products' },
  { label: 'Industries' },
]

export default function IndustriesPage() {
  const [page, setPage] = useState(1)
  const queryClient = useQueryClient()
  const { can } = usePermissions()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['industries', page],
    queryFn:  () => getIndustries(page),
    placeholderData: (prev) => prev,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteIndustry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['industries'] })
      showSuccess('Industry deleted.')
    },
    onError: () => showError('Failed to delete. The industry may be in use.'),
  })

  const handleDelete = async (id, name) => {
    const ok = await confirmDelete(name)
    if (ok) deleteMutation.mutate(id)
  }

  const meta = data?.meta
  const rows = data?.data ?? []

  return (
    <div className="w-full">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold leading-none text-slate-800">Industries</h1>
          <Breadcrumb crumbs={CRUMBS} />
        </div>
        {can('create_industries') && (
          <Link
            to="/inventory/industries/create"
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
          >
            <Plus size={14} strokeWidth={2.5} />
            New Industry
          </Link>
        )}
      </div>
      <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {isLoading && (
          <div className="flex items-center justify-center py-14 text-sm text-slate-400">Loading…</div>
        )}
        {isError && (
          <div className="flex items-center justify-center py-14 text-sm text-red-500">
            Failed to load industries.
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
                    <th className="w-28 px-3 py-2 font-semibold uppercase tracking-wider text-slate-500">Created</th>
                    <th className="w-20 px-3 py-2 text-right font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-400">
                        No industries yet.{' '}
                        {can('create_industries') && (
                          <Link to="/inventory/industries/create" className="font-medium text-indigo-600 hover:underline">
                            Create the first one.
                          </Link>
                        )}
                      </td>
                    </tr>
                  ) : (
                    rows.map((industry, i) => (
                      <tr key={industry.id} className="transition-colors hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-400">
                          {(page - 1) * (meta?.per_page ?? 25) + i + 1}
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-800">
                          <Link to={`/inventory/industries/${industry.id}`} className="hover:text-indigo-600 hover:underline">
                            {industry.name}
                          </Link>
                        </td>
                        <td className="max-w-xs px-3 py-2 text-slate-500">
                          {industry.description
                            ? <span className="truncate block" title={industry.description}>{industry.description}</span>
                            : <span className="italic text-slate-300">—</span>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-400">
                          {new Date(industry.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              to={`/inventory/industries/${industry.id}`}
                              title="View"
                              className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                            >
                              <Eye size={13} />
                            </Link>
                            {can('edit_industries') && (
                              <Link
                                to={`/inventory/industries/${industry.id}/edit`}
                                title="Edit"
                                className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                              >
                                <Edit2 size={13} />
                              </Link>
                            )}
                            {can('delete_industries') && (
                              <button
                                type="button"
                                title="Delete"
                                onClick={() => handleDelete(industry.id, industry.name)}
                                disabled={deleteMutation.isPending}
                                className="rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
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
