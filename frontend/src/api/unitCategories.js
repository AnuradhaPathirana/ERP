import api from './axios'

const BASE = '/api/v1/unit-categories'

/** @returns {Promise<{ data: object[], meta: { current_page, last_page, per_page, total } }>} */
export const getUnitCategories = (page = 1) =>
  api.get(BASE, { params: { page } }).then((r) => r.data)

/** @returns {Promise<{ data: object }>} */
export const getUnitCategory = (id) =>
  api.get(`${BASE}/${id}`).then((r) => r.data)

/** @returns {Promise<{ data: object }>} */
export const createUnitCategory = (payload) =>
  api.post(BASE, payload).then((r) => r.data)

/** @returns {Promise<{ data: object }>} */
export const updateUnitCategory = (id, payload) =>
  api.put(`${BASE}/${id}`, payload).then((r) => r.data)

export const deleteUnitCategory = (id) =>
  api.delete(`${BASE}/${id}`)

/** Flat list for <select> dropdowns — returns [{ id, name }] */
export const getAllUnitCategories = () =>
  api.get(`${BASE}/all`).then((r) => r.data)
