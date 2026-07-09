import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { QrCode } from 'lucide-react'
import { downloadPieceLabelsPdf, getPieceLabels, getShippingCodes } from '../../api/pieceLabels'
import { getAllProducts, getProduct } from '../../api/products'
import { getAllAttributeTypes } from '../../api/attributeTypes'
import { getAllAttributes } from '../../api/attributes'
import Breadcrumb from '../../components/Breadcrumb'
import TableFilter, { FilterField } from '../../components/TableFilter'
import FilterSearchSelect from '../../components/ui/FilterSearchSelect'
import { PdfBtn, PrintBtn } from '../../components/ui/ActionButtons'
import { useTableFilter } from '../../hooks/useTableFilter'
import { printPdfBlob } from '../../utils/pdf'
import { showError } from '../../utils/alerts'

const CRUMBS = [
  { label: 'Inventory', to: '/inventory/goods-received-notes' },
  { label: 'Print Piece Labels' },
]

const INITIAL_FILTERS = {
  product_id: '',
  shipping_code: '',
  attribute_id: '',
}

// "Color" or "Colour" — attribute-type spelling varies by who entered the master data.
function isColorAttributeTypeName(name) {
  const n = (name || '').trim().toLowerCase()
  return n === 'color' || n === 'colour'
}

const hasAnyFilter = (f) => Boolean(f.product_id || f.shipping_code || f.attribute_id)

// Strip empty filters so the backend's required_without_all validation sees only real values
const cleanFilters = (f) =>
  Object.fromEntries(Object.entries(f).filter(([, v]) => v !== '' && v != null))

