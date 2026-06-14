import { ChevronDown, ChevronUp, Filter, X } from 'lucide-react'

/**
 * Reusable collapsible filter panel for data tables.
 *
 * Props:
 *   open        — boolean, whether the panel is expanded
 *   onToggle    — fn, flip open/closed
 *   onApply     — fn, commit draft filters and fetch
 *   onClear     — fn, reset all filters
 *   activeCount — number of currently applied filter values (shown as badge)
 *   children    — filter input fields (rendered inside the panel grid)
 *
 * Consumers own their filter state; this component is presentational only.
 *
 * Example:
 *   <TableFilter open={open} onToggle={toggle} onApply={() => apply(resetPage)}
 *                onClear={() => clear(resetPage)} activeCount={activeCount}>
 *     <FilterField label="Search">
 *       <input value={draft.search} onChange={e => setDraft(d => ({...d, search: e.target.value}))} />
 *     </FilterField>
 *   </TableFilter>
 */
export default function TableFilter({ open, onToggle, onApply, onClear, activeCount = 0, children }) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') onApply()
  }

  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-white shadow-sm">
      {/* ── toggle bar ── */}
      <div className="flex items-center justify-between px-3 py-2">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-800"
        >
          <Filter size={13} className="text-slate-400" />
          <span>Filters</span>
          {activeCount > 0 && (
            <span className="rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
              {activeCount}
            </span>
          )}
          {open ? (
            <ChevronUp size={12} className="text-slate-400" />
          ) : (
            <ChevronDown size={12} className="text-slate-400" />
          )}
        </button>

        {activeCount > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="flex items-center gap-1 text-[11px] text-slate-400 transition-colors hover:text-red-500"
          >
            <X size={11} />
            Clear all
          </button>
        )}
      </div>

      {/* ── collapsible body ── */}
      {open && (
        <div className="border-t border-slate-100 px-3 pb-3 pt-2.5" onKeyDown={handleKeyDown}>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {children}
          </div>

          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClear}
              className="rounded px-3 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={onApply}
              className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-indigo-700"
            >
              Apply Filter
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * A single labelled filter field slot — keeps label + input visually consistent.
 *
 * Props:
 *   label    — string label above the input
 *   children — the actual <input>, <select>, etc.
 */
export function FilterField({ label, children }) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </label>
      {children}
    </div>
  )
}
