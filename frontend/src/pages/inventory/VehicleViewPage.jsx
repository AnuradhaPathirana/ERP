import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Edit2, Trash2 } from 'lucide-react'
import { deleteVehicle, getVehicle } from '../../api/vehicles'
import Breadcrumb from '../../components/Breadcrumb'

const STATUS_COLORS = {
  active:            'bg-green-50 text-green-700',
  inactive:          'bg-slate-100 text-slate-500',
  under_maintenance: 'bg-amber-50 text-amber-700',
}

const STATUS_LABELS = {
  active:            'Active',
  inactive:          'Inactive',
  under_maintenance: 'Under Maintenance',
}

function Row({ label, value, mono }) {
  const empty = value === null || value === undefined || value === ''
  return (
    <div className="flex items-start gap-2 py-1">
      <span className="w-44 shrink-0 text-xs text-slate-500">{label}</span>
      <span className={`text-xs ${mono ? 'font-mono text-slate-600' : 'text-slate-800'} ${empty ? 'italic text-slate-400' : ''}`}>
        {empty ? '—' : value}
      </span>
    </div>
  )
}

function SectionCard({ title, children }) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-100 bg-slate-50 px-3 py-1.5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</h2>
      </div>
      <div className="px-4 py-1">{children}</div>
    </section>
  )
}

function fmt(v) {
  return v !== null && v !== undefined && v !== '' ? v : null
}

function fmtDate(v) {
  if (!v) return null
  return new Date(v).toLocaleDateString()
}

function ExpiryValue({ date }) {
  if (!date) return null
  const expired = new Date(date) < new Date()
  return (
    <span className={expired ? 'font-semibold text-red-600' : ''}>
      {fmtDate(date)}{expired ? ' — Expired' : ''}
    </span>
  )
}

export default function VehicleViewPage() {
  const { id }      = useParams()
  const navigate    = useNavigate()
  const queryClient = useQueryClient()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['vehicle', id],
    queryFn:  () => getVehicle(id),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteVehicle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
      queryClient.invalidateQueries({ queryKey: ['vehicles-all'] })
      navigate('/inventory/vehicles')
    },
  })

  const crumbs = [
    { label: 'Inventory', to: '/inventory/products' },
    { label: 'Vehicles',  to: '/inventory/vehicles' },
    { label: 'View Vehicle' },
  ]

  if (isLoading) return <div className="flex items-center justify-center py-14 text-sm text-slate-400">Loading…</div>
  if (isError)   return <div className="flex items-center justify-center py-14 text-sm text-red-500">Failed to load vehicle.</div>

  const v = data?.data

  const handleDelete = () => {
    const label = v?.vehicle_code ?? v?.registration_number
    if (window.confirm(`Delete vehicle "${label}"? This cannot be undone.`)) {
      deleteMutation.mutate()
    }
  }

  const statusLabel = STATUS_LABELS[v?.status] ?? v?.status

  return (
    <div className="w-full">
      <Breadcrumb crumbs={crumbs} />

      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">
            {[v?.make, v?.model].filter(Boolean).join(' ') || v?.registration_number}
          </h1>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            {v?.vehicle_code && <span className="font-mono">{v.vehicle_code}</span>}
            {v?.registration_number && <span className="font-mono font-medium text-slate-700">{v.registration_number}</span>}
            {v?.year && <span>{v.year}</span>}
            {v?.status && (
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLORS[v.status] ?? 'bg-slate-100 text-slate-600'}`}>
                {statusLabel}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Link
            to={`/inventory/vehicles/${id}/edit`}
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

      <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">

        {/* ── LEFT ── */}
        <div className="space-y-2.5">

          <SectionCard title="Identity">
            <div className="divide-y divide-slate-50">
              <Row label="Vehicle Code"        value={fmt(v?.vehicle_code)} mono />
              <Row label="Registration Number" value={fmt(v?.registration_number)} mono />
            </div>
          </SectionCard>

          <SectionCard title="Specifications">
            <div className="divide-y divide-slate-50">
              <Row label="Make"             value={fmt(v?.make)} />
              <Row label="Model"            value={fmt(v?.model)} />
              <Row label="Year"             value={fmt(v?.year)} />
              <Row label="Color"            value={fmt(v?.color)} />
              <Row label="Vehicle Type"     value={fmt(v?.vehicle_type)} />
              <Row label="Fuel Type"        value={fmt(v?.fuel_type)} />
            </div>
          </SectionCard>

          <SectionCard title="Engine & Chassis">
            <div className="divide-y divide-slate-50">
              <Row label="Engine Number"    value={fmt(v?.engine_number)} mono />
              <Row label="Chassis Number"   value={fmt(v?.chassis_number)} mono />
              <Row label="Seating Capacity" value={fmt(v?.seating_capacity)} />
              <Row label="Payload (tonnes)" value={v?.payload_capacity != null ? `${v.payload_capacity} t` : null} />
            </div>
          </SectionCard>

        </div>

        {/* ── RIGHT ── */}
        <div className="space-y-2.5">

          <SectionCard title="Driver Assignment">
            <div className="divide-y divide-slate-50">
              {v?.assigned_driver ? (
                <>
                  <Row label="Driver Name" value={v.assigned_driver.name} />
                  <Row label="Driver Code" value={v.assigned_driver.driver_code} mono />
                </>
              ) : (
                <Row label="Assigned Driver" value={null} />
              )}
            </div>
          </SectionCard>

          <SectionCard title="Compliance & Insurance">
            <div className="divide-y divide-slate-50">
              <Row label="Insurance Policy No." value={fmt(v?.insurance_policy_no)} mono />
              <Row
                label="Insurance Expiry"
                value={v?.insurance_expiry_date ? <ExpiryValue date={v.insurance_expiry_date} /> : null}
              />
              <Row
                label="Road Tax Expiry"
                value={v?.road_tax_expiry_date ? <ExpiryValue date={v.road_tax_expiry_date} /> : null}
              />
              <Row
                label="Emission Test Expiry"
                value={v?.emission_test_expiry_date ? <ExpiryValue date={v.emission_test_expiry_date} /> : null}
              />
            </div>
          </SectionCard>

          <SectionCard title="Status & Notes">
            <div className="divide-y divide-slate-50">
              <Row label="Status" value={statusLabel} />
              <Row label="Notes"  value={fmt(v?.notes)} />
            </div>
          </SectionCard>

          <SectionCard title="Record Info">
            <div className="divide-y divide-slate-50">
              <Row label="Created At" value={v?.created_at ? new Date(v.created_at).toLocaleString() : null} />
              <Row label="Updated At" value={v?.updated_at ? new Date(v.updated_at).toLocaleString() : null} />
            </div>
          </SectionCard>

        </div>
      </div>

      <div className="mt-3">
        <Link to="/inventory/vehicles" className="text-xs font-medium text-slate-500 hover:text-slate-800">
          ← Back to Vehicles
        </Link>
      </div>
    </div>
  )
}
