import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Edit2, Eye, Plus, Trash2 } from 'lucide-react'
import { deleteProduct, getProducts } from '../../api/products'
import Breadcrumb from '../../components/Breadcrumb'
import { confirmDelete, showError, showSuccess } from '../../utils/alerts'
import { usePermissions } from '../../hooks/usePermissions'

const CRUMBS = [
  { label: 'Inventory', to: '/inventory/products' },
  { label: 'Products' },
]

const TYPE_COLORS = {
  Product:      'bg-blue-50 text-blue-700',
  Service:      'bg-purple-50 text-purple-700',
  Bundle:       'bg-amber-50 text-amber-700',
  'Raw Material': 'bg-green-50 text-green-700',
}

const TRACKING_COLORS = {
  Batch:  'bg-slate-100 text-slate-600',
  Serial: 'bg-indigo-50 text-indigo-600',
}

export default function ProductsPage() {
  const [page, setPage] = useState(1)
  const queryClient = useQueryClient()
  const { can } = usePermissions()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['products', page],
    queryFn: () => getProducts(page),
    placeholderData: (prev) => prev,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      showSuccess('Product deleted.')
    },
    onError: () => showError('Failed to delete. The product may be in use.'),
  })

  const handleDelete = async (id, name) => {
    const ok = await confirmDelete(name)
    if (ok) deleteMutation.mutate(id)
  }

  const meta = data?.meta
  const rows = data?.data ?? []

  return (
    <div>
      <Breadcrumb crumbs={CRUMBS} />

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Products</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Manage your inventory product master list.
          </p>
        </div>
        {can('create_products') && (
          <Link
            to="/inventory/products/create"
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
          >
            <Plus size={15} strokeWidth={2.5} />
            New Product
          </Link>
        )}
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {isLoading && (
          <div className="flex items-center justify-center py-16 text-sm text-slate-400">
            Loading…
          </div>
        )}

        {isError && (
          <div className="flex items-center justify-center py-16 text-sm text-red-500">
            Failed to load products. Check that the backend is running.
          </div>
        )}

        {!isLoading && !isError && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left">
                    <th className="w-8 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500">#</th>
                    <th className="w-32 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Code</th>
                    <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Name</th>
                    <th className="w-36 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Display Name</th>
                    <th className="w-28 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Type</th>
                    <th className="w-32 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Category</th>
                    <th className="w-24 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Tracking</th>
                    <th className="w-24 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Created</th>
                    <th className="w-24 px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-14 text-center text-sm text-slate-400">
                        No products yet.{' '}
                        {can('create_products') && (
                          <Link
                            to="/inventory/products/create"
                            className="font-medium text-indigo-600 hover:underline"
                          >
                            Create the first one.
                          </Link>
                        )}
                      </td>
                    </tr>
                  ) : (
                    rows.map((prod, i) => (
                      <tr key={prod.id} className="transition-colors hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-400">
                          {(page - 1) * (meta?.per_page ?? 25) + i + 1}
                        </td>

                        <td className="px-3 py-2 font-mono text-xs text-slate-600">
                          {prod.product_code
                            ? <span className="rounded bg-slate-100 px-1.5 py-0.5">{prod.product_code}</span>
                            : <span className="italic text-slate-300">—</span>}
                        </td>

                        <td className="px-3 py-2">
                          <span className="font-medium text-slate-800">{prod.name}</span>
                          {prod.ean_13 && (
                            <span className="ml-2 text-xs text-slate-400">{prod.ean_13}</span>
                          )}
                        </td>

                        <td className="px-3 py-2">
                          {prod.display_name
                            ? <span title={prod.display_name} className="line-clamp-1 text-slate-600">{prod.display_name}</span>
                            : <span className="italic text-slate-300">—</span>}
                        </td>

                        <td className="px-3 py-2">
                          {prod.product_type ? (
                            <span className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${TYPE_COLORS[prod.product_type] ?? 'bg-slate-100 text-slate-600'}`}>
                              {prod.product_type}
                            </span>
                          ) : (
                            <span className="italic text-slate-300">—</span>
                          )}
                        </td>

                        <td className="px-3 py-2">
                          {prod.category
                            ? <span title={prod.category} className="line-clamp-1 text-slate-600">{prod.category}</span>
                            : <span className="italic text-slate-300">—</span>}
                        </td>

                        <td className="px-3 py-2">
                          {prod.tracking_type ? (
                            <span className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${TRACKING_COLORS[prod.tracking_type] ?? 'bg-slate-100 text-slate-600'}`}>
                              {prod.tracking_type}
                            </span>
                          ) : (
                            <span className="italic text-slate-300">—</span>
                          )}
                        </td>

                        <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-400">
                          {new Date(prod.created_at).toLocaleDateString()}
                        </td>

                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end gap-0.5">
                            <Link
                              to={`/inventory/products/${prod.id}`}
                              title="View"
                              className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                            >
                              <Eye size={14} />
                            </Link>
                            {can('edit_products') && (
                              <Link
                                to={`/inventory/products/${prod.id}/edit`}
                                title="Edit"
                                className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                              >
                                <Edit2 size={14} />
                              </Link>
                            )}
                            {can('delete_products') && (
                              <button
                                type="button"
                                title="Delete"
                                onClick={() => handleDelete(prod.id, prod.name)}
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

            {meta && meta.last_page > 1 && (
              <div className="flex items-center justify-between border-t border-slate-200 px-4 py-2.5">
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
