import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Edit2, Plus, Trash2 } from 'lucide-react'
import { deleteAttributeType, getAttributeTypes } from '../../api/attributeTypes'
import Breadcrumb from '../../components/Breadcrumb'

const CRUMBS = [
  { label: 'Inventory', to: '/inventory/attribute-types' },
  { label: 'Attribute Types' },
]

const TYPE_BADGE = {
  product: 'bg-blue-50 text-blue-700',
  service: 'bg-violet-50 text-violet-700',
}

export default function AttributeTypesPage() {
  const [page, setPage] = useState(1)
  const queryClient = useQueryClient()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['attribute-types', page],
    queryFn: () => getAttributeTypes(page),
    placeholderData: (prev) => prev,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteAttributeType,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attribute-types'] }),
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
          <h1 className="text-xl font-bold text-slate-800">Attribute Types</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Define groupings of attributes linked to product categories (e.g. Color, Size).
          </p>
        </div>
        <Link
          to="/inventory/attribute-types/create"
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
        >
          <Plus size={15} strokeWidth={2.5} />
          New Attribute Type
        </Link>
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {isLoading && (
          <div className="flex items-center justify-center py-16 text-sm text-slate-400">Loading…</div>
        )}
        {isError && (
          <div className="flex items-center justify-center py-16 text-sm text-red-500">
            Failed to load attribute types. Check that the backend is running.
          </div>
        )}

        {!isLoading && !isError && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left">
                    <th className="w-10 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">#</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Name</th>
                    <th className="w-36 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Type</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Category</th>
                    <th className="w-80 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Description</th>
                    <th className="w-24 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Attributes</th>
                    <th className="w-32 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Created</th>
                    <th className="w-20 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-14 text-center text-sm text-slate-400">
                        No attribute types yet.{' '}
                        <Link
                          to="/inventory/attribute-types/create"
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
                          {row.attribute_type_name}
                        </td>

                        <td className="px-4 py-2.5">
                          <span
                            className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold capitalize ${TYPE_BADGE[row.product_service_type] ?? 'bg-slate-100 text-slate-600'}`}
                          >
                            {row.product_service_type}
                          </span>
                        </td>

                        <td className="px-4 py-2.5 text-slate-600">
                          {row.category_name ?? <span className="italic text-slate-300">—</span>}
                        </td>

                        <td className="max-w-xs px-4 py-2.5">
                          {row.description ? (
                            <span title={row.description} className="line-clamp-1 text-slate-500">
                              {row.description}
                            </span>
                          ) : (
                            <span className="italic text-slate-300">—</span>
                          )}
                        </td>

                        <td className="px-4 py-2.5 text-center text-slate-600">
                          {row.attributes_count ?? 0}
                        </td>

                        <td className="whitespace-nowrap px-4 py-2.5 text-slate-400">
                          {new Date(row.created_at).toLocaleDateString()}
                        </td>

                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              to={`/inventory/attribute-types/${row.id}/edit`}
                              title="Edit"
                              className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                            >
                              <Edit2 size={14} />
                            </Link>
                            <button
                              type="button"
                              title="Delete"
                              onClick={() => handleDelete(row.id, row.attribute_type_name)}
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
