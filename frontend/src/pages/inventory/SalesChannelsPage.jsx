import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Edit2, Eye, Plus, Trash2 } from 'lucide-react'
import { deleteSalesChannel, getSalesChannels } from '../../api/salesChannels'
import Breadcrumb from '../../components/Breadcrumb'

const CRUMBS = [
  { label: 'Inventory', to: '/inventory/products' },
  { label: 'Sales Channels' },
]

const TYPE_BADGE = {
  'Wholesale':  { cls: 'bg-violet-50 text-violet-700' },
  'e-commerce': { cls: 'bg-sky-50 text-sky-700' },
  'Retail':     { cls: 'bg-emerald-50 text-emerald-700' },
}

const STATUS_BADGE = {
  'Active':   { cls: 'bg-green-50 text-green-700' },
  'Inactive': { cls: 'bg-slate-100 text-slate-500' },
}

export default function SalesChannelsPage() {
  const [page, setPage] = useState(1)
  const queryClient = useQueryClient()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['sales-channels', page],
    queryFn:  () => getSalesChannels(page),
    placeholderData: (prev) => prev,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteSalesChannel,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sales-channels'] }),
  })

  const handleDelete = (id, name) => {
    if (window.confirm(`Delete sales channel "${name}"? This cannot be undone.`)) {
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
          <h1 className="text-xl font-bold text-slate-800">Sales Channels</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Manage wholesale, retail, and e-commerce pricing channels.
          </p>
        </div>
        <Link
          to="/inventory/sales-channels/create"
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
        >
          <Plus size={14} strokeWidth={2.5} />
          New Channel
        </Link>
      </div>

      <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {isLoading && (
          <div className="flex items-center justify-center py-14 text-sm text-slate-400">Loading…</div>
        )}
        {isError && (
          <div className="flex items-center justify-center py-14 text-sm text-red-500">
            Failed to load sales channels.
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
                    <th className="w-28 px-3 py-2 font-semibold uppercase tracking-wider text-slate-500">Type</th>
                    <th className="w-24 px-3 py-2 font-semibold uppercase tracking-wider text-slate-500 text-right">Max Qty</th>
                    <th className="w-28 px-3 py-2 font-semibold uppercase tracking-wider text-slate-500">From</th>
                    <th className="w-28 px-3 py-2 font-semibold uppercase tracking-wider text-slate-500">To</th>
                    <th className="w-20 px-3 py-2 font-semibold uppercase tracking-wider text-slate-500">Status</th>
                    <th className="w-24 px-3 py-2 font-semibold uppercase tracking-wider text-slate-500">Created</th>
                    <th className="w-20 px-3 py-2 text-right font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-400">
                        No sales channels yet.{' '}
                        <Link to="/inventory/sales-channels/create" className="font-medium text-indigo-600 hover:underline">
                          Create the first one.
                        </Link>
                      </td>
                    </tr>
                  ) : (
                    rows.map((c, i) => {
                      const typeBadge   = TYPE_BADGE[c.type]   ?? { cls: 'bg-slate-100 text-slate-500' }
                      const statusBadge = STATUS_BADGE[c.status] ?? { cls: 'bg-slate-100 text-slate-400' }
                      return (
                        <tr key={c.id} className="transition-colors hover:bg-slate-50">
                          <td className="px-3 py-2 text-slate-400">
                            {(page - 1) * (meta?.per_page ?? 25) + i + 1}
                          </td>
                          <td className="px-3 py-2 font-medium text-slate-800">
                            <Link to={`/inventory/sales-channels/${c.id}`} className="hover:text-indigo-600 hover:underline">
                              {c.sales_channel_name}
                            </Link>
                          </td>
                          <td className="px-3 py-2">
                            {c.type ? (
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${typeBadge.cls}`}>
                                {c.type}
                              </span>
                            ) : <span className="italic text-slate-300">—</span>}
                          </td>
                          <td className="px-3 py-2 text-right text-slate-600">
                            {c.max_qty != null ? Number(c.max_qty).toLocaleString() : <span className="italic text-slate-300">—</span>}
                          </td>
                          <td className="px-3 py-2 text-slate-500">
                            {c.applicable_from ?? <span className="italic text-slate-300">—</span>}
                          </td>
                          <td className="px-3 py-2 text-slate-500">
                            {c.applicable_to ?? <span className="italic text-slate-300">—</span>}
                          </td>
                          <td className="px-3 py-2">
                            {c.status ? (
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusBadge.cls}`}>
                                {c.status}
                              </span>
                            ) : <span className="italic text-slate-300">—</span>}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-slate-400">
                            {new Date(c.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-end gap-1">
                              <Link
                                to={`/inventory/sales-channels/${c.id}`}
                                title="View"
                                className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                              >
                                <Eye size={13} />
                              </Link>
                              <Link
                                to={`/inventory/sales-channels/${c.id}/edit`}
                                title="Edit"
                                className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                              >
                                <Edit2 size={13} />
                              </Link>
                              <button
                                type="button"
                                title="Delete"
                                onClick={() => handleDelete(c.id, c.sales_channel_name)}
                                disabled={deleteMutation.isPending}
                                className="rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                              >
                                <Trash2 size={13} />
                              </button>
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
