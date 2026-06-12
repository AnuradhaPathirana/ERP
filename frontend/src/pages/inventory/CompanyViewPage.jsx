import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Edit2, Trash2 } from 'lucide-react'
import { deleteCompany, getCompany } from '../../api/companies'
import Breadcrumb from '../../components/Breadcrumb'

function Row({ label, value }) {
  const empty = value === null || value === undefined || value === ''
  return (
    <div className="flex items-start gap-2 py-1">
      <span className="w-40 shrink-0 text-xs text-slate-500">{label}</span>
      <span className={`text-xs text-slate-800 ${empty ? 'italic text-slate-400' : ''}`}>
        {empty ? '—' : value}
      </span>
    </div>
  )
}

function SectionHeader({ title }) {
  return (
    <div className="border-b border-slate-100 bg-slate-50 px-3 py-1.5">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</h2>
    </div>
  )
}

export default function CompanyViewPage() {
  const { id }      = useParams()
  const navigate    = useNavigate()
  const queryClient = useQueryClient()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['company', id],
    queryFn:  () => getCompany(id),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteCompany(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] })
      navigate('/inventory/companies')
    },
  })

  const crumbs = [
    { label: 'Inventory',  to: '/inventory/products' },
    { label: 'Companies',  to: '/inventory/companies' },
    { label: 'View Company' },
  ]

  if (isLoading) return <div className="flex items-center justify-center py-14 text-sm text-slate-400">Loading…</div>
  if (isError)   return <div className="flex items-center justify-center py-14 text-sm text-red-500">Failed to load company.</div>

  const company = data?.data

  const handleDelete = () => {
    if (window.confirm(`Delete "${company?.company_name}"? This cannot be undone.`)) {
      deleteMutation.mutate()
    }
  }

  return (
    <div className="w-full">
      <Breadcrumb crumbs={crumbs} />

      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{company?.company_name}</h1>
          {company?.company_type && (
            <span className="mt-0.5 inline-block rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
              {company.company_type}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Link
            to={`/inventory/companies/${id}/edit`}
            className="flex items-center gap-1.5 rounded border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <Edit2 size={12} />
            Edit
          </Link>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="flex items-center gap-1.5 rounded border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 size={12} />
            Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">

        {/* Left */}
        <div className="space-y-3">

          {/* Basic Information */}
          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <SectionHeader title="Basic Information" />
            <div className="divide-y divide-slate-50 px-4 py-1">
              <Row label="Company Name"     value={company?.company_name} />
              <Row label="Company Type"     value={company?.company_type} />
              <Row label="Industry"         value={company?.industry?.name} />
              <Row label="Registration No." value={company?.registration_no} />
              <Row label="Tax Reg. No."     value={company?.tax_reg_no} />
            </div>
          </section>

          {/* Contact */}
          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <SectionHeader title="Contact Details" />
            <div className="divide-y divide-slate-50 px-4 py-1">
              <Row label="Email"  value={company?.company_email} />
              <Row label="Mobile" value={company?.company_mobile} />
            </div>
          </section>

        </div>

        {/* Right */}
        <div className="space-y-3">

          {/* Address */}
          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <SectionHeader title="Address" />
            <div className="divide-y divide-slate-50 px-4 py-1">
              <Row label="Street Address"   value={company?.street_address} />
              <Row label="City"             value={company?.city} />
              <Row label="State / Province" value={company?.state} />
              <Row label="Country"          value={company?.country} />
              <Row label="Postal / Zip"     value={company?.postal_zip_code} />
            </div>
          </section>

          {/* Record Info */}
          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <SectionHeader title="Record Info" />
            <div className="divide-y divide-slate-50 px-4 py-1">
              <Row
                label="Created At"
                value={company?.created_at ? new Date(company.created_at).toLocaleString() : null}
              />
              <Row
                label="Updated At"
                value={company?.updated_at ? new Date(company.updated_at).toLocaleString() : null}
              />
            </div>
          </section>

        </div>

      </div>

      <div className="mt-3">
        <Link to="/inventory/companies" className="text-xs font-medium text-slate-500 hover:text-slate-800">
          ← Back to Companies
        </Link>
      </div>
    </div>
  )
}
