import api from './axios'

export const uploadCustomerAttachments = (customerId, files) => {
  const formData = new FormData()
  files.forEach((file) => formData.append('files[]', file))
  return api.post(`/api/v1/customer-masters/${customerId}/attachments`, formData).then((r) => r.data)
}

export const deleteCustomerAttachment = (customerId, attachmentId) =>
  api.delete(`/api/v1/customer-masters/${customerId}/attachments/${attachmentId}`)
