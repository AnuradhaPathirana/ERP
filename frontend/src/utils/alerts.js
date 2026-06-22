import Swal from 'sweetalert2'

const COMPACT_POPUP = {
  popup:        'swal2-compact-popup',
  title:        'swal2-compact-title',
  htmlContainer:'swal2-compact-html',
  confirmButton:'swal2-compact-btn',
  cancelButton: 'swal2-compact-btn',
}

const Toast = Swal.mixin({
  toast: true,
  position: 'bottom-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  width: 'auto',
  customClass: { popup: 'swal2-toast-compact' },
  didOpen: (toast) => {
    toast.onmouseenter = Swal.stopTimer
    toast.onmouseleave = Swal.resumeTimer
  },
})

export function showSuccess(message = 'Operation completed successfully.') {
  Toast.fire({ icon: 'success', title: message })
}

export function showError(message = 'Something went wrong. Please try again.') {
  Toast.fire({ icon: 'error', title: message, timer: 4500 })
}

export function showWarning(message) {
  Toast.fire({ icon: 'warning', title: message, timer: 4000 })
}

export async function confirmDelete(name) {
  const result = await Swal.fire({
    title: 'Delete Record?',
    html: `<span style="font-size:12px;color:#475569">Delete <strong>${name}</strong>? This cannot be undone.</span>`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'Yes, Delete',
    cancelButtonText: 'Cancel',
    reverseButtons: true,
    focusCancel: true,
    width: '340px',
    customClass: COMPACT_POPUP,
  })
  return result.isConfirmed
}

export async function confirmAction({ title, message, confirmText = 'Yes, Confirm', confirmColor = '#16a34a' }) {
  const result = await Swal.fire({
    title,
    html: `<span style="font-size:12px;color:#475569">${message}</span>`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: confirmColor,
    cancelButtonColor: '#64748b',
    confirmButtonText: confirmText,
    cancelButtonText: 'Cancel',
    reverseButtons: true,
    width: '340px',
    customClass: COMPACT_POPUP,
  })
  return result.isConfirmed
}

export async function confirmWithReason({ title, inputLabel, inputPlaceholder, confirmText = 'Confirm', confirmColor = '#ef4444' }) {
  const result = await Swal.fire({
    title,
    input: 'textarea',
    inputLabel,
    inputPlaceholder,
    inputAttributes: { style: 'font-size:12px;resize:none;min-height:60px' },
    showCancelButton: true,
    confirmButtonColor: confirmColor,
    cancelButtonColor: '#64748b',
    confirmButtonText: confirmText,
    cancelButtonText: 'Cancel',
    reverseButtons: true,
    width: '340px',
    customClass: COMPACT_POPUP,
    preConfirm: (value) => {
      if (!value?.trim()) Swal.showValidationMessage('This field is required.')
      return value
    },
  })
  return result.isConfirmed ? result.value : null
}
