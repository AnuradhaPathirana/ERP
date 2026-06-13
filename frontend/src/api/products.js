import api from './axios'

const BASE = '/api/v1/products'

/** @returns {Promise<{ data: object[], meta: object }>} */
export const getProducts = (page = 1) =>
  api.get(BASE, { params: { page } }).then((r) => r.data)

/** @returns {Promise<{ data: object }>} */
export const getProduct = (id) =>
  api.get(`${BASE}/${id}`).then((r) => r.data)

/** @returns {Promise<{ data: object }>} */
export const createProduct = (payload) =>
  api.post(BASE, payload).then((r) => r.data)

/** @returns {Promise<{ data: object }>} */
export const updateProduct = (id, payload) =>
  api.put(`${BASE}/${id}`, payload).then((r) => r.data)

export const deleteProduct = (id) =>
  api.delete(`${BASE}/${id}`)

/** Check if a product_code is available. Pass excludeId when editing. */
export const checkProductCode = (code, excludeId = null) => {
  const params = { code }
  if (excludeId) params.exclude_id = excludeId
  return api.get(`${BASE}/check-code`, { params }).then((r) => r.data)
}
