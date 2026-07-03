import api from './axios'

const BASE = '/api/v1/unit-types'

export const getUnitTypes = (page = 1) =>
  api.get(BASE, { params: { page } }).then((r) => r.data)

export const getUnitType = (id) =>
  api.get(`${BASE}/${id}`).then((r) => r.data)

export const createUnitType = (payload) =>
  api.post(BASE, payload).then((r) => r.data)

export const updateUnitType = (id, payload) =>
  api.put(`${BASE}/${id}`, payload).then((r) => r.data)

export const deleteUnitType = (id) =>
  api.delete(`${BASE}/${id}`)

/**
 * Flat list for dropdowns — { id, unit_category_id, name, symbol }[].
 * Pass unitCategoryId to scope to a specific category (cascading Unit Category → UOM selects);
 * otherwise falls back to the system default category.
 */
export const getAllUnitTypes = (unitCategoryId = null) =>
  api.get(`${BASE}/all`, {
    params: unitCategoryId ? { unit_category_id: unitCategoryId } : {},
  }).then((r) => r.data.data)
