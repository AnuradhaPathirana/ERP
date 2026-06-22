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

/** Fetch outstanding items for multiple POs in one request */
export const getPoOutstandingItemsMultiple = (poIds = []) =>
  api.get('/api/v1/goods-received-notes/po-items-multi', {
    params: { po_ids: poIds },
    paramsSerializer: { indexes: null },
  }).then((r) => r.data.data ?? [])

export const getNextGrnNo = () =>
  api.get('/api/v1/goods-received-notes/next-grn-no').then((r) => r.data.data.grn_no)

export const getLastGrn = () =>
  api.get('/api/v1/goods-received-notes/last').then((r) => r.data.data)

/** Download GRN as PDF — returns a Blob */
export const downloadGrnPdf = (id) =>
  api.get(`/api/v1/goods-received-notes/${id}/pdf`, { responseType: 'blob' }).then((r) => r.data)
