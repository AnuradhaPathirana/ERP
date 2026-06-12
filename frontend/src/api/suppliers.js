import api from './axios'

/** Flat list for dropdowns — { id, name }[] */
export const getAllSuppliers = () =>
  api.get('/api/v1/supplier-masters/all').then((r) => r.data.data)
