import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Edit2, Eye, Plus, Search, Trash2 } from 'lucide-react'
import { deleteCustomer, getCustomers } from '../../api/customers'
import Breadcrumb from '../../components/Breadcrumb'
import { confirmDelete, showError, showSuccess } from '../../utils/alerts'
import { usePermissions } from '../../hooks/usePermissions'

const CRUMBS = [
  { label: 'Inventory', to: '/inventory/products' },
  { label: 'Customers' },
]

const TYPE_COLORS = {
  Trade:     'bg-blue-50 text-blue-700',
  Retail:    'bg-green-50 text-green-700',
  Wholesale: 'bg-amber-50 text-amber-700',
  Corporate: 'bg-indigo-50 text-indigo-700',
}

export default function CustomersPage() {
  const [page, setPage]     = useState(1)
  const [search, setSearch] = useState('')
  const [q, setQ]           = useState('')
  const queryClient         = useQueryClient()
  const { can }             = usePermissions()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['customers', page, q],
    queryFn:  () => getCustomers(page, q),
    placeholderData: (prev) => prev,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      showSuccess('Customer deleted.')
    },
    onError: () => showError('Failed to delete. The customer may be in use.'),
  })

  const handleSearch = (e) => {
    e.preventDefault()
    setQ(search.trim())
    setPage(1)
  }

  const handleDelete = async (id, name) => {
    const ok = await confirmDelete(name)
    if (ok) deleteMutation.mutate(id)
  }

  const meta = data?.meta
  const rows = data?.data ?? []

  return (
    <div className="w-full">
      <Breadcrumb crumbs={CRUMBS} />

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Customers</h1>
          <p className="mt-0.5 text-sm text-slate-500">Manage your customer master records.</p>
        </div>
        {can('create_customer_masters') && (
          <Link
            to="/inventory/customers/create"
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
          >
            <Plus size={14} strokeWidth={2.5} />
            New Customer
          </Link>
        )}
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="mt-3 flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, code or email…"
            className="w-full rounded border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
        <button
          type="submit"
          className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Search
        </button>
        {q && (
          <button
            type="button"
            onClick={() => { setQ(''); setSearch(''); setPage(1) }}
            className="text-xs text-slate-400 hover:text-slate-700"
          >
            Clear
          </button>
        )}
      </form>

      <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {isLoading && (
          <div className="flex items-center justify-center py-14 text-sm text-slate-400">Loading…</div>
        )}
        {isError && (
          <div className="flex items-center justify-center py-14 text-sm text-red-500">
            Failed to load customers.
          </div>
        )}

        {!isLoading && !isError && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left">
                    <th className="w-8 px-3 py-2 font-semibold uppercase tracking-wider text-slate-500">#</th>
                    <th className="w-24 px-3 py-2 font-semibold uppercase tracking-wider text-slate-500">Code</th>
                    <th className="px-3 py-2 font-semibold uppercase tracking-wider text-slate-500">Customer Name</th>
                    <th className="w-24 px-3 py-2 font-semibold uppercase tracking-wider text-slate-500">Type</th>
                    <th className="w-32 px-3 py-2 font-semibold uppercase tracking-wider text-slate-500">Mobile</th>
                    <th className="w-44 px-3 py-2 font-semibold uppercase tracking-wider text-slate-500">Email</th>
                    <th className="w-24 px-3 py-2 font-semibold uppercase tracking-wider text-slate-500">Created</th>
                    <th className="w-20 px-3 py-2 text-right font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-400">
                        {q ? `No customers found for "${q}".` : 'No customers yet.'}{' '}
                        {!q && can('create_customer_masters') && (
                          <Link to="/inventory/customers/create" className="font-medium text-indigo-600 hover:underline">
                            Add the first one.
                          </Link>
                        )}
                      </td>
                    </tr>
                  ) : (
                    rows.map((c, i) => (
                      <tr key={c.id} className="transition-colors hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-400">
                          {(page - 1) * (meta?.per_page ?? 25) + i + 1}
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-500">
                          {c.customer_code ?? <span className="italic text-slate-300">—</span>}
                        </td>
                        <td className="max-w-[220px] px-3 py-2 font-medium text-slate-800">
                          <Link
                            to={`/inventory/customers/${c.id}`}
                            className="truncate hover:text-indigo-600 hover:underline"
                          >
                            {c.title ? `${c.title} ` : ''}{c.customer_name}
                          </Link>
                        </td>
                        <td className="px-3 py-2">
                          {c.customer_type ? (
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${TYPE_COLORS[c.customer_type] ?? 'bg-slate-100 text-slate-600'}`}>
                              {c.customer_type}
                            </span>
                          ) : <span className="italic text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-2 text-slate-500">
                          {c.customer_mobile ?? <span className="italic text-slate-300">—</span>}
                        </td>
                        <td className="max-w-[176px] truncate px-3 py-2 text-slate-500">
                          {c.customer_email ?? <span className="italic text-slate-300">—</span>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-400">
                          {new Date(c.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              to={`/inventory/customers/${c.id}`}
                              title="View"
                              className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                            >
                              <Eye size={13} />
                            </Link>
                            {can('edit_customer_masters') && (
                              <Link
                                to={`/inventory/customers/${c.id}/edit`}
                                title="Edit"
                                className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                              >
                                <Edit2 size={13} />
                              </Link>
                            )}
                            {can('delete_customer_masters') && (
                              <button
                                type="button"
                                title="Delete"
                                onClick={() => handleDelete(c.id, c.customer_name)}
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
