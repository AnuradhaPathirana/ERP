import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Save, Paperclip, X, FileText, Image, Download, Trash2 } from 'lucide-react'
import { checkCustomerCode, createCustomer, getCustomer, updateCustomer } from '../../api/customers'
import { deleteCustomerAttachment, uploadCustomerAttachments } from '../../api/customerAttachments'
import Breadcrumb from '../../components/Breadcrumb'
import { showError, showSuccess } from '../../utils/alerts'

function generateCustomerCode() {
  const num = Math.floor(Math.random() * 9999) + 1
  return `CUS-${String(num).padStart(4, '0')}`
}

const TITLES         = ['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.', 'Rev.']
const CUSTOMER_TYPES = ['Trade', 'Retail', 'Wholesale', 'Corporate']

const EMPTY_FORM = {
  customer_code:                '',
  reference_no:                 '',
  title:                        '',
  customer_type:                '',
  customer_name:                '',
  nic_passport_driving_licence: '',
  br_no:                        '',
  customer_mobile:              '',
  customer_land_line:           '',
  customer_email:               '',
  customer_fax:                 '',
  billing_address_line1:        '',
  billing_address_line2:        '',
  billing_address_line3:        '',
  billing_city:                 '',
  billing_zip_postal:           '',
  billing_state_province:       '',
  billing_country:              '',
  shipping_address_line1:       '',
  shipping_address_line2:       '',
  shipping_address_line3:       '',
  shipping_city:                '',
  shipping_zip_postal:          '',
  shipping_state_province:      '',
  shipping_country:             '',
  sale_manager:                 '',
  sales_executive:              '',
  sales_person:                 '',
}

const REQUIRED = new Set([
  'customer_code', 'title', 'customer_type', 'customer_name',
  'nic_passport_driving_licence', 'customer_mobile', 'billing_address_line1',
])

const LABELS = {
  customer_code:                'Customer Code',
  title:                        'Title',
  customer_type:                'Customer Type',
  customer_name:                'Customer Name',
  nic_passport_driving_licence: 'NIC / Passport / Driving Licence',
  customer_mobile:              'Customer Mobile',
  billing_address_line1:        'Billing Address Line 1',
}

function validate(field, value) {
  const v = typeof value === 'string' ? value.trim() : value
  if (REQUIRED.has(field) && !v) return `${LABELS[field]} is required.`
  switch (field) {
    case 'customer_code':
      if (v && v.length > 50) return 'Max 50 characters.'
      break
    case 'customer_name':
      if (v && v.length > 100) return 'Max 100 characters.'
      break
    case 'customer_email':
      if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Enter a valid email.'
      break
  }
  return ''
}

const inputBase = 'block w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 placeholder-slate-300 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20'
const inputErr  = 'block w-full rounded border border-red-400 bg-white px-2 py-1 text-xs text-slate-800 placeholder-slate-300 outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-500/20'

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

function SectionCard({ title, action, children }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-1.5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</h2>
        {action}
      </div>
      <div className="space-y-2 p-3">{children}</div>
    </div>
  )
}

function formatFileSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileIcon(mimeType) {
  if (!mimeType) return <FileText size={14} className="text-slate-400" />
  if (mimeType.startsWith('image/')) return <Image size={14} className="text-blue-400" />
  return <FileText size={14} className="text-slate-400" />
}

