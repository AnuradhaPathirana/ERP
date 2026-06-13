import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  ArrowLeftRight,
  Box,
  Building2,
  Bus,
  Car,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  FolderTree,
  LayoutDashboard,
  Layers,
  Lock,
  MapPin,
  Package,
  Ruler,
  Shield,
  ShoppingCart,
  SlidersHorizontal,
  Tag,
  Truck,
  UserCog,
  Users,
  UsersRound,
  Store,
  Warehouse,
  X,
} from 'lucide-react'
import UpgradeModal from './UpgradeModal'

// ── Nav definition ─────────────────────────────────────────────────────────
// moduleKey  → guarded by active_modules in localStorage
// roleGuard  → guarded by user_roles in localStorage (array: any match grants access)
// children   → renders as a section header with always-visible child links
const NAV_ITEMS = [
  {
    label: 'Dashboard',
    to: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Team Management',
    to: '/admin/users',
    icon: UserCog,
    roleGuard: ['super_admin', 'admin'],
  },
  {
    label: 'Roles & Permissions',
    to: '/admin/roles',
    icon: Shield,
    roleGuard: ['super_admin', 'admin'],
  },
  {
    label: 'Inventory',
    icon: Package,
    moduleKey: 'inventory',
    children: [
      { label: 'Industries',       to: '/inventory/industries',        icon: Building2,       permissionGuard: 'view_industries' },
      { label: 'Companies',        to: '/inventory/companies',         icon: Building2,       permissionGuard: 'view_companies' },
      { label: 'Locations',        to: '/inventory/locations',         icon: MapPin,          permissionGuard: 'view_locations' },
      { label: 'Stores',           to: '/inventory/stores',            icon: Store,           permissionGuard: 'view_stores' },
      { label: 'Store Types',      to: '/inventory/store-types',       icon: Warehouse,       permissionGuard: 'view_store_types' },
      { label: 'Customers',        to: '/inventory/customers',         icon: UsersRound,      permissionGuard: 'view_customer_masters' },
      { label: 'Suppliers',        to: '/inventory/suppliers',         icon: Truck,           permissionGuard: 'view_supplier_masters' },
      { label: 'Unit Categories',  to: '/inventory/unit-categories',   icon: Tag,             permissionGuard: 'view_unit_categories' },
      { label: 'Unit Types',       to: '/inventory/unit-types',        icon: Ruler,           permissionGuard: 'view_unit_types' },
      { label: 'Unit Conversions', to: '/inventory/unit-conversions',  icon: ArrowLeftRight,  permissionGuard: 'view_unit_conversions' },
      { label: 'Attribute Types',  to: '/inventory/attribute-types',   icon: Layers,          permissionGuard: 'view_attribute_types' },
      { label: 'Attributes',       to: '/inventory/attributes',        icon: SlidersHorizontal, permissionGuard: 'view_attributes' },
      { label: 'Drivers',          to: '/inventory/drivers',           icon: Car,             permissionGuard: 'view_drivers' },
      { label: 'Vehicles',         to: '/inventory/vehicles',          icon: Bus,             permissionGuard: 'view_vehicle_masters' },
      { label: 'Categories',       to: '/inventory/categories',        icon: FolderTree,      permissionGuard: 'view_categories' },
      { label: 'Products',         to: '/inventory/products',          icon: Box,             permissionGuard: 'view_products' },
      { label: 'Sales Channels',   to: '/inventory/sales-channels',    icon: ShoppingCart,    permissionGuard: 'view_sales_channels' },
    ],
  },
  {
    label: 'Finance',
    icon: DollarSign,
    moduleKey: 'finance',
    children: [],
  },
  {
    label: 'HR',
    icon: Users,
    moduleKey: 'hr',
    children: [],
  },
]

