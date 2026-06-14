import { useState } from 'react'

/**
 * Manages draft/applied filter state for any data table.
 *
 * Usage:
 *   const { open, toggle, draft, setDraft, applied, apply, clear, activeCount } =
 *     useTableFilter({ search: '', type: '' })
 *
 *   Pass `applied` to your query key and API call.
 *   Pass `apply` / `clear` with an optional page-reset callback.
 */
export function useTableFilter(initialFilters = {}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(initialFilters)
  const [applied, setApplied] = useState(initialFilters)

  const toggle = () => setOpen((o) => !o)

  const apply = (onPageReset) => {
    setApplied({ ...draft })
    onPageReset?.()
  }

  const clear = (onPageReset) => {
    setDraft({ ...initialFilters })
    setApplied({ ...initialFilters })
    onPageReset?.()
  }

  const activeCount = Object.values(applied).filter(
    (v) => v !== '' && v !== null && v !== undefined,
  ).length

  return { open, toggle, draft, setDraft, applied, apply, clear, activeCount }
}
