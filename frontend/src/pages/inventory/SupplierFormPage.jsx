import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Save } from 'lucide-react'
import { checkSupplierCode, createSupplier, getSupplier, updateSupplier } from '../../api/suppliers'
import Breadcrumb from '../../components/Breadcrumb'
import { showError, showSuccess } from '../../utils/alerts'

function generateSupplierCode() {
  const num = Math.floor(Math.random() * 9999) + 1
  return `SUP-${String(num).padStart(4, '0')}`
}

const SUPPLIER_TYPES = ['Local', 'Foreign', 'Service', 'Manufacturer', 'Distributor', 'Other']

const EMPTY_FORM = {
  supplier_code:    '',
  reference_no:     '',
  supplier_type:    '',
  supplier_name:    '',
  check_writer_name:'',
  mobile:           '',
  land_line:        '',
  email:            '',
  fax:              '',
  website:          '',
  bil_address_line_1: '',
  bil_address_line_2: '',
  bil_address_line_3: '',
  bil_city:           '',
  bil_postal_code:    '',
  bil_state_province: '',
  bil_country:        '',
  tax_type:    '',
  tax_no:      '',
  tax_regis_no:'',
  credit_limit:        '',
  credit_period:       '',
  privileges_discount: '',
  bank_name:            '',
  bank_branch:          '',
  bank_acc_holder_name: '',
  bank_acc_no:          '',
  contact_person_name:        '',
  contact_person_designation: '',
  contact_person_mobile:      '',
  contact_person_email:       '',
  contact_person_fax:         '',
}

const REQUIRED_FIELDS = new Set([
  'supplier_code', 'supplier_type', 'supplier_name',
  'check_writer_name', 'mobile', 'land_line', 'email',
  'bil_address_line_1',
  'contact_person_name', 'contact_person_mobile',
])

function validate(field, value) {
  const v = typeof value === 'string' ? value.trim() : value
  if (REQUIRED_FIELDS.has(field) && !v) {
    const labels = {
      supplier_code:          'Supplier code',
      supplier_type:          'Supplier type',
      supplier_name:          'Supplier name',
      check_writer_name:      'Check writer name',
      mobile:                 'Mobile',
      land_line:              'Land line',
      email:                  'Email',
      bil_address_line_1:     'Address line 1',
      contact_person_name:    'Contact person name',
      contact_person_mobile:  'Contact person mobile',
    }
    return `${labels[field]} is required.`
  }
  switch (field) {
    case 'supplier_code':
      if (v && String(v).length > 50) return 'Max 50 characters.'
      break
    case 'supplier_name':
      if (v && String(v).length > 100) return 'Max 100 characters.'
      break
    case 'email':
      if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Enter a valid email.'
      break
    case 'contact_person_email':
      if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Enter a valid email.'
      break
    case 'website':
      if (v && !/^https?:\/\/.+/.test(v)) return 'Must start with http:// or https://'
      break
    case 'credit_limit':
      if (v !== '' && v !== null && (isNaN(Number(v)) || Number(v) < 0)) return 'Must be ≥ 0.'
      break
    case 'credit_period':
      if (v !== '' && v !== null && (!Number.isInteger(Number(v)) || Number(v) < 0)) return 'Whole number ≥ 0.'
      break
    case 'privileges_discount':
      if (v !== '' && v !== null && (isNaN(Number(v)) || Number(v) < 0 || Number(v) > 100)) return '0–100.'
      break
  }
  return ''
}

const inputBase =
  'block w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 placeholder-slate-300 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20'
const inputErr =
  'block w-full rounded border border-red-400 bg-white px-2 py-1 text-xs text-slate-800 placeholder-slate-300 outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-500/20'

function fieldCls(errors, touched, name) {
  return errors[name] && touched[name] ? inputErr : inputBase
}

function Label({ children, required }) {
  return (
    <label className="mb-0.5 block text-xs font-medium text-slate-600">
      {children}{required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
  )
}

function FieldError({ errors, touched, name }) {
  if (!errors[name] || !touched[name]) return null
  return <p className="mt-0.5 text-[11px] text-red-600">{errors[name]}</p>
}

function SectionCard({ title, children }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-100 bg-slate-50 px-3 py-1.5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</h2>
      </div>
      <div className="space-y-2 p-3">{children}</div>
    </div>
  )
}

