import api from './axios'

export const getAllCustomers = () =>
  api.get('/api/v1/customer-masters/all').then((r) => r.data.data)

export const getCustomers = (page = 1, search = '') =>
  api.get('/api/v1/customer-masters', { params: { page, ...(search ? { search } : {}) } }).then((r) => r.data)

export const getCustomer = (id) =>
  api.get(`/api/v1/customer-masters/${id}`).then((r) => r.data)

export const createCustomer = (data) =>
  api.post('/api/v1/customer-masters', data).then((r) => r.data)

export const updateCustomer = (id, data) =>
  api.put(`/api/v1/customer-masters/${id}`, data).then((r) => r.data)

export const deleteCustomer = (id) =>
  api.delete(`/api/v1/customer-masters/${id}`)
