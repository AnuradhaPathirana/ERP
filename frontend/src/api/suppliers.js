import api from './axios'

export const getAllSuppliers = () =>
  api.get('/api/v1/supplier-masters/all').then((r) => r.data.data)

export const getSuppliers = (page = 1, filters = {}) =>
  api.get('/api/v1/supplier-masters', { params: { page, ...filters } }).then((r) => r.data)

export const getSupplier = (id) =>
  api.get(`/api/v1/supplier-masters/${id}`).then((r) => r.data)

export const createSupplier = (data) =>
  api.post('/api/v1/supplier-masters', data).then((r) => r.data)

export const updateSupplier = (id, data) =>
  api.put(`/api/v1/supplier-masters/${id}`, data).then((r) => r.data)

export const deleteSupplier = (id) =>
  api.delete(`/api/v1/supplier-masters/${id}`)

export const checkSupplierCode = (code, excludeId = null) =>
  api.get('/api/v1/supplier-masters/check-code', {
    params: { code, ...(excludeId ? { exclude_id: excludeId } : {}) },
  }).then((r) => r.data)
