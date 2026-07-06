import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ChevronDown, ClipboardList, Download, FileText, Layers, PackageCheck, Plus, Printer, QrCode, ShoppingCart, Trash2, Weight, X } from 'lucide-react'
import {
  confirmGoodsReceivedNote,
  createGoodsReceivedNote,
  downloadGrnPdf,
  downloadGrnPieceLabelsPdf,
  getGoodsReceivedNote,
  getLastGrn,
  getLastGrnProductPrices,
  getNextGrnNo,
  getPoOutstandingItemsMultiple,
  updateGoodsReceivedNote,
} from '../../api/goodsReceivedNotes'
import { getGrnAttachments, uploadGrnAttachments, deleteGrnAttachment } from '../../api/grnAttachments'
import { getPurchaseOrders } from '../../api/purchaseOrders'
import { getAllSuppliers } from '../../api/suppliers'
import { getAllLocations } from '../../api/locations'
import { getAllStores } from '../../api/stores'
import { getProducts, getProduct } from '../../api/products'
import { getAllUnitTypesFlat } from '../../api/unitTypes'
import { getAllAttributeTypes } from '../../api/attributeTypes'
import { getAllAttributes } from '../../api/attributes'
import Breadcrumb from '../../components/Breadcrumb'
import BatchAssignModal from '../../components/inventory/BatchAssignModal'
import RollAssignModal from '../../components/inventory/RollAssignModal'
import { showError, showSuccess } from '../../utils/alerts'
import { printPdfBlob } from '../../utils/pdf'

/* ── Style tokens ─────────────────────────────────────────────── */
const INPUT_CLS   = 'block w-full rounded border-2 border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/15'
const INPUT_ERR   = 'block w-full rounded border-2 border-red-400 bg-red-50 px-2 py-1 text-xs text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-red-500 focus:bg-white focus:ring-2 focus:ring-red-400/20'
const INPUT_RO    = 'block w-full rounded border-2 border-slate-100 bg-slate-100 px-2 py-1 text-xs text-slate-500 outline-none cursor-default'
const SELECT_CLS  = 'block w-full rounded border-2 border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-800 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/15 cursor-pointer'
const SELECT_ERR  = 'block w-full rounded border-2 border-red-400 bg-red-50 px-2 py-1 text-xs text-slate-800 outline-none transition-all focus:border-red-500 focus:bg-white focus:ring-2 focus:ring-red-400/20 cursor-pointer'
const TABLE_INPUT   = 'block w-full rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs text-slate-800 outline-none transition-all focus:border-indigo-500 focus:bg-white'
const TABLE_ERR     = 'block w-full rounded border border-red-400 bg-red-50 px-1.5 py-0.5 text-xs text-slate-800 outline-none transition-all focus:border-red-500 focus:bg-white'
const LABEL_CLS   = 'text-[10px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap'
const ERR_CLS     = 'mt-0.5 text-[10px] text-red-500'

/* ── Header field validation rules ───────────────────────────── */
const HEADER_RULES = {
  supplier_id:      (v) => v ? null : 'Supplier is required',
  grn_date:         (v) => v ? null : 'GRN date is required',
  transaction_date: (v) => v ? null : 'Transaction date is required',
  location_id:      (v) => v ? null : 'Location is required',
  store_id:         (v) => v ? null : 'Store is required',
  shipping_code:    (v) => v && v.trim() ? null : 'Shipping code is required',
}

const ALLOWED_ATTACHMENT_TYPES = /^(image\/.+|application\/pdf)$/

function SectionHeader({ icon: Icon, title, colorClass, extra }) {
  return (
    <div className={`flex items-center justify-between gap-1.5 px-3 py-2 border-b ${colorClass}`}>
      <div className="flex items-center gap-1.5">
        {Icon && <Icon size={13} />}
        <h2 className="text-xs font-bold">{title}</h2>
      </div>
      {extra}
    </div>
  )
}

function FieldRow({ label, required, error, children }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className={LABEL_CLS}>
        {label}{required && <span className="text-red-500">*</span>}
      </span>
      <div className="min-w-0">
        {children}
        {error && <p className={ERR_CLS}>{error}</p>}
      </div>
    </div>
  )
}

/* ── Custom dropdown (Location / Store) — opens its option pad automatically on
   focus so the Enter-key chain can "show the pad" the way a native <select>
   can't (browsers block scripts from opening a native select's popup). ── */
