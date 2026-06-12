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
const ProductsPage             = lazy(() => import('./pages/inventory/ProductsPage'))
const ProductFormPage          = lazy(() => import('./pages/inventory/ProductFormPage'))
const ProductViewPage          = lazy(() => import('./pages/inventory/ProductViewPage'))
const SalesChannelsPage        = lazy(() => import('./pages/inventory/SalesChannelsPage'))
const SalesChannelFormPage     = lazy(() => import('./pages/inventory/SalesChannelFormPage'))
const SalesChannelViewPage     = lazy(() => import('./pages/inventory/SalesChannelViewPage'))
const IndustriesPage           = lazy(() => import('./pages/inventory/IndustriesPage'))
const IndustryFormPage         = lazy(() => import('./pages/inventory/IndustryFormPage'))
const IndustryViewPage         = lazy(() => import('./pages/inventory/IndustryViewPage'))
const CompaniesPage            = lazy(() => import('./pages/inventory/CompaniesPage'))
const CompanyFormPage          = lazy(() => import('./pages/inventory/CompanyFormPage'))
const CompanyViewPage          = lazy(() => import('./pages/inventory/CompanyViewPage'))
const LocationsPage            = lazy(() => import('./pages/inventory/LocationsPage'))
const LocationFormPage         = lazy(() => import('./pages/inventory/LocationFormPage'))
const LocationViewPage         = lazy(() => import('./pages/inventory/LocationViewPage'))
const SuppliersPage            = lazy(() => import('./pages/inventory/SuppliersPage'))
const SupplierFormPage         = lazy(() => import('./pages/inventory/SupplierFormPage'))
const SupplierViewPage         = lazy(() => import('./pages/inventory/SupplierViewPage'))
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
        <Route path="/inventory/products"                        element={<Lazy component={ProductsPage} />} />
        <Route path="/inventory/products/create"               element={<Lazy component={ProductFormPage} />} />
        <Route path="/inventory/products/:id"                  element={<Lazy component={ProductViewPage} />} />
        <Route path="/inventory/products/:id/edit"             element={<Lazy component={ProductFormPage} />} />
        <Route path="/inventory/sales-channels"                element={<Lazy component={SalesChannelsPage} />} />
        <Route path="/inventory/sales-channels/create"         element={<Lazy component={SalesChannelFormPage} />} />
        <Route path="/inventory/sales-channels/:id"            element={<Lazy component={SalesChannelViewPage} />} />
        <Route path="/inventory/sales-channels/:id/edit"       element={<Lazy component={SalesChannelFormPage} />} />
        <Route path="/inventory/industries"                    element={<Lazy component={IndustriesPage} />} />
        <Route path="/inventory/industries/create"             element={<Lazy component={IndustryFormPage} />} />
        <Route path="/inventory/industries/:id"                element={<Lazy component={IndustryViewPage} />} />
        <Route path="/inventory/industries/:id/edit"           element={<Lazy component={IndustryFormPage} />} />
        <Route path="/inventory/companies"                     element={<Lazy component={CompaniesPage} />} />
        <Route path="/inventory/companies/create"              element={<Lazy component={CompanyFormPage} />} />
        <Route path="/inventory/companies/:id"                 element={<Lazy component={CompanyViewPage} />} />
        <Route path="/inventory/companies/:id/edit"            element={<Lazy component={CompanyFormPage} />} />
        <Route path="/inventory/locations"                     element={<Lazy component={LocationsPage} />} />
        <Route path="/inventory/locations/create"              element={<Lazy component={LocationFormPage} />} />
        <Route path="/inventory/locations/:id"                 element={<Lazy component={LocationViewPage} />} />
        <Route path="/inventory/locations/:id/edit"            element={<Lazy component={LocationFormPage} />} />
        <Route path="/inventory/suppliers"                     element={<Lazy component={SuppliersPage} />} />
        <Route path="/inventory/suppliers/create"              element={<Lazy component={SupplierFormPage} />} />
        <Route path="/inventory/suppliers/:id"                 element={<Lazy component={SupplierViewPage} />} />
        <Route path="/inventory/suppliers/:id/edit"            element={<Lazy component={SupplierFormPage} />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
