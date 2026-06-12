import api from './axios'

/** Flat list for dropdowns — { id, name, type }[] */
export const getAllSalesChannels = () =>
  api.get('/api/v1/sales-channels/all').then((r) => r.data.data)
