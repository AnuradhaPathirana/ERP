import { ChevronDown, ChevronUp, Filter, Search, X } from 'lucide-react'

export default function TableFilter({ open, onToggle, onApply, onClear, activeCount = 0, children }) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') onApply()
  }

  return (
    <div className="mt-2 rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* ── toggle bar ── */}
      <div className="flex items-center justify-between px-3 py-2">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 transition-colors"
        >
          <Filter size={13} className={activeCount > 0 ? 'text-indigo-500' : 'text-slate-400'} />
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
            className="flex items-center gap-1 text-[11px] font-medium text-slate-400 transition-colors hover:text-red-500"
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
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={onApply}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 active:bg-indigo-800"
            >
              <Search size={12} />
              Apply Filter
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function FilterField({ label, children }) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </label>
      {children}
    </div>
  )
}
