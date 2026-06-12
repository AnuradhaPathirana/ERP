import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  LayoutDashboard,
  Lock,
  Package,
  Users,
  X,
} from 'lucide-react'
import UpgradeModal from './UpgradeModal'

const NAV_ITEMS = [
  {
    label: 'Dashboard',
    to: '/dashboard',
    icon: LayoutDashboard,
    moduleKey: null,
  },
  {
    label: 'Inventory',
    to: '/inventory',
    icon: Package,
    moduleKey: 'inventory',
    children: [
      { label: 'Unit Categories', to: '/inventory/unit-categories' },
      { label: 'Unit Types',      to: '/inventory/unit-types' },
    ],
  },
  { label: 'Finance', to: '/finance', icon: DollarSign, moduleKey: 'finance' },
  { label: 'HR',      to: '/hr',      icon: Users,      moduleKey: 'hr' },
]

function readActiveModules() {
  try {
    const parsed = JSON.parse(localStorage.getItem('active_modules') ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export default function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onClose }) {
  const activeModules = readActiveModules()
  const { pathname }  = useLocation()
  const navigate      = useNavigate()

  const [lockedModule,   setLockedModule]   = useState(null)
  const [expandedLabel,  setExpandedLabel]  = useState(() => {
    // Pre-expand the parent whose child matches the initial path
    const match = NAV_ITEMS.find(item =>
      item.children?.some(c => pathname.startsWith(c.to))
    )
    return match?.label ?? null
  })

  // Auto-expand parent when navigating to a child route
  useEffect(() => {
    const match = NAV_ITEMS.find(item =>
      item.children?.some(c => pathname.startsWith(c.to))
    )
    if (match) setExpandedLabel(match.label)
  }, [pathname])

  return (
    <>
      <aside
        className={[
          'fixed inset-y-0 left-0 z-30 flex flex-col bg-slate-900 transition-all duration-300 ease-in-out',
          'lg:static lg:shrink-0',
          collapsed ? 'w-64 lg:w-16' : 'w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        ].join(' ')}
      >
        {/* ── Header ── */}
        <div
          className={[
            'flex h-16 shrink-0 items-center border-b border-slate-700/60',
            collapsed ? 'justify-center' : 'justify-between px-4',
          ].join(' ')}
        >
          {!collapsed && (
            <span className="text-base font-bold uppercase tracking-widest text-white">
              ERP
            </span>
          )}

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white lg:hidden"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>

          <button
            onClick={onToggleCollapse}
            className="hidden rounded-lg p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white lg:block"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-4">
          {NAV_ITEMS.map((item) => {
            const { label, to, icon: Icon, moduleKey, children } = item
            const isUnlocked    = moduleKey === null || activeModules.includes(moduleKey)
            const isParentActive = pathname === to || pathname.startsWith(to + '/')
            const isExpanded    = expandedLabel === label

            if (!isUnlocked) {
              // Locked module — lock icon, opens upgrade modal
              return (
                <button
                  key={label}
                  type="button"
                  title={collapsed ? `${label} (locked)` : undefined}
                  onClick={() => setLockedModule(item)}
                  className={[
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',
                    'text-slate-500 hover:bg-slate-800/60 hover:text-slate-300 transition-colors duration-150',
                    collapsed ? 'justify-center' : '',
                  ].join(' ')}
                >
                  <Icon size={20} className="shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left">{label}</span>
                      <Lock size={14} className="shrink-0 text-slate-600" />
                    </>
                  )}
                </button>
              )
            }

            if (children?.length) {
              // Unlocked parent with submenu
              return (
                <div key={label}>
                  <button
                    type="button"
                    title={collapsed ? label : undefined}
                    onClick={() => {
                      navigate(to)
                      // Always expand when clicking; collapse only via chevron
                      if (!isExpanded) setExpandedLabel(label)
                    }}
                    className={[
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150',
                      collapsed ? 'justify-center' : '',
                      isParentActive
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white',
                    ].join(' ')}
                  >
                    <Icon size={20} className="shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left">{label}</span>
                        {/* Chevron toggles submenu without triggering parent navigate */}
                        <span
                          role="button"
                          aria-label={isExpanded ? 'Collapse' : 'Expand'}
                          onClick={(e) => {
                            e.stopPropagation()
                            setExpandedLabel(prev => prev === label ? null : label)
                          }}
                          className="rounded p-0.5 hover:bg-white/10"
                        >
                          <ChevronDown
                            size={14}
                            className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                          />
                        </span>
                      </>
                    )}
                  </button>

                  {/* Submenu */}
                  {!collapsed && isExpanded && (
                    <div className="ml-3 mt-0.5 space-y-0.5 border-l border-slate-700/50 pl-3">
                      {children.map(({ label: childLabel, to: childTo }) => (
                        <NavLink
                          key={childLabel}
                          to={childTo}
                          className={({ isActive }) =>
                            [
                              'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors duration-150',
                              isActive
                                ? 'text-white font-medium'
                                : 'text-slate-400 hover:text-white',
                            ].join(' ')
                          }
                        >
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-60" />
                          {childLabel}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              )
            }

            // Standard unlocked item (no children)
            return (
              <NavLink
                key={label}
                to={to}
                title={collapsed ? label : undefined}
                className={({ isActive }) =>
                  [
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150',
                    collapsed ? 'justify-center' : '',
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white',
                  ].join(' ')
                }
              >
                <Icon size={20} className="shrink-0" />
                {!collapsed && <span>{label}</span>}
              </NavLink>
            )
          })}
        </nav>

        {/* ── Footer ── */}
        {!collapsed && (
          <div className="shrink-0 border-t border-slate-700/60 px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
              v1.0.0
            </p>
          </div>
        )}
      </aside>

      <UpgradeModal module={lockedModule} onClose={() => setLockedModule(null)} />
    </>
  )
}