export default function PrintPieceLabelsPage() {
  const [exportBusy, setExportBusy] = useState(null) // 'print' | 'pdf'

  const { open, toggle, draft, setDraft, applied, apply, clear, activeCount } =
    useTableFilter(INITIAL_FILTERS)

  const { data: productsData } = useQuery({
    queryKey: ['products-all'],
    queryFn: getAllProducts,
    staleTime: Infinity,
  })
  const productOptions = (productsData ?? []).map((p) => ({
    value: p.id,
    label: p.product_code ? `[${p.product_code}] ${p.name}` : p.name,
  }))

  const { data: shippingCodesData } = useQuery({
    queryKey: ['piece-label-shipping-codes'],
    queryFn: getShippingCodes,
    staleTime: 5 * 60 * 1000,
  })
  const shippingCodeOptions = (shippingCodesData ?? []).map((c) => ({ value: c, label: c }))

  const { data: attributeTypes = [] } = useQuery({ queryKey: ['attribute-types-all'], queryFn: getAllAttributeTypes })
  const { data: allAttributes = [] }  = useQuery({ queryKey: ['attributes-all'],      queryFn: getAllAttributes })
  const colorTypeIds = new Set(
    attributeTypes.filter((t) => isColorAttributeTypeName(t.attribute_type_name)).map((t) => String(t.id))
  )

  // Colors are scoped to the SELECTED PRODUCT's own "Product Attributes" (same
  // rule as the GRN form) — no product selected means no colors to offer.
  const { data: productDetail } = useQuery({
    queryKey: ['product', draft.product_id],
    queryFn: () => getProduct(draft.product_id),
    enabled: Boolean(draft.product_id),
    staleTime: 5 * 60 * 1000,
  })
  const colorOptions = draft.product_id
    ? (productDetail?.data?.product_attributes ?? [])
        .filter((pa) => colorTypeIds.has(String(pa.attribute_type_id)))
        .map((pa) => allAttributes.find((a) => String(a.id) === String(pa.attribute_id)))
        .filter(Boolean)
        .map((a) => ({ value: a.id, label: a.attribute_name }))
    : []

  const { data, isLoading, isError } = useQuery({
    queryKey: ['piece-labels', applied],
    queryFn: () => getPieceLabels(cleanFilters(applied)),
    enabled: hasAnyFilter(applied),
    placeholderData: (prev) => prev,
  })
  const labels = data?.labels ?? []

  const handleApply = () => {
    if (!hasAnyFilter(draft)) {
      showError('Select at least one filter — Product, Shipping Code or Color.')
      return
    }
    apply()
  }

  const handleExport = async (action) => {
    setExportBusy(action)
    try {
      const blob = await downloadPieceLabelsPdf(cleanFilters(applied))
      if (action === 'print') {
        printPdfBlob(blob)
      } else {
        const url = URL.createObjectURL(blob)
        const a   = document.createElement('a')
        a.href     = url
        a.download = 'Piece_Labels.pdf'
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch {
      showError(`Failed to ${action === 'print' ? 'print' : 'download'} the piece labels.`)
    } finally {
      setExportBusy(null)
    }
  }

  const exportsDisabled = !hasAnyFilter(applied) || labels.length === 0 || Boolean(exportBusy)

  return (
    <div className="w-full">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <QrCode size={18} className="text-indigo-500" />
            <h1 className="text-xl font-bold leading-none text-slate-800">Print Piece Labels</h1>
          </div>
          <Breadcrumb crumbs={CRUMBS} />
        </div>
        <div className="flex items-center gap-1.5">
          <PrintBtn onClick={() => handleExport('print')} disabled={exportsDisabled} title="Print labels" />
          <PdfBtn onClick={() => handleExport('pdf')} disabled={exportsDisabled} title="Download PDF" />
        </div>
      </div>

      <TableFilter open={open} onToggle={toggle} onApply={handleApply} onClear={() => clear()} activeCount={activeCount}>
        <FilterField label="Product">
          <FilterSearchSelect
            value={draft.product_id}
            onChange={(val) => setDraft((d) => ({ ...d, product_id: val, attribute_id: '' }))}
            options={productOptions} wide
            placeholder="All products"
          />
        </FilterField>
        <FilterField label="Shipping Code">
          <FilterSearchSelect
            value={draft.shipping_code}
            onChange={(val) => setDraft((d) => ({ ...d, shipping_code: val }))}
            options={shippingCodeOptions}
            placeholder="All shipping codes"
          />
        </FilterField>
        <FilterField label="Color">
          <FilterSearchSelect
            value={draft.attribute_id}
            onChange={(val) => setDraft((d) => ({ ...d, attribute_id: val }))}
            options={colorOptions}
            placeholder={draft.product_id ? 'All colors' : 'Select product first'}
          />
        </FilterField>
      </TableFilter>

      {!hasAnyFilter(applied) ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-400 shadow-sm">
          Select a Product, Shipping Code or Color in the filters above to load the QR piece labels.
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white shadow-sm">
          {isLoading && <div className="flex items-center justify-center py-14 text-sm text-slate-400">Loading labels…</div>}
          {isError && <div className="flex items-center justify-center py-14 text-sm text-red-500">Failed to load piece labels.</div>}

          {!isLoading && !isError && (
            labels.length === 0 ? (
              <div className="py-16 text-center text-sm text-slate-400">
                No sealed pieces found for the selected filters. Only confirmed GRNs have printable piece labels.
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                  <span className="text-xs font-semibold text-slate-600">
                    {labels.length} label{labels.length !== 1 ? 's' : ''} found
                    {data?.truncated && <span className="ml-1 font-normal text-amber-600">(showing first {labels.length} — narrow your filters)</span>}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {labels.map((label) => (
                    <div key={label.id} className="flex flex-col items-center rounded border border-dashed border-slate-300 p-2 text-center">
                      <img src={label.qr_data_uri} alt={label.piece_code} className="h-24 w-24" />
                      <div className="mt-1 font-mono text-[10px] font-bold text-slate-800">{label.piece_code}</div>
                      <div className="line-clamp-1 text-[10px] text-slate-500" title={label.product_name}>{label.product_name}</div>
                      <div className="text-[10px] text-slate-500">
                        {label.color && <span className="mr-1">Color: {label.color}</span>}
                        {label.roll_no && <span>Roll: {label.roll_no}</span>}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {label.weight != null && <span className="mr-1">Wt: {Number(label.weight).toFixed(2)}</span>}
                        {label.batch_no && <span>Batch: {label.batch_no}</span>}
                      </div>
                      <div className="text-[10px] text-slate-400">{label.grn_no}{label.shipping_code ? ` · ${label.shipping_code}` : ''}</div>
                    </div>
                  ))}
                </div>
              </>
            )
          )}
        </div>
      )}
    </div>
  )
}
