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
const UnitConversionsPage   = lazy(() => import('./pages/inventory/UnitConversionsPage'))
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
const CustomersPage            = lazy(() => import('./pages/inventory/CustomersPage'))
const CustomerFormPage         = lazy(() => import('./pages/inventory/CustomerFormPage'))
const CustomerViewPage         = lazy(() => import('./pages/inventory/CustomerViewPage'))
const CategoriesPage           = lazy(() => import('./pages/inventory/CategoriesPage'))
const CategoryFormPage         = lazy(() => import('./pages/inventory/CategoryFormPage'))
const CategoryViewPage         = lazy(() => import('./pages/inventory/CategoryViewPage'))
const AttributeTypesPage       = lazy(() => import('./pages/inventory/AttributeTypesPage'))
const AttributeTypeFormPage    = lazy(() => import('./pages/inventory/AttributeTypeFormPage'))
const AttributesPage           = lazy(() => import('./pages/inventory/AttributesPage'))
const AttributeFormPage        = lazy(() => import('./pages/inventory/AttributeFormPage'))
const StoreTypesPage           = lazy(() => import('./pages/inventory/StoreTypesPage'))
const StoreTypeFormPage        = lazy(() => import('./pages/inventory/StoreTypeFormPage'))
const StoresPage               = lazy(() => import('./pages/inventory/StoresPage'))
const StoreFormPage            = lazy(() => import('./pages/inventory/StoreFormPage'))
const DriversPage              = lazy(() => import('./pages/inventory/DriversPage'))
const DriverFormPage           = lazy(() => import('./pages/inventory/DriverFormPage'))
const DriverViewPage           = lazy(() => import('./pages/inventory/DriverViewPage'))
const VehiclesPage             = lazy(() => import('./pages/inventory/VehiclesPage'))
const VehicleFormPage          = lazy(() => import('./pages/inventory/VehicleFormPage'))
const VehicleViewPage          = lazy(() => import('./pages/inventory/VehicleViewPage'))
const UserManagementPage    = lazy(() => import('./pages/admin/UserManagementPage'))
const RolesPage             = lazy(() => import('./pages/admin/RolesPage'))
const RoleFormPage          = lazy(() => import('./pages/admin/RoleFormPage'))

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
        <Route path="/admin/users"              element={<Lazy component={UserManagementPage} />} />
        <Route path="/admin/roles"              element={<Lazy component={RolesPage} />} />
        <Route path="/admin/roles/create"       element={<Lazy component={RoleFormPage} />} />
        <Route path="/admin/roles/:id/edit"     element={<Lazy component={RoleFormPage} />} />

        {/* Inventory module — only its own chunk is downloaded */}
        <Route path="/inventory" element={<Navigate to="/inventory/unit-categories" replace />} />
        <Route path="/inventory/unit-categories"              element={<Lazy component={UnitCategoriesPage} />} />
        <Route path="/inventory/unit-categories/create"       element={<Lazy component={UnitCategoryFormPage} />} />
        <Route path="/inventory/unit-categories/:id/edit"     element={<Lazy component={UnitCategoryFormPage} />} />
        <Route path="/inventory/unit-types"                   element={<Lazy component={UnitTypesPage} />} />
        <Route path="/inventory/unit-types/create"           element={<Lazy component={UnitTypeFormPage} />} />
        <Route path="/inventory/unit-types/:id/edit"         element={<Lazy component={UnitTypeFormPage} />} />
        <Route path="/inventory/unit-conversions"            element={<Lazy component={UnitConversionsPage} />} />
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
        <Route path="/inventory/customers"                     element={<Lazy component={CustomersPage} />} />
        <Route path="/inventory/customers/create"              element={<Lazy component={CustomerFormPage} />} />
        <Route path="/inventory/customers/:id"                 element={<Lazy component={CustomerViewPage} />} />
        <Route path="/inventory/customers/:id/edit"            element={<Lazy component={CustomerFormPage} />} />
        <Route path="/inventory/categories"                    element={<Lazy component={CategoriesPage} />} />
        <Route path="/inventory/categories/create"             element={<Lazy component={CategoryFormPage} />} />
        <Route path="/inventory/categories/:id"                element={<Lazy component={CategoryViewPage} />} />
        <Route path="/inventory/categories/:id/edit"           element={<Lazy component={CategoryFormPage} />} />
        <Route path="/inventory/attribute-types"               element={<Lazy component={AttributeTypesPage} />} />
        <Route path="/inventory/attribute-types/create"        element={<Lazy component={AttributeTypeFormPage} />} />
        <Route path="/inventory/attribute-types/:id/edit"      element={<Lazy component={AttributeTypeFormPage} />} />
        <Route path="/inventory/attributes"                    element={<Lazy component={AttributesPage} />} />
        <Route path="/inventory/attributes/create"             element={<Lazy component={AttributeFormPage} />} />
        <Route path="/inventory/attributes/:id/edit"           element={<Lazy component={AttributeFormPage} />} />
        <Route path="/inventory/store-types"                   element={<Lazy component={StoreTypesPage} />} />
        <Route path="/inventory/store-types/create"            element={<Lazy component={StoreTypeFormPage} />} />
        <Route path="/inventory/store-types/:id/edit"          element={<Lazy component={StoreTypeFormPage} />} />
        <Route path="/inventory/stores"                        element={<Lazy component={StoresPage} />} />
        <Route path="/inventory/stores/create"                 element={<Lazy component={StoreFormPage} />} />
        <Route path="/inventory/stores/:id/edit"               element={<Lazy component={StoreFormPage} />} />
        <Route path="/inventory/drivers"                       element={<Lazy component={DriversPage} />} />
        <Route path="/inventory/drivers/create"                element={<Lazy component={DriverFormPage} />} />
        <Route path="/inventory/drivers/:id"                   element={<Lazy component={DriverViewPage} />} />
        <Route path="/inventory/drivers/:id/edit"              element={<Lazy component={DriverFormPage} />} />
        <Route path="/inventory/vehicles"                      element={<Lazy component={VehiclesPage} />} />
        <Route path="/inventory/vehicles/create"               element={<Lazy component={VehicleFormPage} />} />
        <Route path="/inventory/vehicles/:id"                  element={<Lazy component={VehicleViewPage} />} />
        <Route path="/inventory/vehicles/:id/edit"             element={<Lazy component={VehicleFormPage} />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