export default function CustomerFormPage() {
  const { id }      = useParams()
  const isEditing   = Boolean(id)
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const nameRef     = useRef(null)
  const fileInputRef = useRef(null)

  const [form,             setForm]             = useState(() => ({
    ...EMPTY_FORM,
    customer_code: isEditing ? '' : generateCustomerCode(),
  }))
  const [errors,           setErrors]           = useState({})
  const [touched,          setTouched]          = useState({})
  const [sameAsBilling,    setSameAsBilling]    = useState(false)
  const [codeStatus,       setCodeStatus]       = useState('idle')
  // File upload state
  const [newFiles,         setNewFiles]         = useState([])
  const [existingFiles,    setExistingFiles]    = useState([])
  const [deletingIds,      setDeletingIds]      = useState(new Set())
  const [isDragOver,       setIsDragOver]       = useState(false)

  const BILLING_TO_SHIPPING = {
    billing_address_line1:  'shipping_address_line1',
    billing_address_line2:  'shipping_address_line2',
    billing_address_line3:  'shipping_address_line3',
    billing_city:           'shipping_city',
    billing_zip_postal:     'shipping_zip_postal',
    billing_state_province: 'shipping_state_province',
    billing_country:        'shipping_country',
  }

  const handleSameAsBilling = (checked) => {
    setSameAsBilling(checked)
    if (checked) {
      setForm((prev) => ({
        ...prev,
        shipping_address_line1:  prev.billing_address_line1,
        shipping_address_line2:  prev.billing_address_line2,
        shipping_address_line3:  prev.billing_address_line3,
        shipping_city:           prev.billing_city,
        shipping_zip_postal:     prev.billing_zip_postal,
        shipping_state_province: prev.billing_state_province,
        shipping_country:        prev.billing_country,
      }))
    }
  }

  const { isLoading: isFetching, data: fetchedData } = useQuery({
    queryKey: ['customer', id],
    queryFn:  () => getCustomer(id),
    enabled:  isEditing,
  })

  const initialized = useRef(false)
  useLayoutEffect(() => {
    if (fetchedData?.data && !initialized.current) {
      const c = fetchedData.data
      setForm(
        Object.fromEntries(
          Object.keys(EMPTY_FORM).map((k) => [k, c[k] != null ? String(c[k]) : ''])
        )
      )
      setExistingFiles(Array.isArray(c.attachments) ? c.attachments : [])
      initialized.current = true
    }
  }, [fetchedData])

  useEffect(() => { nameRef.current?.focus() }, [])

  useEffect(() => {
    if (!isEditing && form.customer_code) runCodeCheck(form.customer_code, null)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const runCodeCheck = (code, excludeId) => {
    if (!code.trim()) { setCodeStatus('idle'); return }
    setCodeStatus('checking')
    checkCustomerCode(code.trim(), excludeId)
      .then((res) => setCodeStatus(res.available ? 'available' : 'taken'))
      .catch(() => setCodeStatus('idle'))
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => {
      const next = { ...prev, [name]: value }
      if (sameAsBilling && BILLING_TO_SHIPPING[name]) {
        next[BILLING_TO_SHIPPING[name]] = value
      }
      return next
    })
    if (name === 'customer_code') setCodeStatus('idle')
    if (touched[name]) setErrors((prev) => ({ ...prev, [name]: validate(name, value) }))
  }

  const handleBlur = (e) => {
    const { name, value } = e.target
    setTouched((prev) => ({ ...prev, [name]: true }))
    setErrors((prev) => ({ ...prev, [name]: validate(name, value) }))
    if (name === 'customer_code' && value.trim()) {
      runCodeCheck(value, isEditing ? id : null)
    }
  }

  // File handling
  const addFiles = (fileList) => {
    const incoming = Array.from(fileList)
    setNewFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name))
      return [...prev, ...incoming.filter((f) => !existingNames.has(f.name))]
    })
  }

  const handleFileInput = (e) => {
    addFiles(e.target.files)
    e.target.value = ''
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragOver(false)
    addFiles(e.dataTransfer.files)
  }

  const removeNewFile = (index) => {
    setNewFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleDeleteExisting = async (attachment) => {
    setDeletingIds((prev) => new Set(prev).add(attachment.id))
    try {
      await deleteCustomerAttachment(id, attachment.id)
      setExistingFiles((prev) => prev.filter((a) => a.id !== attachment.id))
    } catch {
      showError('Failed to delete attachment.')
    } finally {
      setDeletingIds((prev) => { const s = new Set(prev); s.delete(attachment.id); return s })
    }
  }

  const mutation = useMutation({
    mutationFn: (payload) =>
      isEditing ? updateCustomer(id, payload) : createCustomer(payload),
    onSuccess: async (res) => {
      const customerId = res.data?.id ?? id
      if (newFiles.length > 0) {
        try {
          await uploadCustomerAttachments(customerId, newFiles)
          setNewFiles([])
        } catch {
          showError('Customer saved, but some attachments failed to upload.')
        }
      }
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['customers-all'] })
      if (isEditing) queryClient.invalidateQueries({ queryKey: ['customer', id] })
      showSuccess(isEditing ? 'Customer updated successfully.' : 'Customer created successfully.')
      navigate('/inventory/customers')
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

    mutation.mutate({
      customer_code:                str(form.customer_code),
      reference_no:                 str(form.reference_no),
      title:                        str(form.title),
      customer_type:                str(form.customer_type),
      customer_name:                form.customer_name.trim(),
      nic_passport_driving_licence: str(form.nic_passport_driving_licence),
      br_no:                        str(form.br_no),
      customer_mobile:              str(form.customer_mobile),
      customer_land_line:           str(form.customer_land_line),
      customer_email:               str(form.customer_email),
      customer_fax:                 str(form.customer_fax),
      billing_address_line1:        str(form.billing_address_line1),
      billing_address_line2:        str(form.billing_address_line2),
      billing_address_line3:        str(form.billing_address_line3),
      billing_city:                 str(form.billing_city),
      billing_zip_postal:           str(form.billing_zip_postal),
      billing_state_province:       str(form.billing_state_province),
      billing_country:              str(form.billing_country),
      shipping_address_line1:       str(form.shipping_address_line1),
      shipping_address_line2:       str(form.shipping_address_line2),
      shipping_address_line3:       str(form.shipping_address_line3),
      shipping_city:                str(form.shipping_city),
      shipping_zip_postal:          str(form.shipping_zip_postal),
      shipping_state_province:      str(form.shipping_state_province),
      shipping_country:             str(form.shipping_country),
      sale_manager:                 str(form.sale_manager),
      sales_executive:              str(form.sales_executive),
      sales_person:                 str(form.sales_person),
    })
  }

  const crumbs = [
    { label: 'Inventory',  to: '/inventory/products' },
    { label: 'Customers',  to: '/inventory/customers' },
    { label: isEditing ? 'Edit Customer' : 'New Customer' },
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
      <div>
        <h1 className="text-xl font-bold leading-none text-slate-800">
          {isEditing ? 'Edit Customer' : 'New Customer'}
        </h1>
        <Breadcrumb crumbs={crumbs} />
      </div>
      <form onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">

          {/* ── LEFT column ─────────────────────────────────────────── */}
          <div className="space-y-2.5">

            {/* General */}
            <SectionCard title="General">
              <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                <div>
                  <Label required>Customer Code</Label>
                  <div className="flex items-center gap-1">
                    <input type="text" placeholder="CUS-0001" maxLength={50} {...inp('customer_code')} />
                    {!isEditing && (
                      <button
                        type="button"
                        title="Generate new code"
                        onClick={() => {
                          const code = generateCustomerCode()
                          setForm((prev) => ({ ...prev, customer_code: code }))
                          setErrors((prev) => ({ ...prev, customer_code: '' }))
                          runCodeCheck(code, null)
                        }}
                        className="shrink-0 rounded border border-slate-300 bg-white p-1 text-slate-500 transition hover:border-indigo-400 hover:text-indigo-600"
                      >
                        <RefreshCw size={12} strokeWidth={2.5} className={codeStatus === 'checking' ? 'animate-spin' : ''} />
                      </button>
                    )}
                  </div>
                  <FieldError errors={errors} touched={touched} name="customer_code" />
                  {form.customer_code.trim() && codeStatus === 'checking' && (
                    <p className="mt-0.5 text-[11px] text-slate-400">Checking availability…</p>
                  )}
                  {form.customer_code.trim() && codeStatus === 'available' && (
                    <p className="mt-0.5 text-[11px] text-emerald-600">Code is available.</p>
                  )}
                  {form.customer_code.trim() && codeStatus === 'taken' && (
                    <p className="mt-0.5 text-[11px] text-red-600">Code already in use.</p>
                  )}
                </div>
                <div>
                  <Label>Reference No.</Label>
                  <input type="text" placeholder="REF-001" maxLength={50} {...inp('reference_no')} />
                  <FieldError errors={errors} touched={touched} name="reference_no" />
                </div>
                <div>
                  <Label required>Title</Label>
                  <select {...inp('title')}>
                    <option value="">— Select —</option>
                    {TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <FieldError errors={errors} touched={touched} name="title" />
                </div>
                <div>
                  <Label required>Customer Type</Label>
                  <select {...inp('customer_type')}>
                    <option value="">— Select —</option>
                    {CUSTOMER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <FieldError errors={errors} touched={touched} name="customer_type" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
                <div className="xl:col-span-2">
                  <Label required>Customer Name</Label>
                  <input ref={nameRef} type="text" placeholder="Full customer name" maxLength={100} {...inp('customer_name')} />
                  <FieldError errors={errors} touched={touched} name="customer_name" />
                </div>
                <div>
                  <Label required>NIC / Passport / Driving Licence</Label>
                  <input type="text" placeholder="ID number" maxLength={50} {...inp('nic_passport_driving_licence')} />
                  <FieldError errors={errors} touched={touched} name="nic_passport_driving_licence" />
                </div>
              </div>
              <div>
                <Label>BR Number</Label>
                <input type="text" placeholder="Business reg. no." maxLength={50} {...inp('br_no')} />
                <FieldError errors={errors} touched={touched} name="br_no" />
              </div>
            </SectionCard>

            {/* Contact */}
            <SectionCard title="Contact">
              <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                <div>
                  <Label required>Customer Mobile</Label>
                  <input type="tel" placeholder="+94 71 234 5678" maxLength={20} {...inp('customer_mobile')} />
                  <FieldError errors={errors} touched={touched} name="customer_mobile" />
                </div>
                <div>
                  <Label>Land Line</Label>
                  <input type="tel" placeholder="+94 11 234 5678" maxLength={20} {...inp('customer_land_line')} />
                  <FieldError errors={errors} touched={touched} name="customer_land_line" />
                </div>
                <div>
                  <Label>Email</Label>
                  <input type="email" placeholder="customer@example.com" maxLength={100} {...inp('customer_email')} />
                  <FieldError errors={errors} touched={touched} name="customer_email" />
                </div>
                <div>
                  <Label>Fax</Label>
                  <input type="tel" placeholder="+94 11 234 5678" maxLength={20} {...inp('customer_fax')} />
                  <FieldError errors={errors} touched={touched} name="customer_fax" />
                </div>
              </div>
            </SectionCard>

            {/* Billing Address */}
            <SectionCard title="Billing Address">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label required>Address Line 1</Label>
                  <input type="text" placeholder="Street / building" maxLength={100} {...inp('billing_address_line1')} />
                  <FieldError errors={errors} touched={touched} name="billing_address_line1" />
                </div>
                <div>
                  <Label>Address Line 2</Label>
                  <input type="text" placeholder="Suite / floor" maxLength={100} {...inp('billing_address_line2')} />
                  <FieldError errors={errors} touched={touched} name="billing_address_line2" />
                </div>
                <div>
                  <Label>Address Line 3</Label>
                  <input type="text" maxLength={100} {...inp('billing_address_line3')} />
                  <FieldError errors={errors} touched={touched} name="billing_address_line3" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                <div>
                  <Label>City</Label>
                  <input type="text" placeholder="City" maxLength={50} {...inp('billing_city')} />
                  <FieldError errors={errors} touched={touched} name="billing_city" />
                </div>
                <div>
                  <Label>Zip / Postal</Label>
                  <input type="text" placeholder="10001" maxLength={20} {...inp('billing_zip_postal')} />
                  <FieldError errors={errors} touched={touched} name="billing_zip_postal" />
                </div>
                <div>
                  <Label>State / Province</Label>
                  <input type="text" placeholder="State" maxLength={50} {...inp('billing_state_province')} />
                  <FieldError errors={errors} touched={touched} name="billing_state_province" />
                </div>
                <div>
                  <Label>Country</Label>
                  <input type="text" placeholder="Country" maxLength={50} {...inp('billing_country')} />
                  <FieldError errors={errors} touched={touched} name="billing_country" />
                </div>
              </div>
            </SectionCard>

          </div>

          {/* ── RIGHT column ────────────────────────────────────────── */}
          <div className="space-y-2.5">

            {/* Shipping Address */}
            <SectionCard
              title="Shipping Address"
              action={
                <label className="flex cursor-pointer items-center gap-1.5 select-none">
                  <input
                    type="checkbox"
                    checked={sameAsBilling}
                    onChange={(e) => handleSameAsBilling(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-300 accent-indigo-600"
                  />
                  <span className="text-[11px] font-medium text-slate-500">Same as Billing</span>
                </label>
              }
            >
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label>Address Line 1</Label>
                  <input
                    type="text" placeholder="Street / building" maxLength={100}
                    {...inp('shipping_address_line1')}
                    disabled={sameAsBilling}
                    className={`${fieldCls(errors, touched, 'shipping_address_line1')} ${sameAsBilling ? 'cursor-not-allowed bg-slate-50 text-slate-400' : ''}`}
                  />
                </div>
                <div>
                  <Label>Address Line 2</Label>
                  <input
                    type="text" placeholder="Suite / floor" maxLength={100}
                    {...inp('shipping_address_line2')}
                    disabled={sameAsBilling}
                    className={`${fieldCls(errors, touched, 'shipping_address_line2')} ${sameAsBilling ? 'cursor-not-allowed bg-slate-50 text-slate-400' : ''}`}
                  />
                </div>
                <div>
                  <Label>Address Line 3</Label>
                  <input
                    type="text" maxLength={100}
                    {...inp('shipping_address_line3')}
                    disabled={sameAsBilling}
                    className={`${fieldCls(errors, touched, 'shipping_address_line3')} ${sameAsBilling ? 'cursor-not-allowed bg-slate-50 text-slate-400' : ''}`}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                <div>
                  <Label>City</Label>
                  <input
                    type="text" placeholder="City" maxLength={50}
                    {...inp('shipping_city')}
                    disabled={sameAsBilling}
                    className={`${fieldCls(errors, touched, 'shipping_city')} ${sameAsBilling ? 'cursor-not-allowed bg-slate-50 text-slate-400' : ''}`}
                  />
                </div>
                <div>
                  <Label>Zip / Postal</Label>
                  <input
                    type="text" placeholder="10001" maxLength={20}
                    {...inp('shipping_zip_postal')}
                    disabled={sameAsBilling}
                    className={`${fieldCls(errors, touched, 'shipping_zip_postal')} ${sameAsBilling ? 'cursor-not-allowed bg-slate-50 text-slate-400' : ''}`}
                  />
                </div>
                <div>
                  <Label>State / Province</Label>
                  <input
                    type="text" placeholder="State" maxLength={50}
                    {...inp('shipping_state_province')}
                    disabled={sameAsBilling}
                    className={`${fieldCls(errors, touched, 'shipping_state_province')} ${sameAsBilling ? 'cursor-not-allowed bg-slate-50 text-slate-400' : ''}`}
                  />
                </div>
                <div>
                  <Label>Country</Label>
                  <input
                    type="text" placeholder="Country" maxLength={50}
                    {...inp('shipping_country')}
                    disabled={sameAsBilling}
                    className={`${fieldCls(errors, touched, 'shipping_country')} ${sameAsBilling ? 'cursor-not-allowed bg-slate-50 text-slate-400' : ''}`}
                  />
                </div>
              </div>
            </SectionCard>

            {/* Sales Team */}
            <SectionCard title="Sales Team">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label>Sale Manager</Label>
                  <input type="text" placeholder="Manager name" maxLength={100} {...inp('sale_manager')} />
                  <FieldError errors={errors} touched={touched} name="sale_manager" />
                </div>
                <div>
                  <Label>Sales Executive</Label>
                  <input type="text" placeholder="Executive name" maxLength={100} {...inp('sales_executive')} />
                  <FieldError errors={errors} touched={touched} name="sales_executive" />
                </div>
                <div>
                  <Label>Sales Person</Label>
                  <input type="text" placeholder="Sales person name" maxLength={100} {...inp('sales_person')} />
                  <FieldError errors={errors} touched={touched} name="sales_person" />
                </div>
              </div>
            </SectionCard>

            {/* Attachments */}
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-1.5">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Attachments</h2>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 transition hover:border-indigo-400 hover:text-indigo-600"
                >
                  <Paperclip size={11} strokeWidth={2.5} />
                  Add Files
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                  onChange={handleFileInput}
                  className="hidden"
                />
              </div>

              <div className="p-3 space-y-2">
                {/* Drop zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={[
                    'flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed py-4 text-center transition-colors',
                    isDragOver
                      ? 'border-indigo-400 bg-indigo-50'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50',
                  ].join(' ')}
                >
                  <Paperclip size={18} className={isDragOver ? 'text-indigo-400' : 'text-slate-300'} />
                  <p className="text-[11px] text-slate-400">
                    Drag & drop files here, or <span className="text-indigo-500">click to browse</span>
                  </p>
                  <p className="text-[10px] text-slate-300">Images, PDF, Word, Excel — max 10 MB each</p>
                </div>

                {/* Queued new files */}
                {newFiles.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium text-slate-500">
                      Queued ({newFiles.length}) — will upload on save
                    </p>
                    {newFiles.map((file, i) => (
                      <div key={i} className="flex items-center gap-2 rounded border border-indigo-100 bg-indigo-50 px-2 py-1">
                        <Image size={13} className="shrink-0 text-indigo-400" />
                        <span className="min-w-0 flex-1 truncate text-[11px] text-indigo-700">{file.name}</span>
                        <span className="shrink-0 text-[10px] text-indigo-400">{formatFileSize(file.size)}</span>
                        <button
                          type="button"
                          onClick={() => removeNewFile(i)}
                          className="shrink-0 rounded p-0.5 text-indigo-400 transition hover:bg-indigo-100 hover:text-indigo-600"
                        >
                          <X size={11} strokeWidth={2.5} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Existing saved attachments */}
                {existingFiles.length > 0 && (
                  <div className="space-y-1">
                    {newFiles.length > 0 && <div className="border-t border-slate-100" />}
                    <p className="text-[11px] font-medium text-slate-500">Saved ({existingFiles.length})</p>
                    {existingFiles.map((att) => (
                      <div key={att.id} className="flex items-center gap-2 rounded border border-slate-100 bg-slate-50 px-2 py-1">
                        {fileIcon(att.mime_type)}
                        <span className="min-w-0 flex-1 truncate text-[11px] text-slate-700">{att.file_name}</span>
                        <span className="shrink-0 text-[10px] text-slate-400">{formatFileSize(att.file_size)}</span>
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0 rounded p-0.5 text-slate-400 transition hover:text-indigo-600"
                          title="Download"
                        >
                          <Download size={11} strokeWidth={2.5} />
                        </a>
                        <button
                          type="button"
                          disabled={deletingIds.has(att.id)}
                          onClick={() => handleDeleteExisting(att)}
                          className="shrink-0 rounded p-0.5 text-slate-400 transition hover:text-red-500 disabled:opacity-40"
                          title="Delete"
                        >
                          <Trash2 size={11} strokeWidth={2.5} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {newFiles.length === 0 && existingFiles.length === 0 && (
                  <p className="text-center text-[11px] text-slate-300">No attachments yet.</p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white p-3 flex flex-col gap-2">
              <button
                type="submit"
                disabled={mutation.isPending}
                className="flex w-full items-center justify-center gap-1.5 rounded bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save size={13} strokeWidth={2.5} />
                {mutation.isPending ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Customer'}
              </button>
              <Link
                to="/inventory/customers"
                className="block w-full rounded border border-slate-200 px-3 py-1.5 text-center text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100"
              >
                Cancel
              </Link>
              {mutation.isError && !Object.keys(mutation.error?.response?.data?.errors ?? {}).length && (
                <p className="text-xs text-red-600">
                  {mutation.error?.response?.data?.message ?? 'An unexpected error occurred. Please try again.'}
                </p>
              )}
            </div>

          </div>
        </div>
      </form>
    </div>
  )
}