function FormDropdown({ groups, value, onChange, onNext, onBlur, placeholder = 'Select', disabled, error, cellRef, compact = false }) {
  const [open, setOpen] = useState(false)
  const [highlightIdx, setHighlightIdx] = useState(0)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: compact ? 140 : 200 })
  const btnRef = useRef(null)
  const containerRef = useRef(null)

  const flatItems = groups.flatMap((g) => g.items)
  const selected = flatItems.find((it) => String(it.value) === String(value))

  const openDropdown = () => {
    if (disabled) return
    const idx = flatItems.findIndex((it) => String(it.value) === String(value))
    setHighlightIdx(idx >= 0 ? idx : 0)
    setOpen(true)
  }

  useEffect(() => {
    if (open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setDropPos({ top: rect.bottom + 2, left: rect.left, width: Math.max(rect.width, compact ? 140 : 200) })
    }
  }, [open, compact])

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const selectItem = (item) => {
    onChange(item.value)
    setOpen(false)
    setTimeout(() => onNext?.(), 0)
  }

  const handleKeyDown = (e) => {
    if (disabled) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) { openDropdown(); return }
      setHighlightIdx((i) => Math.min(i + 1, flatItems.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) { openDropdown(); return }
      setHighlightIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (open && flatItems[highlightIdx]) {
        selectItem(flatItems[highlightIdx])
      } else {
        setOpen(false)
        onNext?.()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    } else if (e.key === ' ') {
      e.preventDefault()
      if (open) setOpen(false)
      else openDropdown()
    }
  }

  const borderW  = compact ? 'border' : 'border-2'
  const padding  = compact ? 'px-1.5 py-0.5' : 'px-2 py-1'
  const btnClass = disabled
    ? `flex w-full items-center justify-between gap-1 rounded ${borderW} border-slate-200 bg-slate-100 ${padding} text-xs text-slate-400 outline-none cursor-not-allowed`
    : error
      ? `flex w-full items-center justify-between gap-1 rounded ${borderW} border-red-400 bg-red-50 ${padding} text-xs text-slate-800 outline-none transition-all focus:border-red-500 focus:bg-white ${compact ? '' : 'focus:ring-2 focus:ring-red-400/20'} cursor-pointer`
      : `flex w-full items-center justify-between gap-1 rounded ${borderW} border-slate-200 bg-slate-50 ${padding} text-xs text-slate-800 outline-none transition-all focus:border-indigo-500 focus:bg-white ${compact ? '' : 'focus:ring-2 focus:ring-indigo-500/15'} cursor-pointer`

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        ref={(el) => { btnRef.current = el; cellRef?.(el) }}
        disabled={disabled}
        onFocus={openDropdown}
        onClick={() => { if (!disabled) { if (open) setOpen(false); else openDropdown() } }}
        onKeyDown={handleKeyDown}
        onBlur={onBlur}
        className={btnClass}
      >
        <span className={`truncate text-left ${selected ? '' : 'text-slate-400'}`}>{selected ? selected.label : placeholder}</span>
        <ChevronDown size={compact ? 10 : 12} className="shrink-0 text-slate-400" />
      </button>
      {open && !disabled && createPortal(
        <div
          style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 9999 }}
          className="rounded border border-slate-200 bg-white shadow-xl max-h-56 overflow-y-auto"
        >
          {flatItems.length === 0 && <div className="px-2 py-1.5 text-xs text-slate-400">No options</div>}
          {groups.map((g, gi) => (
            g.items.length === 0 ? null : (
              <div key={gi}>
                {g.label && (
                  <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50">{g.label}</div>
                )}
                {g.items.map((it) => {
                  const flatIdx = flatItems.indexOf(it)
                  return (
                    <button
                      key={it.value}
                      type="button"
                      className={`block w-full px-2 py-1.5 text-left text-xs transition-colors ${
                        flatIdx === highlightIdx ? 'bg-indigo-100 text-indigo-900' : 'hover:bg-slate-50 text-slate-700'
                      }`}
                      onMouseDown={(e) => { e.preventDefault(); selectItem(it) }}
                      onMouseEnter={() => setHighlightIdx(flatIdx)}
                    >
                      {it.label}
                    </button>
                  )
                })}
              </div>
            )
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}

/* ── Helpers ──────────────────────────────────────────────────── */
const toPrice = (v) =>
  v != null && v !== '' && !isNaN(parseFloat(v)) ? parseFloat(v).toFixed(2) : ''

// "Color" or "Colour" — attribute-type spelling varies by who entered the master data.
function isColorAttributeTypeName(name) {
  const n = (name || '').trim().toLowerCase()
  return n === 'color' || n === 'colour'
}

/* ── Line item calculator ─────────────────────────────────────── */
function calcItem(row) {
  const qty      = parseFloat(row.quantity_received) || 0
  const price    = parseFloat(row.unit_price)        || 0
  const discPct  = parseFloat(row.discount)          || 0
  const gross    = qty * price
  const discAmt  = gross * (discPct / 100)
  const taxAmt   = 0 // item-wise tax feature hidden — always inert
  const amount   = gross - discAmt + taxAmt
  return { gross, discAmt, taxAmt, amount }
}

/* ── Helpers ──────────────────────────────────────────────────── */
const STATUS_BADGE = {
  confirmed:          'bg-blue-50 text-blue-700 border-blue-200',
  partially_received: 'bg-amber-50 text-amber-700 border-amber-200',
}

function StatusBadge({ label, value }) {
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${STATUS_BADGE[value] ?? 'bg-slate-50 text-slate-600 border-slate-200'}`}>
      {label}
    </span>
  )
}

function formatFileSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/* ── Product search cell (for manual rows) ────────────────────── */
function ProductSearchCell({ row, productSearch, onQueryChange, onSelect, onClear, onClose, onInputRef }) {
  const [highlightIdx, setHighlightIdx] = useState(0)
  const [dropPos, setDropPos]           = useState({ top: 0, left: 0, width: 420 })
  const inputRef = useRef(null)

  const results    = productSearch.key === row._key ? (productSearch.results ?? []) : []
  const isOpen     = productSearch.key === row._key && productSearch.open && results.length > 0
  const isSelected = Boolean(row.product_id)

  // Reset highlight when a new result list arrives
  useEffect(() => { setHighlightIdx(0) }, [results.length])

  // Recalculate dropdown position whenever it opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect()
      setDropPos({
        top:   rect.bottom + 2,
        left:  rect.left,
        width: Math.max(rect.width, 420),
      })
    }
  }, [isOpen])

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      if (!isOpen) return
      e.preventDefault()
      setHighlightIdx((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      if (!isOpen) return
      e.preventDefault()
      setHighlightIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (isOpen && results[highlightIdx]) onSelect(row._key, results[highlightIdx])
    } else if (e.key === 'Escape') {
      onClose?.()
    }
  }

  if (isSelected) {
    return (
      <div className="flex items-center gap-1 min-w-0">
        <span className="truncate text-xs font-medium text-slate-700">{row.product_name}</span>
        <button
          type="button"
          title="Clear product"
          onClick={() => onClear(row._key)}
          className="shrink-0 text-slate-300 hover:text-red-500 transition-colors"
        >
          <X size={10} />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <input
        ref={(el) => { inputRef.current = el; onInputRef?.(el) }}
        type="text"
        placeholder="Search product…"
        className={TABLE_INPUT + ' w-full'}
        value={productSearch.key === row._key ? productSearch.query : ''}
        onChange={(e) => onQueryChange(row._key, e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          const currentQuery = productSearch.key === row._key ? productSearch.query : ''
          onQueryChange(row._key, currentQuery)
        }}
        autoComplete="off"
      />
      {isOpen && createPortal(
        <div
          style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 9999 }}
          className="rounded border border-slate-200 bg-white shadow-xl max-h-52 overflow-y-auto"
        >
          {results.map((p, i) => (
            <button
              key={p.id}
              type="button"
              className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs transition-colors ${
                i === highlightIdx
                  ? 'bg-indigo-100 text-indigo-900'
                  : 'hover:bg-slate-50 text-slate-700'
              }`}
              onMouseDown={(e) => { e.preventDefault(); onSelect(row._key, p) }}
              onMouseEnter={() => setHighlightIdx(i)}
            >
              <span className="font-mono text-[10px] text-indigo-400 shrink-0 w-20 truncate">{p.product_code}</span>
              <span className="font-medium whitespace-normal break-words">{p.name}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════ */
export default function GoodsReceivedNoteFormPage() {
  const { id }      = useParams()
  const isEdit      = Boolean(id)
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const [search]    = useSearchParams()
  const poIdFromUrl = search.get('po_id')
  const fileRef     = useRef(null)

  const CRUMBS = [
    { label: 'Inventory', to: '/inventory/products' },
    { label: 'Goods Received Notes', to: '/inventory/goods-received-notes' },
    { label: isEdit ? 'Edit GRN' : 'New GRN' },
  ]

  const today = new Date().toISOString().slice(0, 10)

  /* ── Form header state ────────────────────────────────────── */
  const [form, setForm] = useState({
    supplier_id:      '',
    grn_date:         today,
    transaction_date: today,
    reference_no:     '',
    shipping_code:    '',
    remarks:          '',
    payment_terms:    '',
    location_id:      '',
    store_id:         '',
  })
  const [grnNoPreview,  setGrnNoPreview]  = useState('')
  const [lastGrnDate,   setLastGrnDate]   = useState('')
  const [lastGrnAmount, setLastGrnAmount] = useState('')

  /* ── Save status & PDF ────────────────────────────────────── */
  const [saveStatus,      setSaveStatus]      = useState('confirmed')  // 'draft' | 'confirmed'
  const [isDownloading,   setIsDownloading]   = useState(false)
  const [isPrinting,      setIsPrinting]      = useState(false)
  const [isPrintingLabels, setIsPrintingLabels] = useState(false)

  /* ── Attachment state ─────────────────────────────────────── */
  const [newFiles,    setNewFiles]    = useState([])
  const [isUploading, setIsUploading] = useState(false)

  /* ── PO selection state ───────────────────────────────────── */
  const [selectedPoIds, setSelectedPoIds] = useState(new Set())
  const [loadingItems,  setLoadingItems]  = useState(false)

  /* ── GRN items state ──────────────────────────────────────── */
  const [items,              setItems]             = useState([])
  const [errors,             setErrors]            = useState({})
  const [batchModalIdx,      setBatchModalIdx]     = useState(null)
  const [batchConfirmModal,  setBatchConfirmModal] = useState({ open: false, firstIdx: null })
  const [rollModalIdx,       setRollModalIdx]      = useState(null)

  /* ── Real-time validation state ───────────────────────────── */
  const [touched,     setTouched]     = useState({})
  const [itemTouched, setItemTouched] = useState({})

  /* ── Product search state (manual rows) ───────────────────── */
  const [productSearch, setProductSearch] = useState({ key: null, query: '', results: [], open: false })
  const searchTimerRef = useRef(null)

  /* ── Header field refs — Supplier → Location → Store → Shipping Code chain ── */
  const locationFieldRef     = useRef(null)
  const storeFieldRef        = useRef(null)
  const shippingCodeFieldRef = useRef(null)

  /* ── Cell refs for Enter-key row navigation ───────────────── */
  const cellRefs = useRef({}) // { [rowKey]: { uom, qty, price, disc, tax, batch } }

  const setCellRef = (rowKey, field) => (el) => {
    if (!cellRefs.current[rowKey]) cellRefs.current[rowKey] = {}
    cellRefs.current[rowKey][field] = el
  }

  const focusCell = (rowKey, field) => {
    cellRefs.current[rowKey]?.[field]?.focus()
  }

  /* ── Next GRN number preview ─────────────────────────────── */
  useEffect(() => {
    if (isEdit) return
    getNextGrnNo()
      .then(setGrnNoPreview)
      .catch(() => setGrnNoPreview('Auto-generated'))
  }, [isEdit])

  /* ── Remote data ──────────────────────────────────────────── */
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-all'],
    queryFn:  getAllSuppliers,
  })
  // Flat, cross-category list — a product's UOM (from its sales channel) may belong
  // to any unit category, not just the system default one.
  const { data: unitTypes = [] } = useQuery({
    queryKey: ['unit-types-flat'],
    queryFn:  getAllUnitTypesFlat,
    staleTime: 5 * 60 * 1000,
  })
  const uomGroups = unitTypes.reduce((acc, u) => {
    const key = String(u.unit_category_id)
    if (!acc[key]) acc[key] = { name: u.unit_category_name ?? 'Other', items: [] }
    acc[key].items.push(u)
    return acc
  }, {})

  // Color options are scoped to the SELECTED PRODUCT's own "Product Attributes"
  // (set at product creation), not just its category — only relevant for manual
  // (non-PO) rows, since PO-linked rows inherit their color from the PO item.
  const { data: attributeTypes = [] } = useQuery({ queryKey: ['attribute-types-all'], queryFn: getAllAttributeTypes })
  const { data: allAttributes  = [] } = useQuery({ queryKey: ['attributes-all'],      queryFn: getAllAttributes })
  const colorOptionsCache = useRef({})

  const loadColorOptions = (productId) => {
    if (!productId) return Promise.resolve([])
    if (colorOptionsCache.current[productId]) return colorOptionsCache.current[productId]

    const promise = getProduct(productId)
      .then((res) => {
        const colorTypeIds = new Set(
          attributeTypes.filter((t) => isColorAttributeTypeName(t.attribute_type_name)).map((t) => String(t.id))
        )
        return (res.data.product_attributes ?? [])
          .filter((pa) => colorTypeIds.has(String(pa.attribute_type_id)))
          .map((pa) => allAttributes.find((a) => String(a.id) === String(pa.attribute_id)))
          .filter(Boolean)
          .map((a) => ({ id: a.id, name: a.attribute_name }))
      })
      .catch(() => [])

    colorOptionsCache.current[productId] = promise
    return promise
  }

  // Fetch color options for a batch of manual rows (edit-mode hydration) and patch them in once resolved.
  const hydrateColorOptions = (rows) => {
    rows.forEach((row) => {
      if (!row.product_id || row.po_item_id) return
      loadColorOptions(row.product_id).then((options) => {
        setItems((prev) => prev.map((r) => r._key === row._key ? { ...r, color_options: options } : r))
      })
    })
  }

  const { data: locations = [] } = useQuery({
    queryKey: ['locations-all'],
    queryFn:  getAllLocations,
    staleTime: Infinity,
  })
  const { data: allStores = [] } = useQuery({
    queryKey: ['stores-all'],
    queryFn:  getAllStores,
    staleTime: Infinity,
  })
  const storesForLocation = form.location_id
    ? allStores.filter((s) => String(s.location_id) === String(form.location_id))
    : allStores

  // Default Location & Store to the first available option (create mode only —
  // editing an existing GRN keeps its saved values via the hydration effect below).
  const locationSeeded = useRef(false)
  useEffect(() => {
    if (!isEdit && !locationSeeded.current && locations.length > 0) {
      setForm((f) => (f.location_id ? f : { ...f, location_id: String(locations[0].id) }))
      locationSeeded.current = true
    }
  }, [isEdit, locations])

  const storeSeeded = useRef(false)
  useEffect(() => {
    if (!isEdit && !storeSeeded.current && form.location_id && storesForLocation.length > 0) {
      setForm((f) => (f.store_id ? f : { ...f, store_id: String(storesForLocation[0].id) }))
      storeSeeded.current = true
    }
  }, [isEdit, form.location_id, storesForLocation])

  const { data: supplierConfirmedPOs, isLoading: loadingConfirmed } = useQuery({
    queryKey: ['pos-supplier-confirmed', form.supplier_id],
    queryFn:  () => getPurchaseOrders(1, { supplier_id: form.supplier_id, status: 'confirmed', per_page: 200 }),
    enabled:  Boolean(form.supplier_id) && !isEdit,
  })
  const { data: supplierPartialPOs, isLoading: loadingPartial } = useQuery({
    queryKey: ['pos-supplier-partial', form.supplier_id],
    queryFn:  () => getPurchaseOrders(1, { supplier_id: form.supplier_id, status: 'partially_received', per_page: 200 }),
    enabled:  Boolean(form.supplier_id) && !isEdit,
  })

  const displayedPOs  = [
    ...(supplierConfirmedPOs?.data ?? []),
    ...(supplierPartialPOs?.data  ?? []),
  ]
  const loadingPOs = loadingConfirmed || loadingPartial

  /* ── Attachments query (edit/view mode) ───────────────────── */
  const {
    data: attachmentsData,
    isLoading: isAttachmentsLoading,
    refetch: refetchAttachments,
  } = useQuery({
    queryKey: ['grn-attachments', id],
    queryFn:  () => getGrnAttachments(id),
    enabled:  isEdit,
    staleTime: 0,
  })
  const existingFiles = attachmentsData ?? []

  /* ── Load existing GRN for edit ───────────────────────────── */
  const { data: existingGRN, isLoading: loadingGRN } = useQuery({
    queryKey: ['grn', id],
    queryFn:  () => getGoodsReceivedNote(id),
    enabled:  isEdit,
  })

  useEffect(() => {
    if (!existingGRN?.data) return
    const grn = existingGRN.data
    setGrnNoPreview(grn.grn_no ?? '')
    setTouched({})
    setItemTouched({})
    setForm({
      supplier_id:      String(grn.supplier_id   ?? ''),
      grn_date:         grn.grn_date             ?? today,
      transaction_date: grn.transaction_date     ?? today,
      reference_no:     grn.reference_no         ?? '',
      shipping_code:    grn.shipping_code        ?? '',
      remarks:          grn.remarks              ?? '',
      payment_terms:    grn.payment_terms        ?? '',
      location_id:      String(grn.location_id   ?? ''),
      store_id:         String(grn.store_id      ?? ''),
    })
    if (grn.items?.length) {
      const mappedItems = grn.items.map((it) => ({
        _key:               it.id,
        po_id:              grn.po_id ?? null,
        po_no:              grn.purchase_order?.po_no ?? '',
        po_item_id:         it.po_item_id ?? null,
        product_id:         it.product_id,
        product_code:       it.product?.product_code ?? '',
        product_name:       it.product?.name ?? '',
        unit_id:            it.unit_id ?? '',
        attribute_name:     it.attribute?.name ?? '',
        attribute_id:       it.attribute_id != null ? String(it.attribute_id) : '',
        color_options:      [],
        quantity_ordered:   it.quantity_ordered,
        already_received:   null,
        remaining_qty:      null,
        quantity_received:  it.quantity_received,
        unit_price:         toPrice(it.unit_price),
        discount:           it.discount ?? '',
        tax:                it.tax      ?? '',
        is_batch:           it.product?.is_batch ?? false,
        batch_no:           it.batch_no    ?? '',
        expiry_date:        it.expiry_date ?? '',
        batch_assignments:  it.batch_assignments ?? [],
        batches:            (it.batch_assignments ?? []).map((a) => ({
          batch_no:          a.batch_no          ?? '',
          quantity:          a.quantity           ?? '',
          mfg_date:          a.mfg_date           ?? '',
          expiry_date:       a.expiry_date        ?? '',
          supplier_batch_no: a.supplier_batch_no  ?? '',
          status:            a.status             ?? 'active',
          notes:             a.notes              ?? '',
        })),
        rolls:              (it.pieces ?? []).map((p) => ({
          roll_no: p.roll_no ?? '',
          weight:  p.weight  ?? '',
        })),
      }))
      setItems(mappedItems)
      hydrateColorOptions(mappedItems)
    }
  }, [existingGRN])

  /* ── Last GRN ─────────────────────────────────────────────── */
  const { data: lastGrnData } = useQuery({
    queryKey: ['grn-last'],
    queryFn:  getLastGrn,
    enabled:  !isEdit,
  })

  useEffect(() => {
    if (!lastGrnData) return
    setLastGrnDate(lastGrnData.grn_date ?? '')
    setLastGrnAmount(
      lastGrnData.total_amount != null
        ? Number(lastGrnData.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })
        : ''
    )
  }, [lastGrnData])

  /* ── Supplier change ──────────────────────────────────────── */
  const handleSupplierChange = (supplierId) => {
    setForm((f) => ({ ...f, supplier_id: supplierId }))
    setSelectedPoIds(new Set())
    setItems((prev) => prev.filter((it) => !it.po_item_id)) // keep manual rows
    setTimeout(() => locationFieldRef.current?.focus(), 50)
  }

  /* ── PO item mapper ───────────────────────────────────────── */
  const mapPoItem = (it) => ({
    _key:              `${it.po_item_id}-${Date.now() + Math.random()}`,
    po_id:             it.po_id,
    po_no:             it.po_no ?? '',
    po_item_id:        it.po_item_id,
    product_id:        it.product_id,
    product_code:      it.product?.product_code ?? '',
    product_name:      it.product?.name ?? '',
    unit_id:           it.unit_id ?? '',
    attribute_name:    it.attribute_name ?? '',
    attribute_id:      it.attribute_id != null ? String(it.attribute_id) : '',
    color_options:     [],
    quantity_ordered:  it.quantity_ordered,
    already_received:  it.quantity_received,
    remaining_qty:     it.remaining_qty,
    quantity_received: it.remaining_qty,
    unit_price:        toPrice(it.unit_price),
    discount:          it.discount ?? '',
    tax:               it.tax      ?? '',
    is_batch:          it.product?.is_batch ?? false,
    batch_no:          '',
    expiry_date:       '',
    batches:           [],
    rolls:             [],
  })

  const loadItemsForPOs = useCallback(async (poIdSet) => {
    if (!poIdSet.size) {
      setItems((prev) => prev.filter((it) => !it.po_item_id))
      return
    }
    setLoadingItems(true)
    try {
      const data     = await getPoOutstandingItemsMultiple(Array.from(poIdSet))
      const newItems = data.map(mapPoItem)
      setItems((prev) => [
        ...prev.filter((it) => !it.po_item_id), // preserve manual rows
        ...newItems,
      ])

      // Back-fill unit_price from last GRN for items where the PO has no price
      const missingIds = [...new Set(
        newItems
          .filter((it) => !it.unit_price || parseFloat(it.unit_price) === 0)
          .map((it) => it.product_id)
      )].filter(Boolean)

      if (missingIds.length) {
        const prices = await getLastGrnProductPrices(missingIds)
        if (Object.keys(prices).length) {
          setItems((prev) => prev.map((row) => {
            if (!row.po_item_id) return row
            const last = prices[row.product_id]
            return last && (!row.unit_price || parseFloat(row.unit_price) === 0)
              ? { ...row, unit_price: toPrice(last) }
              : row
          }))
        }
      }
    } catch {
      showError('Failed to load PO items.')
    } finally {
      setLoadingItems(false)
    }
  }, [])

  const loadItemsForSinglePO = useCallback(async (poId) => {
    setLoadingItems(true)
    try {
      const data     = await getPoOutstandingItemsMultiple([poId])
      const newItems = data.map(mapPoItem)
      setItems((prev) => [...prev, ...newItems])

      // Back-fill unit_price from last GRN for items where the PO has no price
      const missingIds = [...new Set(
        newItems
          .filter((it) => !it.unit_price || parseFloat(it.unit_price) === 0)
          .map((it) => it.product_id)
      )].filter(Boolean)

      if (missingIds.length) {
        const prices = await getLastGrnProductPrices(missingIds)
        if (Object.keys(prices).length) {
          setItems((prev) => prev.map((row) => {
            if (!row.po_item_id) return row
            const last = prices[row.product_id]
            return last && (!row.unit_price || parseFloat(row.unit_price) === 0)
              ? { ...row, unit_price: toPrice(last) }
              : row
          }))
        }
      }
    } catch {
      showError('Failed to load PO items.')
    } finally {
      setLoadingItems(false)
    }
  }, [])

  const togglePO = (poId) => {
    if (selectedPoIds.has(poId)) {
      setSelectedPoIds((prev) => { const s = new Set(prev); s.delete(poId); return s })
      setItems((prev) => prev.filter((it) => it.po_id !== poId))
    } else {
      setSelectedPoIds((prev) => new Set([...prev, poId]))
      loadItemsForSinglePO(poId)
    }
  }

  const toggleAllPOs = () => {
    if (selectedPoIds.size === displayedPOs.length && displayedPOs.length > 0) {
      setSelectedPoIds(new Set())
      setItems((prev) => prev.filter((it) => !it.po_item_id))
    } else {
      const allIds = new Set(displayedPOs.map((po) => po.id))
      setSelectedPoIds(allIds)
      loadItemsForPOs(allIds)
    }
  }

  /* ── Add manual row ───────────────────────────────────────── */
  const addManualRow = useCallback(() => {
    const key = `manual-${Date.now()}-${Math.random()}`
    setItems((prev) => [...prev, {
      _key:              key,
      po_id:             null,
      po_no:             '',
      po_item_id:        null,
      product_id:        null,
      product_code:      '',
      product_name:      '',
      unit_id:           '',
      quantity_ordered:  0,
      already_received:  null,
      remaining_qty:     null,
      quantity_received: '',
      unit_price:        '',
      discount:          '',
      tax:               '',
      is_batch:          false,
      batch_no:          '',
      expiry_date:       '',
      batch_assignments: [],
      batches:           [],
      rolls:             [],
      attribute_id:      '',
      color_options:     [],
    }])
    // Auto-focus the product search input on the new row
    setTimeout(() => cellRefs.current[key]?.product?.focus(), 50)
  }, [])

  /* ── Alt+N shortcut to add a new item row ─────────────────── */
  useEffect(() => {
    const handler = (e) => {
      if (e.altKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault()
        addManualRow()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [addManualRow])

  /* ── Product search for manual rows ──────────────────────── */
  const handleProductQueryChange = (rowKey, query) => {
    setProductSearch({ key: rowKey, query, results: [], open: false })
    clearTimeout(searchTimerRef.current)

    const doFetch = async (search) => {
      try {
        const params = search ? { search, per_page: 30 } : { per_page: 100 }
        const res = await getProducts(1, params)
        setProductSearch((prev) =>
          prev.key === rowKey
            ? { ...prev, results: res.data ?? [], open: true }
            : prev
        )
      } catch { /* silent */ }
    }

    if (query === '') {
      doFetch('')              // immediate — show all on focus
    } else {
      searchTimerRef.current = setTimeout(() => doFetch(query), 300)
    }
  }

  const selectProduct = async (rowKey, product) => {
    // Default UOM from the product's first sales channel (Product creation's "Unit of Measure").
    // Editable afterward — this is just a starting guess, not a lock.
    const defaultUnitTypeId = product.cost_details?.[0]?.unit_type_id
    setItems((prev) => prev.map((row) =>
      row._key === rowKey
        ? {
            ...row,
            product_id:   product.id,
            product_code: product.product_code ?? '',
            product_name: product.name ?? '',
            unit_id:      defaultUnitTypeId != null ? String(defaultUnitTypeId) : '',
            is_batch:     product.is_batch ?? false,
            batches:      [],
            batch_no:     '',
            expiry_date:  '',
            attribute_id: '',
            color_options: [],
          }
        : row
    ))
    setProductSearch({ key: null, query: '', results: [], open: false })

    // Pre-fill unit_price from the last GRN that received this product
    try {
      const prices = await getLastGrnProductPrices([product.id])
      const last   = prices[product.id]
      if (last) {
        setItems((prev) => prev.map((row) =>
          row._key === rowKey ? { ...row, unit_price: toPrice(last) } : row
        ))
      }
    } catch { /* silent — price field stays empty */ }

    loadColorOptions(product.id).then((options) => {
      setItems((prev) => prev.map((row) => row._key === rowKey ? { ...row, color_options: options } : row))
      // Auto-focus Color once its options are ready — skip straight to UOM if this
      // product has none, since a disabled Color select can't receive focus.
      setTimeout(() => focusCell(rowKey, options.length > 0 ? 'color' : 'uom'), 50)
    })
  }

  const clearProductSelection = (rowKey) => {
    setItems((prev) => prev.map((row) =>
      row._key === rowKey
        ? { ...row, product_id: null, product_code: '', product_name: '', is_batch: false, batches: [], attribute_id: '', color_options: [] }
        : row
    ))
    setProductSearch({ key: rowKey, query: '', results: [], open: false })
  }

  /* ── Item row editing ─────────────────────────────────────── */
  const setRowField = (idx, field, value) =>
    setItems((prev) => prev.map((row, i) => i === idx ? { ...row, [field]: value } : row))

  const removeRow = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx))

  /* ── Attachment handlers ──────────────────────────────────── */
  const handleAddFiles = async (e) => {
    const incoming = Array.from(e.target.files ?? [])
    if (fileRef.current) fileRef.current.value = ''
    if (!incoming.length) return

    const rejected = incoming.filter((f) => !ALLOWED_ATTACHMENT_TYPES.test(f.type))
    if (rejected.length) {
      showError(`Only PDF and image files are allowed. Rejected: ${rejected.map((f) => f.name).join(', ')}`)
    }
    const valid = incoming.filter((f) => ALLOWED_ATTACHMENT_TYPES.test(f.type))
    if (!valid.length) return

    if (isEdit) {
      setIsUploading(true)
      try {
        await uploadGrnAttachments(id, valid)
        await refetchAttachments()
      } catch {
        showError('Failed to upload attachments.')
      } finally {
        setIsUploading(false)
      }
    } else {
      setNewFiles((prev) => {
        const existingNames = new Set(prev.map((f) => f.name))
        return [...prev, ...valid.filter((f) => !existingNames.has(f.name))]
      })
    }
  }

  const handleDeleteExisting = async (attachmentId) => {
    try {
      await deleteGrnAttachment(id, attachmentId)
      await refetchAttachments()
    } catch {
      showError('Failed to delete attachment.')
    }
  }

  /* ── Totals ───────────────────────────────────────────────── */
  const totals = items.reduce(
    (acc, r) => {
      const { gross, discAmt, taxAmt, amount } = calcItem(r)
      return { gross: acc.gross + gross, disc: acc.disc + discAmt, tax: acc.tax + taxAmt, total: acc.total + amount }
    },
    { gross: 0, disc: 0, tax: 0, total: 0 },
  )

  /* ── Save ─────────────────────────────────────────────────── */
  const saveMutation = useMutation({
    mutationFn: (payload) => isEdit
      ? updateGoodsReceivedNote(id, payload)
      : createGoodsReceivedNote(payload),
    onSuccess: async (responseData) => {
      const grnId = responseData?.data?.id ?? (isEdit ? parseInt(id) : null)

      // Upload queued attachments on create
      if (!isEdit && newFiles.length > 0 && grnId) {
        try {
          await uploadGrnAttachments(grnId, newFiles)
        } catch {
          showError('GRN saved, but failed to upload some attachments.')
        }
      }
      if (isEdit) {
        queryClient.invalidateQueries({ queryKey: ['grn-attachments', id] })
      }

      // Auto-confirm if user chose "Confirmed" status
      if (saveStatus === 'confirmed' && grnId) {
        try {
          await confirmGoodsReceivedNote(grnId)
        } catch (confirmErr) {
          const msg = confirmErr?.response?.data?.message ?? 'GRN saved but could not be confirmed.'
          showError(msg)
          navigate('/inventory/goods-received-notes')
          return
        }
      }

      showSuccess(
        saveStatus === 'confirmed'
          ? (isEdit ? 'GRN updated and confirmed.' : 'GRN created and confirmed.')
          : (isEdit ? 'GRN updated.' : 'GRN created as draft.')
      )
      navigate('/inventory/goods-received-notes')
    },
    onError: (err) => {
      const data = err.response?.data
      if (data?.errors) setErrors(data.errors)
      showError(data?.message ?? 'Failed to save GRN.')
    },
  })

  /* ── PDF download ─────────────────────────────────────────── */
  const handleDownloadPdf = async () => {
    const grnId = isEdit ? id : null
    if (!grnId) { showError('Save the GRN first before downloading the PDF.'); return }
    setIsDownloading(true)
    try {
      const blob = await downloadGrnPdf(grnId)
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `GRN_${grnNoPreview || grnId}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      showError('Failed to download PDF.')
    } finally {
      setIsDownloading(false)
    }
  }

  const handlePrintPdf = async () => {
    const grnId = isEdit ? id : null
    if (!grnId) { showError('Save the GRN first before printing.'); return }
    setIsPrinting(true)
    try {
      const blob = await downloadGrnPdf(grnId)
      printPdfBlob(blob)
    } catch {
      showError('Failed to print PDF.')
    } finally {
      setIsPrinting(false)
    }
  }

  /* ── Piece QR labels PDF ──────────────────────────────────── */
  const handlePrintPieceLabels = async () => {
    const grnId = isEdit ? id : null
    if (!grnId) return
    setIsPrintingLabels(true)
    try {
      const blob = await downloadGrnPieceLabelsPdf(grnId)
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `GRN_${grnNoPreview || grnId}_Piece_Labels.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      showError(err?.response?.data?.message || 'Failed to generate piece labels.')
    } finally {
      setIsPrintingLabels(false)
    }
  }

  const handleSubmit = () => {
    // Touch all header fields so inline errors appear
    touchAll()

    const hasHeaderErrors = Object.entries(HEADER_RULES).some(([field, rule]) => rule(form[field]))
    if (hasHeaderErrors) {
      showError('Please fill in all required fields highlighted in red.')
      return
    }
    const validItems = items.filter((r) => r.product_id && parseFloat(r.quantity_received) > 0)
    if (!validItems.length) {
      showError('Please add at least one item with a product and quantity received.')
      return
    }

    const itemsMissingUom = validItems.filter((r) => !r.unit_id)
    if (itemsMissingUom.length) {
      setItemTouched((t) => {
        const next = { ...t }
        itemsMissingUom.forEach((r) => { next[r._key] = { ...next[r._key], uom: true } })
        return next
      })
      showError('Unit of measure is required for all line items.')
      return
    }

    const payload = {
      supplier_id:      form.supplier_id      || null,
      grn_date:         form.grn_date,
      transaction_date: form.transaction_date  || null,
      reference_no:     form.reference_no     || null,
      shipping_code:    form.shipping_code.trim(),
      remarks:          form.remarks          || null,
      payment_terms:    form.payment_terms    || null,
      location_id:      parseInt(form.location_id) || null,
      store_id:         parseInt(form.store_id)    || null,
      items: validItems.map((r) => ({
        po_item_id:        r.po_item_id ? parseInt(r.po_item_id) : null,
        product_id:        parseInt(r.product_id),
        attribute_id:      r.attribute_id ? parseInt(r.attribute_id) : null,
        unit_id:           r.unit_id ? parseInt(r.unit_id) : null,
        quantity_received: parseFloat(r.quantity_received),
        unit_price:        parseFloat(r.unit_price) || 0,
        discount:          parseFloat(r.discount)   || 0,
        tax:               0, // item-wise tax feature hidden
        batch_no:          r.batch_no    || null,
        expiry_date:       r.expiry_date || null,
        batches:           r.is_batch && r.batches?.length
          ? r.batches.map((b) => ({
              batch_no:          b.batch_no,
              quantity:          parseFloat(b.quantity) || 0,
              mfg_date:          b.mfg_date          || null,
              expiry_date:       b.expiry_date        || null,
              supplier_batch_no: b.supplier_batch_no  || null,
              status:            b.status             || 'active',
              notes:             b.notes              || null,
            }))
          : [],
        rolls: r.rolls?.length
          ? r.rolls.map((roll) => ({
              roll_no: roll.roll_no,
              weight:  parseFloat(roll.weight) || 0,
            }))
          : [],
      })),
    }
    setErrors({})
    saveMutation.mutate(payload)
  }

  // Intercept the save button — prompt before confirming if batch items have no batches assigned
  const handleSaveClick = () => {
    if (saveStatus === 'confirmed') {
      const firstIdx = items.findIndex(
        (r) => r.is_batch && r.product_id && parseFloat(r.quantity_received) > 0 && (!r.batches || r.batches.length === 0)
      )
      if (firstIdx !== -1) {
        setBatchConfirmModal({ open: true, firstIdx })
        return
      }
    }
    handleSubmit()
  }

  /* ── Validation helpers ───────────────────────────────────── */
  const touch = (field) => setTouched((t) => ({ ...t, [field]: true }))
  const touchAll = () => setTouched(Object.fromEntries(Object.keys(HEADER_RULES).map((k) => [k, true])))

  // Client-side inline errors (only shown after field is touched)
  const clientErrors = Object.fromEntries(
    Object.entries(HEADER_RULES).map(([field, rule]) => [
      field,
      touched[field] ? rule(form[field]) : null,
    ])
  )

  // Merge client errors with server errors (client takes priority)
  const getErr = (field) => clientErrors[field] ?? errors[field]?.[0] ?? null

  // Deprecated alias kept for any remaining usages
  const err = getErr

  // Conditional input/select style based on error state
  const inpCls  = (field) => getErr(field) ? INPUT_ERR  : INPUT_CLS
  const selCls  = (field) => getErr(field) ? SELECT_ERR : SELECT_CLS

  // Item-level row validation
  const touchItemField = (rowKey, field) =>
    setItemTouched((t) => ({ ...t, [rowKey]: { ...t[rowKey], [field]: true } }))

  const getItemErr = (rowKey, field) => {
    if (!itemTouched[rowKey]?.[field]) return null
    const row = items.find((r) => r._key === rowKey)
    if (!row) return null
    if (field === 'uom')   return row.unit_id ? null : 'Required'
    if (field === 'qty')   return parseFloat(row.quantity_received) > 0 ? null : 'Required'
    if (field === 'price') return row.unit_price !== '' && parseFloat(row.unit_price) >= 0 ? null : 'Required'
    return null
  }

  // Rows sharing the same product + color — nudge the user to merge them instead of blocking save
  const duplicateRowNumbers = useMemo(() => {
    const groups = {}
    items.forEach((row, idx) => {
      if (!row.product_id) return
      const key = `${row.product_id}|${row.attribute_id || ''}`
      ;(groups[key] ??= []).push(idx + 1)
    })
    const result = {}
    items.forEach((row) => {
      if (!row.product_id) return
      const key = `${row.product_id}|${row.attribute_id || ''}`
      const rowNumbers = groups[key]
      if (rowNumbers.length > 1) result[row._key] = rowNumbers
    })
    return result
  }, [items])

  const allSelected = displayedPOs.length > 0 && selectedPoIds.size === displayedPOs.length

  if (isEdit && loadingGRN) {
    return <div className="flex items-center justify-center py-20 text-sm text-slate-400">Loading…</div>
  }

  return (
    <div className="w-full">
      {/* Page header */}
      <div className="mb-2 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold leading-none text-slate-800">
            {isEdit ? 'Edit GRN' : 'New Goods Received Note'}
          </h1>
          <Breadcrumb crumbs={CRUMBS} />
        </div>
      </div>

      <div className="space-y-2">

        {/* ══ 1. GRN Header ══════════════════════════════════════ */}
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <SectionHeader
            icon={ClipboardList}
            title="GRN Details"
            colorClass="text-indigo-700 bg-indigo-50 border-indigo-100"
          />
          <div className="grid grid-cols-1 gap-x-3 gap-y-1.5 p-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">

            <FieldRow label="GRN Date" required error={getErr('grn_date')}>
              <input
                type="date"
                className={inpCls('grn_date')}
                value={form.grn_date}
                onChange={(e) => setForm((f) => ({ ...f, grn_date: e.target.value }))}
                onBlur={() => touch('grn_date')}
              />
            </FieldRow>
            <FieldRow label="Transaction Date" required error={getErr('transaction_date')}>
              <input
                type="date"
                className={inpCls('transaction_date')}
                value={form.transaction_date}
                onChange={(e) => setForm((f) => ({ ...f, transaction_date: e.target.value }))}
                onBlur={() => touch('transaction_date')}
              />
            </FieldRow>

            <FieldRow label="GRN Number" required>
              <input
                type="text"
                className={INPUT_RO}
                value={isEdit ? grnNoPreview : (grnNoPreview || 'Auto-generated')}
                readOnly
                tabIndex={-1}
              />
            </FieldRow>
            <FieldRow label="Reference Number">
              <input
                type="text"
                className={INPUT_CLS}
                placeholder="e.g. REF-0001"
                value={form.reference_no}
                onChange={(e) => setForm((f) => ({ ...f, reference_no: e.target.value }))}
              />
            </FieldRow>

            <FieldRow label="Last GRN Date">
              <input type="text" className={INPUT_RO} value={lastGrnDate || '—'} readOnly tabIndex={-1} />
            </FieldRow>
            <FieldRow label="Last GRN Amount">
              <input type="text" className={INPUT_RO} value={lastGrnAmount || '—'} readOnly tabIndex={-1} />
            </FieldRow>

            <FieldRow label="Supplier Code/Name" required error={getErr('supplier_id')}>
              <select
                className={selCls('supplier_id')}
                value={form.supplier_id}
                onChange={(e) => handleSupplierChange(e.target.value)}
                onBlur={() => touch('supplier_id')}
              >
                <option value="">Select</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.supplier_code ? `${s.supplier_code} — ` : ''}{s.supplier_name ?? s.name}
                  </option>
                ))}
              </select>
            </FieldRow>

            <FieldRow label="Location" required error={getErr('location_id')}>
              <FormDropdown
                cellRef={(el) => { locationFieldRef.current = el }}
                value={form.location_id}
                groups={[{ label: null, items: locations.map((l) => ({ value: String(l.id), label: l.location_name })) }]}
                onChange={(val) => setForm((f) => ({ ...f, location_id: val, store_id: '' }))}
                onNext={() => storeFieldRef.current?.focus()}
                onBlur={() => touch('location_id')}
                error={getErr('location_id')}
              />
            </FieldRow>

            <FieldRow label="Store" required error={getErr('store_id')}>
              <FormDropdown
                cellRef={(el) => { storeFieldRef.current = el }}
                value={form.store_id}
                groups={[{ label: null, items: storesForLocation.map((s) => ({ value: String(s.id), label: s.store_name })) }]}
                onChange={(val) => setForm((f) => ({ ...f, store_id: val }))}
                onNext={() => shippingCodeFieldRef.current?.focus()}
                onBlur={() => touch('store_id')}
                disabled={!form.location_id}
                placeholder={form.location_id ? 'Select' : 'Select location first'}
                error={getErr('store_id')}
              />
            </FieldRow>

            <FieldRow label="Payment Terms">
              <select
                className={SELECT_CLS}
                value={form.payment_terms}
                onChange={(e) => setForm((f) => ({ ...f, payment_terms: e.target.value }))}
              >
                <option value="">Select</option>
                <option value="immediate">Immediate</option>
                <option value="net_15">Net 15</option>
                <option value="net_30">Net 30</option>
                <option value="net_45">Net 45</option>
                <option value="net_60">Net 60</option>
                <option value="net_90">Net 90</option>
                <option value="cod">Cash on Delivery</option>
              </select>
            </FieldRow>
            <FieldRow label="Remarks">
              <input
                className={INPUT_CLS}
                placeholder="Optional notes"
                value={form.remarks}
                onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
              />
            </FieldRow>
            <FieldRow label="Shipping Code" required error={getErr('shipping_code')}>
              <input
                ref={shippingCodeFieldRef}
                className={inpCls('shipping_code')}
                placeholder="e.g. SHP-0001"
                value={form.shipping_code}
                onChange={(e) => setForm((f) => ({ ...f, shipping_code: e.target.value }))}
                onBlur={() => touch('shipping_code')}
              />
            </FieldRow>

            {/* ── Attachments — spans remaining 3 cols on xl ─────── */}
            <div className="xl:col-span-3 flex flex-col gap-0.5 min-w-0">
              <span className={LABEL_CLS}>Attachments</span>
              <div className="flex flex-wrap items-center gap-1 min-h-[26px]">

                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={isUploading}
                  className="flex shrink-0 items-center gap-1 rounded border border-dashed border-slate-300 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors disabled:opacity-50"
                >
                  <Plus size={9} />
                  {isUploading ? 'Uploading…' : 'Add'}
                </button>
                <input ref={fileRef} type="file" multiple accept="image/*,.pdf" className="hidden" onChange={handleAddFiles} />

                {isEdit && isAttachmentsLoading ? (
                  <span className="text-[10px] italic text-slate-400 animate-pulse">Loading…</span>
                ) : (
                  <>
                    {existingFiles.map((att) => {
                      const isImg = att.mime_type?.startsWith('image/')
                      return (
                        <div key={att.id} className="relative group/chip">
                          <div className="flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 transition hover:border-indigo-200 hover:bg-indigo-50 cursor-default">
                            {isImg ? (
                              <img src={att.url} alt={att.file_name} className="h-5 w-5 shrink-0 rounded object-cover" />
                            ) : (
                              <FileText size={11} className="shrink-0 text-red-400" />
                            )}
                            <span className="max-w-20 truncate text-[10px] text-slate-700 group-hover/chip:text-indigo-700">{att.file_name}</span>
                            <a href={att.url} target="_blank" rel="noreferrer" title="Download" className="shrink-0 text-slate-300 hover:text-indigo-500 transition-colors">
                              <Download size={9} strokeWidth={2} />
                            </a>
                            <button type="button" onClick={() => handleDeleteExisting(att.id)} title="Remove" className="shrink-0 text-slate-300 hover:text-red-500 transition-colors">
                              <X size={9} />
                            </button>
                          </div>
                          <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden w-64 -translate-x-1/2 group-hover/chip:block">
                            <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-2xl ring-1 ring-slate-100">
                              {isImg ? (
                                <div className="flex min-h-40 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                                  <img src={att.url} alt={att.file_name} className="max-h-56 max-w-full object-contain" />
                                </div>
                              ) : (
                                <div className="flex h-28 items-center justify-center rounded-lg bg-slate-50 border border-slate-100">
                                  <FileText size={40} className="text-red-400" />
                                </div>
                              )}
                              <p className="mt-2 truncate text-[11px] font-semibold text-slate-800">{att.file_name}</p>
                              {att.file_size ? <p className="text-[10px] text-slate-400">{formatFileSize(att.file_size)}</p> : null}
                            </div>
                          </div>
                        </div>
                      )
                    })}

                    {newFiles.map((file, idx) => {
                      const isImg = file.type.startsWith('image/')
                      const objUrl = isImg ? URL.createObjectURL(file) : null
                      return (
                        <div key={`new-${idx}`} className="relative group/newchip">
                          <div className="flex items-center gap-1 rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 transition cursor-default">
                            {isImg ? (
                              <img src={objUrl} alt={file.name} className="h-5 w-5 shrink-0 rounded object-cover" />
                            ) : (
                              <FileText size={11} className="shrink-0 text-red-400" />
                            )}
                            <span className="max-w-20 truncate text-[10px] text-indigo-700">{file.name}</span>
                            <button type="button" onClick={() => setNewFiles((p) => p.filter((_, i) => i !== idx))} title="Remove" className="shrink-0 text-indigo-300 hover:text-red-500 transition-colors">
                              <X size={9} />
                            </button>
                          </div>
                          {isImg && (
                            <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden w-64 -translate-x-1/2 group-hover/newchip:block">
                              <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-2xl ring-1 ring-slate-100">
                                <div className="flex min-h-40 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                                  <img src={objUrl} alt={file.name} className="max-h-56 max-w-full object-contain" />
                                </div>
                                <p className="mt-2 truncate text-[11px] font-semibold text-slate-800">{file.name}</p>
                                <p className="text-[10px] text-slate-400">{formatFileSize(file.size)}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {existingFiles.length === 0 && newFiles.length === 0 && (
                      <span className="text-[10px] italic text-slate-400">No files yet</span>
                    )}
                  </>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* ══ 2. Purchase Order Selection Table (Optional) ═══════ */}
        {!isEdit && (
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <SectionHeader
              icon={ShoppingCart}
              title="Select Purchase Orders (Optional)"
              colorClass="text-violet-700 bg-violet-50 border-violet-100"
              extra={
                selectedPoIds.size > 0 && (
                  <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white">
                    {selectedPoIds.size} selected
                  </span>
                )
              }
            />

            {!form.supplier_id ? (
              <div className="py-5 text-center text-xs text-slate-400">
                Select a supplier above to see available POs, or skip this section and add items manually below.
              </div>
            ) : loadingPOs ? (
              <div className="py-5 text-center text-xs text-slate-400">Loading Purchase Orders…</div>
            ) : displayedPOs.length === 0 ? (
              <div className="py-5 text-center text-xs text-slate-400">
                No confirmed or partially-received POs found for this supplier — add items manually below.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-left">
                      <th className="w-8 px-3 py-1.5">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 text-indigo-600 cursor-pointer"
                          checked={allSelected}
                          onChange={toggleAllPOs}
                        />
                      </th>
                      <th className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">PO No.</th>
                      <th className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Date</th>
                      <th className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Supplier</th>
                      <th className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</th>
                      <th className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-right">Amount</th>
                      <th className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-right">Items</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayedPOs.map((po) => {
                      const isSelected = selectedPoIds.has(po.id)
                      return (
                        <tr
                          key={po.id}
                          className={`cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50/60' : 'hover:bg-slate-50'}`}
                          onClick={() => togglePO(po.id)}
                        >
                          <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              className="rounded border-slate-300 text-indigo-600 cursor-pointer"
                              checked={isSelected}
                              onChange={() => togglePO(po.id)}
                            />
                          </td>
                          <td className="px-3 py-1.5 font-semibold text-indigo-700">{po.po_no}</td>
                          <td className="px-3 py-1.5 text-slate-500">{po.po_date ?? po.created_at?.slice(0, 10) ?? '—'}</td>
                          <td className="px-3 py-1.5 text-slate-700 max-w-45 truncate">{po.supplier?.name ?? '—'}</td>
                          <td className="px-3 py-1.5">
                            <StatusBadge label={po.status_label ?? po.status} value={po.status} />
                          </td>
                          <td className="px-3 py-1.5 text-right text-slate-700 font-medium">
                            {po.total_amount != null
                              ? Number(po.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })
                              : '—'}
                          </td>
                          <td className="px-3 py-1.5 text-right text-slate-500">
                            {po.items_count ?? po.items?.length ?? '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ══ 3. Received Items Table ═════════════════════════════ */}
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <SectionHeader
            icon={PackageCheck}
            title="Received Items"
            colorClass="text-blue-700 bg-blue-50 border-blue-100"
            extra={
              <div className="flex items-center gap-2">
                {loadingItems
                  ? <span className="text-[10px] text-blue-400 italic">Loading items…</span>
                  : items.length > 0
                    ? <span className="text-[10px] text-slate-500">{items.length} line{items.length !== 1 ? 's' : ''}</span>
                    : null}
                <button
                  type="button"
                  onClick={addManualRow}
                  title="Add new item (Alt+N)"
                  className="flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  <Plus size={10} />
                  Add Item
                  <span className="ml-0.5 rounded bg-blue-100 px-1 py-px text-[9px] font-mono text-blue-500">Alt+N</span>
                </button>
              </div>
            }
          />

          {items.length === 0 && !loadingItems ? (
            <div className="py-8 text-center text-sm text-slate-400">
              {isEdit
                ? 'No items found.'
                : 'Select a PO above to load items, or click "+ Add Item" to add items manually.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 text-left border-b border-slate-200">
                    <th className="w-8 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">#</th>
                    <th className="w-24 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Code</th>
                    <th className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Product</th>
                    <th className="w-20 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Color</th>
                    <th className="w-20 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-right">PO Qty</th>
                    <th className="w-20 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 text-right">Pending Qty</th>
                    <th className="w-20 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">UOM</th>
                    <th className="w-28 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Qty Received</th>
                    <th className="w-24 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Rolls</th>
                    <th className="w-24 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Unit Price</th>
                    <th className="w-20 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 text-center">Disc %</th>
                    <th className="w-20 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Batch</th>
                    <th className="w-24 px-2 py-1.5 text-[10px] text-right font-bold uppercase tracking-wider text-slate-500">Total</th>
                    <th className="w-8 px-2 py-1.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((row, idx) => {
                    const { amount } = calcItem(row)
                    const isManual = !row.po_item_id
                    return (
                      <tr key={row._key} className={`hover:bg-slate-50/60 transition-colors ${isManual ? 'bg-green-50/20' : ''}`}>

                        {/* # */}
                        <td className="px-3 py-1 text-slate-400">{idx + 1}</td>

                        {/* Code — read-only for both PO and manual (populated after product select) */}
                        <td className="px-2 py-1 font-mono text-slate-500 text-[10px]">
                          {row.product_code || <span className="text-slate-300">—</span>}
                        </td>

                        {/* Product — searchable for manual rows, display for PO rows */}
                        <td className="px-2 py-1 min-w-[180px]">
                          {isManual ? (
                            <ProductSearchCell
                              row={row}
                              productSearch={productSearch}
                              onQueryChange={handleProductQueryChange}
                              onSelect={selectProduct}
                              onClear={clearProductSelection}
                              onClose={() => setProductSearch((prev) => ({ ...prev, open: false }))}
                              onInputRef={setCellRef(row._key, 'product')}
                            />
                          ) : (
                            <span className="font-medium text-slate-700">{row.product_name || '—'}</span>
                          )}
                          {duplicateRowNumbers[row._key] && (
                            <span className="mt-0.5 flex items-center gap-1 text-[9px] font-medium text-amber-600">
                              <AlertTriangle size={10} />
                              Same product &amp; color as row {duplicateRowNumbers[row._key].filter((n) => n !== idx + 1).join(', ')} — consider merging
                            </span>
                          )}
                        </td>

                        {/* Color — PO-linked rows inherit it read-only from the linked PO line;
                            manual rows have no PO item to inherit from, so pick it directly here. */}
                        <td className="px-2 py-1">
                          {isManual ? (
                            <FormDropdown
                              compact
                              cellRef={setCellRef(row._key, 'color')}
                              value={row.attribute_id}
                              groups={[{ label: null, items: row.color_options.map((c) => ({ value: String(c.id), label: c.name })) }]}
                              onChange={(val) => setRowField(idx, 'attribute_id', val)}
                              onNext={() => focusCell(row._key, 'uom')}
                              placeholder={!row.product_id ? '—' : row.color_options.length === 0 ? 'No colors' : '—'}
                              disabled={!row.product_id || row.color_options.length === 0}
                            />
                          ) : (
                            <span className="text-slate-600">{row.attribute_name || <span className="text-slate-300">—</span>}</span>
                          )}
                        </td>

                        {/* PO Qty */}
                        <td className="px-2 py-1 text-right text-slate-500">
                          {isManual ? <span className="text-slate-300">—</span> : Number(row.quantity_ordered).toLocaleString()}
                        </td>

                        {/* Pending Qty */}
                        <td className="px-2 py-1 text-right">
                          {isManual ? (
                            <span className="text-slate-300">—</span>
                          ) : row.remaining_qty != null ? (
                            <span className={`font-semibold text-xs ${row.already_received > 0 ? 'text-amber-600' : 'text-slate-500'}`}>
                              {Number(row.remaining_qty).toLocaleString()}
                              {row.already_received > 0 && (
                                <span className="block text-[9px] font-normal text-slate-400">
                                  Prev: {Number(row.already_received).toLocaleString()}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        {/* UOM */}
                        <td className="px-2 py-1">
                          <div className="flex flex-col gap-0.5">
                            <FormDropdown
                              compact
                              cellRef={setCellRef(row._key, 'uom')}
                              value={row.unit_id ?? ''}
                              groups={Object.values(uomGroups).map((group) => ({
                                label: group.name,
                                items: group.items.map((u) => ({ value: String(u.id), label: u.symbol ?? u.name })),
                              }))}
                              onChange={(val) => setRowField(idx, 'unit_id', val)}
                              onNext={() => focusCell(row._key, 'qty')}
                              onBlur={() => touchItemField(row._key, 'uom')}
                              error={getItemErr(row._key, 'uom')}
                            />
                            {getItemErr(row._key, 'uom') && (
                              <span className="text-[9px] text-red-500 leading-none">Required</span>
                            )}
                          </div>
                        </td>

                        {/* Qty Received */}
                        <td className="px-2 py-1">
                          <div className="flex flex-col gap-0.5">
                            <input
                              ref={setCellRef(row._key, 'qty')}
                              type="number" min="0" step="0.0001"
                              max={!isManual && row.remaining_qty != null ? row.remaining_qty : undefined}
                              className={(getItemErr(row._key, 'qty') ? TABLE_ERR : TABLE_INPUT) + ' w-24'}
                              value={row.quantity_received}
                              onChange={(e) => setRowField(idx, 'quantity_received', e.target.value)}
                              onBlur={() => touchItemField(row._key, 'qty')}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') { e.preventDefault(); focusCell(row._key, 'rolls') }
                              }}
                            />
                            {getItemErr(row._key, 'qty') && (
                              <span className="text-[9px] text-red-500 leading-none">{getItemErr(row._key, 'qty')}</span>
                            )}
                          </div>
                        </td>

                        {/* Rolls */}
                        <td className="px-2 py-1">
                          <button
                            ref={setCellRef(row._key, 'rolls')}
                            type="button"
                            onClick={() => setRollModalIdx(idx)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') { e.preventDefault(); focusCell(row._key, 'price') }
                            }}
                            className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                              row.rolls?.length
                                ? 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                                : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                            }`}
                          >
                            <Weight size={10} />
                            {row.rolls?.length
                              ? `${row.rolls.length} roll${row.rolls.length !== 1 ? 's' : ''}`
                              : 'Add Rolls'}
                          </button>
                        </td>

                        {/* Unit Price */}
                        <td className="px-2 py-1">
                          <div className="flex flex-col gap-0.5">
                            <input
                              ref={setCellRef(row._key, 'price')}
                              type="number" min="0" step="0.01"
                              className={(getItemErr(row._key, 'price') ? TABLE_ERR : TABLE_INPUT) + ' w-20'}
                              value={row.unit_price}
                              onChange={(e) => setRowField(idx, 'unit_price', e.target.value)}
                              onBlur={() => touchItemField(row._key, 'price')}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') { e.preventDefault(); focusCell(row._key, 'disc') }
                              }}
                            />
                            {getItemErr(row._key, 'price') && (
                              <span className="text-[9px] text-red-500 leading-none">{getItemErr(row._key, 'price')}</span>
                            )}
                          </div>
                        </td>

                        {/* Disc% */}
                        <td className="px-2 py-1">
                          <input
                            ref={setCellRef(row._key, 'disc')}
                            type="number" min="0" max="100" step="0.01" placeholder="0"
                            className="block w-full rounded border border-amber-200 bg-amber-50/50 px-1.5 py-0.5 text-xs text-slate-800 outline-none transition-all focus:border-amber-400 focus:bg-white"
                            value={row.discount}
                            onChange={(e) => setRowField(idx, 'discount', e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                if (row.is_batch) focusCell(row._key, 'batch')
                              }
                            }}
                          />
                        </td>

                        {/* Batch */}
                        <td className="px-2 py-1">
                          {row.is_batch ? (
                            <button
                              ref={setCellRef(row._key, 'batch')}
                              type="button"
                              onClick={() => setBatchModalIdx(idx)}
                              className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                                row.batches?.length
                                  ? 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                                  : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                              }`}
                            >
                              <Layers size={10} />
                              {row.batches?.length
                                ? `${row.batches.length} batch${row.batches.length !== 1 ? 'es' : ''}`
                                : 'Assign'}
                            </button>
                          ) : <span className="text-slate-300 italic px-2">—</span>}
                        </td>

                        {/* Total */}
                        <td className="px-2 py-1 text-right font-bold text-slate-800 tabular-nums">
                          {amount > 0 ? amount.toLocaleString(undefined, { minimumFractionDigits: 2 }) : <span className="text-slate-300 font-normal">—</span>}
                        </td>

                        {/* Delete */}
                        <td className="px-2 py-1 text-center">
                          <button
                            type="button"
                            onClick={() => removeRow(idx)}
                            className="rounded p-0.5 text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50/50">
                    <td colSpan={10} />
                    <td className="px-1.5 py-1.5 text-center text-xs font-bold text-amber-600 tabular-nums">
                      -{totals.disc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td colSpan={1} />
                    <td className="px-2 py-1.5 text-right text-sm font-black text-slate-800 tabular-nums">
                      {totals.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td />
                  </tr>
                  <tr className="bg-indigo-50 border-t border-indigo-100">
                    <td colSpan={12} className="px-3 py-1.5">
                      <div className="flex items-center gap-4 text-xs">
                        <span className="font-bold uppercase tracking-wider text-indigo-600">Summary</span>
                        <span className="text-slate-500">Gross: <span className="font-bold text-slate-700">{totals.gross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></span>
                        <span className="text-amber-600">Disc: <span className="font-bold">-{totals.disc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></span>
                      </div>
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <div className="flex flex-col items-end leading-tight">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">Net Total</span>
                        <span className="text-base font-black text-indigo-700 tabular-nums">
                          {totals.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-3 py-2">

            {/* Left: PDF download + Piece labels (edit mode only) */}
            <div className="flex items-center gap-2">
              {isEdit && (
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={isDownloading}
                  className="flex items-center gap-1.5 rounded border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors disabled:opacity-60"
                >
                  <Download size={12} />
                  {isDownloading ? 'Generating…' : 'Download PDF'}
                </button>
              )}
              {isEdit && (
                <button
                  type="button"
                  onClick={handlePrintPdf}
                  disabled={isPrinting}
                  className="flex items-center gap-1.5 rounded border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-60"
                >
                  <Printer size={12} />
                  {isPrinting ? 'Preparing…' : 'Print'}
                </button>
              )}
              {isEdit && existingGRN?.data?.status === 'confirmed' && (
                <button
                  type="button"
                  onClick={handlePrintPieceLabels}
                  disabled={isPrintingLabels}
                  className="flex items-center gap-1.5 rounded border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors disabled:opacity-60"
                >
                  <QrCode size={12} />
                  {isPrintingLabels ? 'Generating…' : 'Print Piece Labels'}
                </button>
              )}
            </div>

            {/* Right: Change Status + divider + Cancel + Save */}
            <div className="flex items-center gap-3">

              {/* Change Status labelled dropdown */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">
                  Change Status
                </span>
                <select
                  value={saveStatus}
                  onChange={(e) => setSaveStatus(e.target.value)}
                  className="rounded border-2 border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-800 outline-none transition-all focus:border-indigo-500 focus:bg-white cursor-pointer"
                >
                  <option value="draft">Draft</option>
                  <option value="confirmed">Confirmed</option>
                </select>
              </div>

              <div className="h-5 w-px bg-slate-200" />

              <button
                type="button"
                onClick={() => navigate('/inventory/goods-received-notes')}
                className="rounded border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saveMutation.isPending || items.length === 0}
                onClick={handleSaveClick}
                className="rounded bg-indigo-600 px-4 py-1 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
              >
                {saveMutation.isPending
                  ? 'Saving…'
                  : isEdit
                    ? (saveStatus === 'confirmed' ? 'Update & Confirm' : 'Update GRN')
                    : (saveStatus === 'confirmed' ? 'Create & Confirm' : 'Save as Draft')}
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Keyboard Shortcuts Reference */}
      <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Keyboard Shortcuts</p>
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          {[
            { keys: ['Alt', 'N'],   desc: 'Add new item row' },
            { keys: ['Enter'],      desc: 'Move to next field in row (UOM → Qty → Rolls → Price → Disc → Batch)' },
            { keys: ['↑', '↓'],    desc: 'Navigate product search results' },
            { keys: ['Esc'],        desc: 'Close product search dropdown' },
          ].map(({ keys, desc }) => (
            <div key={desc} className="flex items-center gap-1.5">
              <div className="flex items-center gap-0.5">
                {keys.map((k, i) => (
                  <span key={i} className="inline-flex items-center justify-center rounded border border-slate-300 bg-white px-1 py-px text-[10px] font-mono font-semibold text-slate-600 shadow-sm">
                    {k}
                  </span>
                ))}
              </div>
              <span className="text-[10px] text-slate-500">{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Batch Confirmation Dialog */}
      {batchConfirmModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-amber-100">
                <Layers size={18} className="text-amber-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Batch Assignment</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  One or more items are batch-tracked but have no batches assigned yet.
                  Do you want to create batches now?
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setBatchConfirmModal({ open: false, firstIdx: null })
                  handleSubmit()
                }}
                className="rounded border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
              >
                No, Continue
              </button>
              <button
                type="button"
                onClick={() => {
                  const idx = batchConfirmModal.firstIdx
                  setBatchConfirmModal({ open: false, firstIdx: null })
                  setBatchModalIdx(idx)
                }}
                className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700"
              >
                Yes, Assign Batches
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Assignment Modal */}
      {batchModalIdx !== null && items[batchModalIdx] && (
        <BatchAssignModal
          item={items[batchModalIdx]}
          onApply={(assignedBatches) => {
            setItems((prev) => prev.map((row, i) => i === batchModalIdx
              ? {
                  ...row,
                  batches:     assignedBatches,
                  batch_no:    assignedBatches[0]?.batch_no    ?? row.batch_no,
                  expiry_date: assignedBatches[0]?.expiry_date ?? row.expiry_date,
                }
              : row
            ))
            setBatchModalIdx(null)
          }}
          onClose={() => setBatchModalIdx(null)}
        />
      )}

      {/* Roll Assignment Modal */}
      {rollModalIdx !== null && items[rollModalIdx] && (
        <RollAssignModal
          item={items[rollModalIdx]}
          isWeightUnit={unitTypes.find((u) => u.id === Number(items[rollModalIdx].unit_id))?.unit_category_name === 'Weight'}
          onApply={(rolls) => {
            const rowKey = items[rollModalIdx]._key
            setItems((prev) => prev.map((row, i) => i === rollModalIdx ? { ...row, rolls } : row))
            setRollModalIdx(null)
            setTimeout(() => focusCell(rowKey, 'price'), 50)
          }}
          onClose={() => setRollModalIdx(null)}
        />
      )}
    </div>
  )
}
