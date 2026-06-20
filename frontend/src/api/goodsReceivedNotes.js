import api from './axios'

export const getGoodsReceivedNotes = (page = 1, filters = {}) =>
  api.get('/api/v1/goods-received-notes', { params: { page, ...filters } }).then((r) => r.data)

export const getGoodsReceivedNote = (id) =>
  api.get(`/api/v1/goods-received-notes/${id}`).then((r) => r.data)

export const createGoodsReceivedNote = (data) =>
  api.post('/api/v1/goods-received-notes', data).then((r) => r.data)

export const updateGoodsReceivedNote = (id, data) =>
  api.put(`/api/v1/goods-received-notes/${id}`, data).then((r) => r.data)

export const deleteGoodsReceivedNote = (id) =>
  api.delete(`/api/v1/goods-received-notes/${id}`)

export const confirmGoodsReceivedNote = (id) =>
  api.post(`/api/v1/goods-received-notes/${id}/confirm`).then((r) => r.data)

export const getPoOutstandingItems = (poId) =>
  api.get(`/api/v1/goods-received-notes/po-items/${poId}`).then((r) => r.data)

export const getNextGrnNo = () =>
  api.get('/api/v1/goods-received-notes/next-grn-no').then((r) => r.data.data.grn_no)

export const getLastGrnForSupplier = (supplierId) =>
  api.get(`/api/v1/goods-received-notes/supplier/${supplierId}/last`).then((r) => r.data.data)