export default function SupplierFormPage() {
  const { id }      = useParams()
  const isEditing   = Boolean(id)
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const nameRef     = useRef(null)

  const [form,       setForm]       = useState(() => ({
    ...EMPTY_FORM,
    supplier_code: isEditing ? '' : generateSupplierCode(),
  }))
  const [errors,     setErrors]     = useState({})
  const [touched,    setTouched]    = useState({})
  // 'idle' | 'checking' | 'available' | 'taken'
  const [codeStatus, setCodeStatus] = useState('idle')

  const { isLoading: isFetching, data: fetchedData } = useQuery({
    queryKey: ['supplier', id],
    queryFn:  () => getSupplier(id),
    enabled:  isEditing,
  })

  const initialized = useRef(false)
  useLayoutEffect(() => {
    if (fetchedData?.data && !initialized.current) {
      const s = fetchedData.data
      setForm(
        Object.fromEntries(
          Object.keys(EMPTY_FORM).map((k) => [k, s[k] != null ? String(s[k]) : ''])
        )
      )
      initialized.current = true
    }
  }, [fetchedData])

  useEffect(() => { nameRef.current?.focus() }, [])

  // Auto-check the generated code on create mount
  useEffect(() => {
    if (!isEditing && form.supplier_code) runCodeCheck(form.supplier_code, null)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const runCodeCheck = (code, excludeId) => {
    if (!code.trim()) { setCodeStatus('idle'); return }
    setCodeStatus('checking')
    checkSupplierCode(code.trim(), excludeId)
      .then((res) => setCodeStatus(res.available ? 'available' : 'taken'))
      .catch(() => setCodeStatus('idle'))
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (name === 'supplier_code') setCodeStatus('idle')
    if (touched[name]) setErrors((prev) => ({ ...prev, [name]: validate(name, value) }))
  }

  const handleBlur = (e) => {
    const { name, value } = e.target
    setTouched((prev) => ({ ...prev, [name]: true }))
    setErrors((prev) => ({ ...prev, [name]: validate(name, value) }))
    if (name === 'supplier_code' && value.trim()) {
      runCodeCheck(value, isEditing ? id : null)
    }
  }

  const mutation = useMutation({
    mutationFn: (payload) =>
      isEditing ? updateSupplier(id, payload) : createSupplier(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      queryClient.invalidateQueries({ queryKey: ['suppliers-all'] })
      if (isEditing) queryClient.invalidateQueries({ queryKey: ['supplier', id] })
      showSuccess(isEditing ? 'Supplier updated successfully.' : 'Supplier created successfully.')
      navigate('/inventory/suppliers')
    },
    onError: (err) => {
      const apiErrors = err.response?.data?.errors ?? {}
      if (Object.keys(apiErrors).length) {
        setErrors(Object.fromEntries(Object.entries(apiErrors).map(([k, v]) => [k, v[0]])))
        setTouched(Object.fromEntries(Object.keys(apiErrors).map((k) => [k, true])))
      }
      showError('Failed to save. Please check the form and try again.')
    },
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    const fields = Object.keys(EMPTY_FORM)
    const newErrors = Object.fromEntries(fields.map((f) => [f, validate(f, form[f])]))
    setErrors(newErrors)
    setTouched(Object.fromEntries(fields.map((f) => [f, true])))
    if (Object.values(newErrors).some(Boolean)) return
    if (codeStatus === 'taken') return

    const str = (v) => (v.trim() === '' ? null : v.trim())
    const num = (v) => (v === '' ? null : Number(v))
    const int = (v) => (v === '' ? null : parseInt(v, 10))

    mutation.mutate({
      supplier_name:    form.supplier_name.trim(),
      supplier_code:    str(form.supplier_code),
      reference_no:     str(form.reference_no),
      supplier_type:    str(form.supplier_type),
      check_writer_name: str(form.check_writer_name),
      mobile:           str(form.mobile),
      land_line:        str(form.land_line),
      email:            str(form.email),
      fax:              str(form.fax),
      website:          str(form.website),
      bil_address_line_1: str(form.bil_address_line_1),
      bil_address_line_2: str(form.bil_address_line_2),
      bil_address_line_3: str(form.bil_address_line_3),
      bil_city:           str(form.bil_city),
      bil_postal_code:    str(form.bil_postal_code),
      bil_state_province: str(form.bil_state_province),
      bil_country:        str(form.bil_country),
      tax_type:    str(form.tax_type),
      tax_no:      str(form.tax_no),
      tax_regis_no: str(form.tax_regis_no),
      credit_limit:        num(form.credit_limit),
      credit_period:       int(form.credit_period),
      privileges_discount: num(form.privileges_discount),
      bank_name:            str(form.bank_name),
      bank_branch:          str(form.bank_branch),
      bank_acc_holder_name: str(form.bank_acc_holder_name),
      bank_acc_no:          str(form.bank_acc_no),
      contact_person_name:        str(form.contact_person_name),
      contact_person_designation: str(form.contact_person_designation),
      contact_person_mobile:      str(form.contact_person_mobile),
      contact_person_email:       str(form.contact_person_email),
      contact_person_fax:         str(form.contact_person_fax),
    })
  }

  const crumbs = [
    { label: 'Inventory',  to: '/inventory/products' },
    { label: 'Suppliers',  to: '/inventory/suppliers' },
    { label: isEditing ? 'Edit Supplier' : 'New Supplier' },
  ]

  if (isEditing && isFetching) {
    return <div className="flex items-center justify-center py-14 text-sm text-slate-400">Loading…</div>
  }

  const inp = (name, extra = {}) => ({
    name, value: form[name],
    onChange: handleChange, onBlur: handleBlur,
    className: fieldCls(errors, touched, name),
    autoComplete: 'off', ...extra,
  })

  return (
    <div className="w-full">
      <Breadcrumb crumbs={crumbs} />

      <div className="mb-2">
        <h1 className="text-xl font-bold text-slate-800">
          {isEditing ? 'Edit Supplier' : 'New Supplier'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        {/* ── 2-column section grid ──────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">

          {/* ── LEFT column ─────────────────────────────────────────── */}
          <div className="space-y-2.5">

            {/* General */}
            <SectionCard title="General">
              <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                <div>
                  <Label required>Supplier Code</Label>
                  <div className="flex items-center gap-1">
                    <input type="text" placeholder="SUP-0001" maxLength={50} {...inp('supplier_code')} />
                    {!isEditing && (
                      <button
                        type="button"
                        title="Generate new code"
                        onClick={() => {
                          const code = generateSupplierCode()
                          setForm((prev) => ({ ...prev, supplier_code: code }))
                          setErrors((prev) => ({ ...prev, supplier_code: '' }))
                          setCodeStatus('idle')
                          runCodeCheck(code, null)
                        }}
                        className="shrink-0 rounded border border-slate-300 bg-white p-1 text-slate-500 transition hover:border-indigo-400 hover:text-indigo-600"
                      >
                        <RefreshCw size={12} strokeWidth={2.5} />
                      </button>
                    )}
                  </div>
                  {codeStatus === 'checking' && (
                    <p className="mt-0.5 text-[11px] text-slate-400">Checking…</p>
                  )}
                  {codeStatus === 'available' && (
                    <p className="mt-0.5 text-[11px] text-emerald-600">Code is available.</p>
                  )}
                  {codeStatus === 'taken' && (
                    <p className="mt-0.5 text-[11px] text-red-600">Code already in use.</p>
                  )}
                  <FieldError errors={errors} touched={touched} name="supplier_code" />
                </div>
                <div>
                  <Label>Reference No.</Label>
                  <input type="text" placeholder="REF-001" maxLength={50} {...inp('reference_no')} />
                  <FieldError errors={errors} touched={touched} name="reference_no" />
                </div>
                <div>
                  <Label required>Type</Label>
                  <select {...inp('supplier_type')}>
                    <option value="">— Select —</option>
                    {SUPPLIER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <FieldError errors={errors} touched={touched} name="supplier_type" />
                </div>
                <div>
                  <Label required>Supplier Name</Label>
                  <input ref={nameRef} type="text" placeholder="Full supplier name" maxLength={100} {...inp('supplier_name')} />
                  <FieldError errors={errors} touched={touched} name="supplier_name" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label required>Check Writer Name</Label>
                  <input type="text" placeholder="Name on cheques" maxLength={100} {...inp('check_writer_name')} />
                  <FieldError errors={errors} touched={touched} name="check_writer_name" />
                </div>
              </div>
            </SectionCard>

            {/* Contact */}
            <SectionCard title="Contact">
              <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                <div>
                  <Label required>Mobile</Label>
                  <input type="tel" placeholder="+1 234 567 8900" maxLength={20} {...inp('mobile')} />
                  <FieldError errors={errors} touched={touched} name="mobile" />
                </div>
                <div>
                  <Label required>Land Line</Label>
                  <input type="tel" placeholder="+1 234 567 8900" maxLength={20} {...inp('land_line')} />
                  <FieldError errors={errors} touched={touched} name="land_line" />
                </div>
                <div>
                  <Label required>Email</Label>
                  <input type="email" placeholder="supplier@example.com" maxLength={100} {...inp('email')} />
                  <FieldError errors={errors} touched={touched} name="email" />
                </div>
                <div>
                  <Label>Fax</Label>
                  <input type="tel" placeholder="+1 234 567 8900" maxLength={20} {...inp('fax')} />
                  <FieldError errors={errors} touched={touched} name="fax" />
                </div>
              </div>
              <div>
                <Label>Website</Label>
                <input type="url" placeholder="https://supplier.com" maxLength={255} {...inp('website')} />
                <FieldError errors={errors} touched={touched} name="website" />
              </div>
            </SectionCard>

            {/* Billing Address */}
            <SectionCard title="Billing Address">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label required>Address Line 1</Label>
                  <input type="text" placeholder="Street / building" maxLength={100} {...inp('bil_address_line_1')} />
                  <FieldError errors={errors} touched={touched} name="bil_address_line_1" />
                </div>
                <div>
                  <Label>Address Line 2</Label>
                  <input type="text" placeholder="Suite / floor" maxLength={100} {...inp('bil_address_line_2')} />
                  <FieldError errors={errors} touched={touched} name="bil_address_line_2" />
                </div>
                <div>
                  <Label>Address Line 3</Label>
                  <input type="text" maxLength={100} {...inp('bil_address_line_3')} />
                  <FieldError errors={errors} touched={touched} name="bil_address_line_3" />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <Label>City</Label>
                  <input type="text" placeholder="City" maxLength={50} {...inp('bil_city')} />
                  <FieldError errors={errors} touched={touched} name="bil_city" />
                </div>
                <div>
                  <Label>Postal Code</Label>
                  <input type="text" placeholder="10001" maxLength={20} {...inp('bil_postal_code')} />
                  <FieldError errors={errors} touched={touched} name="bil_postal_code" />
                </div>
                <div>
                  <Label>State / Province</Label>
                  <input type="text" placeholder="State" maxLength={50} {...inp('bil_state_province')} />
                  <FieldError errors={errors} touched={touched} name="bil_state_province" />
                </div>
                <div>
                  <Label>Country</Label>
                  <input type="text" placeholder="Country" maxLength={50} {...inp('bil_country')} />
                  <FieldError errors={errors} touched={touched} name="bil_country" />
                </div>
              </div>
            </SectionCard>

          </div>

          {/* ── RIGHT column ────────────────────────────────────────── */}
          <div className="space-y-2.5">

            {/* Tax */}
            <SectionCard title="Tax">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label>Tax Type</Label>
                  <input type="text" placeholder="e.g. VAT, GST" maxLength={50} {...inp('tax_type')} />
                  <FieldError errors={errors} touched={touched} name="tax_type" />
                </div>
                <div>
                  <Label>Tax No.</Label>
                  <input type="text" placeholder="Tax number" maxLength={50} {...inp('tax_no')} />
                  <FieldError errors={errors} touched={touched} name="tax_no" />
                </div>
                <div>
                  <Label>Tax Reg. No.</Label>
                  <input type="text" placeholder="Reg. number" maxLength={50} {...inp('tax_regis_no')} />
                  <FieldError errors={errors} touched={touched} name="tax_regis_no" />
                </div>
              </div>
            </SectionCard>

            {/* Financial Terms */}
            <SectionCard title="Financial Terms">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label>Credit Limit</Label>
                  <input type="number" min="0" step="0.01" placeholder="0.00" {...inp('credit_limit')} />
                  <FieldError errors={errors} touched={touched} name="credit_limit" />
                </div>
                <div>
                  <Label>Credit Period (days)</Label>
                  <input type="number" min="0" step="1" placeholder="30" {...inp('credit_period')} />
                  <FieldError errors={errors} touched={touched} name="credit_period" />
                </div>
                <div>
                  <Label>Privileges Discount (%)</Label>
                  <input type="number" min="0" max="100" step="0.01" placeholder="0.00" {...inp('privileges_discount')} />
                  <FieldError errors={errors} touched={touched} name="privileges_discount" />
                </div>
              </div>
            </SectionCard>

            {/* Banking */}
            <SectionCard title="Banking">
              <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                <div>
                  <Label>Bank Name</Label>
                  <input type="text" placeholder="Bank name" maxLength={100} {...inp('bank_name')} />
                  <FieldError errors={errors} touched={touched} name="bank_name" />
                </div>
                <div>
                  <Label>Branch</Label>
                  <input type="text" placeholder="Branch name" maxLength={100} {...inp('bank_branch')} />
                  <FieldError errors={errors} touched={touched} name="bank_branch" />
                </div>
                <div>
                  <Label>Account Holder</Label>
                  <input type="text" placeholder="Holder name" maxLength={100} {...inp('bank_acc_holder_name')} />
                  <FieldError errors={errors} touched={touched} name="bank_acc_holder_name" />
                </div>
                <div>
                  <Label>Account No.</Label>
                  <input type="text" placeholder="Account no." maxLength={50} {...inp('bank_acc_no')} />
                  <FieldError errors={errors} touched={touched} name="bank_acc_no" />
                </div>
              </div>
            </SectionCard>

            {/* Contact Person */}
            <SectionCard title="Contact Person">
              <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                <div>
                  <Label required>Name</Label>
                  <input type="text" placeholder="Full name" maxLength={100} {...inp('contact_person_name')} />
                  <FieldError errors={errors} touched={touched} name="contact_person_name" />
                </div>
                <div>
                  <Label>Designation</Label>
                  <input type="text" placeholder="Job title" maxLength={100} {...inp('contact_person_designation')} />
                  <FieldError errors={errors} touched={touched} name="contact_person_designation" />
                </div>
                <div>
                  <Label required>Mobile</Label>
                  <input type="tel" placeholder="+1 234 567 8900" maxLength={20} {...inp('contact_person_mobile')} />
                  <FieldError errors={errors} touched={touched} name="contact_person_mobile" />
                </div>
                <div>
                  <Label>Fax</Label>
                  <input type="tel" placeholder="+1 234 567 8900" maxLength={20} {...inp('contact_person_fax')} />
                  <FieldError errors={errors} touched={touched} name="contact_person_fax" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Email</Label>
                  <input type="email" placeholder="contact@supplier.com" maxLength={100} {...inp('contact_person_email')} />
                  <FieldError errors={errors} touched={touched} name="contact_person_email" />
                </div>
              </div>
            </SectionCard>

          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <div className="mt-2.5 flex items-center justify-end gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2">
          <Link
            to="/inventory/suppliers"
            className="rounded px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex items-center gap-1.5 rounded bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save size={13} strokeWidth={2.5} />
            {mutation.isPending ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Supplier'}
          </button>
        </div>

        {mutation.isError && !Object.keys(mutation.error?.response?.data?.errors ?? {}).length && (
          <p className="mt-1.5 text-xs text-red-600">
            {mutation.error?.response?.data?.message ?? 'An unexpected error occurred. Please try again.'}
          </p>
        )}
      </form>
    </div>
  )
}
