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