function readUserPermissions() {
  try {
    const parsed = JSON.parse(localStorage.getItem('user_permissions') ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function readActiveModules() {
  try {
    const parsed = JSON.parse(localStorage.getItem('active_modules') ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function readUserRoles() {
  try {
    const parsed = JSON.parse(localStorage.getItem('user_roles') ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export default function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onClose }) {
  const activeModules   = readActiveModules()
  const userRoles       = readUserRoles()
  const userPermissions = readUserPermissions()
  const isSuperAdmin    = userRoles.includes('super_admin')
  const navigate        = useNavigate()

  const [lockedModule, setLockedModule] = useState(null)

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
        <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const { label, to, icon: Icon, moduleKey, roleGuard, children } = item

            // ── Role-gated standalone link (e.g. Team Management) ──
            if (roleGuard) {
              const hasAccess = roleGuard.some((r) => userRoles.includes(r))
              if (!hasAccess) return null

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
            }

            // ── Standard standalone link (no guard) ──
            if (!moduleKey) {
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
            }

            const isUnlocked = activeModules.includes(moduleKey)

            // ── Locked module ──
            if (!isUnlocked) {
              return (
                <div key={label}>
                  <button
                    type="button"
                    title={collapsed ? `${label} (locked)` : undefined}
                    onClick={() => setLockedModule(item)}
                    className={[
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider',
                      'text-slate-600 hover:text-slate-400 transition-colors duration-150',
                      collapsed ? 'justify-center' : '',
                    ].join(' ')}
                  >
                    <Icon size={18} className="shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left">{label}</span>
                        <Lock size={12} className="shrink-0" />
                      </>
                    )}
                  </button>
                </div>
              )
            }

            // ── Unlocked module — section header + always-visible children ──
            return (
              <div key={label} className="pt-2 first:pt-0">
                {collapsed ? (
                  <button
                    type="button"
                    title={label}
                    onClick={() => children?.[0] && navigate(children[0].to)}
                    className="flex w-full justify-center rounded-lg px-3 py-2 text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors duration-150"
                  >
                    <Icon size={18} className="shrink-0" />
                  </button>
                ) : (
                  <div className="flex items-center gap-2 px-3 pb-1">
                    <Icon size={14} className="shrink-0 text-slate-500" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      {label}
                    </span>
                  </div>
                )}

                {/* Children — always visible when expanded */}
                {!collapsed && children?.filter(({ permissionGuard }) =>
                  !permissionGuard || isSuperAdmin || userPermissions.includes(permissionGuard)
                ).map(({ label: cl, to: ct, icon: CI }) => (
                  <NavLink
                    key={cl}
                    to={ct}
                    className={({ isActive }) =>
                      [
                        'flex items-center gap-3 rounded-lg pl-5 pr-3 py-2 text-sm transition-colors duration-150',
                        isActive
                          ? 'bg-indigo-600/20 text-indigo-400 font-medium'
                          : 'text-slate-400 hover:bg-slate-800 hover:text-white',
                      ].join(' ')
                    }
                  >
                    {CI
                      ? <CI size={16} className="shrink-0" />
                      : <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-60" />
                    }
                    <span>{cl}</span>
                  </NavLink>
                ))}

                {/* Collapsed: show each child icon */}
                {collapsed && children?.filter(({ permissionGuard }) =>
                  !permissionGuard || isSuperAdmin || userPermissions.includes(permissionGuard)
                ).map(({ label: cl, to: ct, icon: CI }) => (
                  <NavLink
                    key={cl}
                    to={ct}
                    title={cl}
                    className={({ isActive }) =>
                      [
                        'flex w-full justify-center rounded-lg px-3 py-2 transition-colors duration-150',
                        isActive
                          ? 'text-indigo-400'
                          : 'text-slate-500 hover:bg-slate-800 hover:text-white',
                      ].join(' ')
                    }
                  >
                    {CI
                      ? <CI size={16} className="shrink-0" />
                      : <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
                    }
                  </NavLink>
                ))}
              </div>
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
