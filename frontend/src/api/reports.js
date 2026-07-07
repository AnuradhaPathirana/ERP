import api from './axios'

const base = '/api/v1/reports/inventory'

export const getStockLevelsReport = (page = 1, filters = {}) =>
  api.get(`${base}/stock-levels`, { params: { page, ...filters } }).then((r) => r.data)

export const getStockMovementsReport = (page = 1, filters = {}) =>
  api.get(`${base}/stock-movements`, { params: { page, ...filters } }).then((r) => r.data)

export const getLowStockReport = (page = 1, filters = {}) =>
  api.get(`${base}/low-stock`, { params: { page, ...filters } }).then((r) => r.data)

export const getStockValuationReport = (page = 1, filters = {}) =>
  api.get(`${base}/stock-valuation`, { params: { page, ...filters } }).then((r) => r.data)

export const getBatchExpiryReport = (page = 1, filters = {}) =>
  api.get(`${base}/batch-expiry`, { params: { page, ...filters } }).then((r) => r.data)

export const getPurchaseRequestsReport = (page = 1, filters = {}) =>
  api.get(`${base}/purchase-requests`, { params: { page, ...filters } }).then((r) => r.data)

export const getPurchaseOrdersReport = (page = 1, filters = {}) =>
  api.get(`${base}/purchase-orders`, { params: { page, ...filters } }).then((r) => r.data)

export const getOutstandingPOsReport = (page = 1, filters = {}) =>
  api.get(`${base}/outstanding-pos`, { params: { page, ...filters } }).then((r) => r.data)

export const getGrnReport = (page = 1, filters = {}) =>
  api.get(`${base}/grn`, { params: { page, ...filters } }).then((r) => r.data)

export const getSupplierSummaryReport = (page = 1, filters = {}) =>
  api.get(`${base}/supplier-summary`, { params: { page, ...filters } }).then((r) => r.data)

export const getLandedCostsReport = (page = 1, filters = {}) =>
  api.get(`${base}/landed-costs`, { params: { page, ...filters } }).then((r) => r.data)

export const getBinCardReport = (filters = {}) =>
  api.get(`${base}/bin-card`, { params: filters }).then((r) => r.data)

export const downloadBinCardPdf = (filters = {}) =>
  api.get(`${base}/bin-card/pdf`, { params: filters, responseType: 'blob' }).then((r) => r.data)

export const downloadBinCardCsv = (filters = {}) =>
  api.get(`${base}/bin-card/csv`, { params: filters, responseType: 'blob' }).then((r) => r.data)
