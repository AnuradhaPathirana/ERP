import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout/Layout'
import LoginPage from './pages/LoginPage'

// Route-based code splitting — per CLAUDE.md performance requirements
const DashboardPage         = lazy(() => import('./pages/DashboardPage'))
const UnitCategoriesPage    = lazy(() => import('./pages/inventory/UnitCategoriesPage'))
const UnitCategoryFormPage  = lazy(() => import('./pages/inventory/UnitCategoryFormPage'))
const UnitTypesPage         = lazy(() => import('./pages/inventory/UnitTypesPage'))
const UnitTypeFormPage      = lazy(() => import('./pages/inventory/UnitTypeFormPage'))
const ProductsPage          = lazy(() => import('./pages/inventory/ProductsPage'))
const ProductFormPage       = lazy(() => import('./pages/inventory/ProductFormPage'))
const ProductViewPage       = lazy(() => import('./pages/inventory/ProductViewPage'))
const UserManagementPage    = lazy(() => import('./pages/admin/UserManagementPage'))

function PageLoader() {
  return (
    <div className="flex h-full items-center justify-center py-16 text-sm text-slate-400">
      Loading…
    </div>
  )
}

function Lazy({ component: C }) {
  return (
    <Suspense fallback={<PageLoader />}>
      <C />
    </Suspense>
  )
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected shell */}
      <Route element={<Layout />}>
        <Route path="/dashboard"    element={<Lazy component={DashboardPage} />} />
        <Route path="/admin/users" element={<Lazy component={UserManagementPage} />} />

        {/* Inventory module — only its own chunk is downloaded */}
        <Route path="/inventory" element={<Navigate to="/inventory/unit-categories" replace />} />
        <Route path="/inventory/unit-categories"              element={<Lazy component={UnitCategoriesPage} />} />
        <Route path="/inventory/unit-categories/create"       element={<Lazy component={UnitCategoryFormPage} />} />
        <Route path="/inventory/unit-categories/:id/edit"     element={<Lazy component={UnitCategoryFormPage} />} />
        <Route path="/inventory/unit-types"                   element={<Lazy component={UnitTypesPage} />} />
        <Route path="/inventory/unit-types/create"           element={<Lazy component={UnitTypeFormPage} />} />
        <Route path="/inventory/unit-types/:id/edit"         element={<Lazy component={UnitTypeFormPage} />} />
        <Route path="/inventory/products"                    element={<Lazy component={ProductsPage} />} />
        <Route path="/inventory/products/create"             element={<Lazy component={ProductFormPage} />} />
        <Route path="/inventory/products/:id"                element={<Lazy component={ProductViewPage} />} />
        <Route path="/inventory/products/:id/edit"           element={<Lazy component={ProductFormPage} />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
