import Swal from 'sweetalert2'

const Toast = Swal.mixin({
  toast: true,
  position: 'bottom-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  showClass: { popup: 'swal2-toast-slide-in' },
  hideClass: { popup: 'swal2-toast-slide-out' },
  customClass: { popup: 'swal2-toast-mini' },
  didOpen: (toast) => {
    toast.onmouseenter = Swal.stopTimer
    toast.onmouseleave = Swal.resumeTimer
  },
})

export function showSuccess(message = 'Operation completed successfully.') {
  Toast.fire({ icon: 'success', title: message })
}

export function showError(message = 'Something went wrong. Please try again.') {
  Toast.fire({ icon: 'error', title: message, timer: 5000 })
}

export function showWarning(message) {
  Toast.fire({ icon: 'warning', title: message, timer: 4500 })
}

export async function confirmDelete(name) {
  const result = await Swal.fire({
    title: 'Delete Record?',
    html: `Are you sure you want to delete <strong>"${name}"</strong>?<br><span class="swal2-sub-text">This action cannot be undone.</span>`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#64748b',
    confirmButtonText: '<span>Yes, Delete It</span>',
    cancelButtonText: 'Cancel',
    reverseButtons: true,
    focusCancel: true,
    width: '360px',
    customClass: {
      popup:         'swal2-styled-popup',
      title:         'swal2-styled-title',
      htmlContainer: 'swal2-styled-html',
      confirmButton: 'swal2-styled-confirm-btn swal2-danger-btn',
      cancelButton:  'swal2-styled-cancel-btn',
      icon:          'swal2-styled-icon',
    },
  })
  return result.isConfirmed
}

export async function confirmAction({ title, message, confirmText = 'Yes, Confirm', confirmColor = '#16a34a', icon = 'question' }) {
  const result = await Swal.fire({
    title,
    html: `<span>${message}</span>`,
    icon,
    showCancelButton: true,
    confirmButtonColor: confirmColor,
    cancelButtonColor: '#64748b',
    confirmButtonText: `<span>${confirmText}</span>`,
    cancelButtonText: 'Cancel',
    reverseButtons: true,
    width: '360px',
    customClass: {
      popup:         'swal2-styled-popup',
      title:         'swal2-styled-title',
      htmlContainer: 'swal2-styled-html',
      confirmButton: 'swal2-styled-confirm-btn',
      cancelButton:  'swal2-styled-cancel-btn',
      icon:          'swal2-styled-icon',
    },
  })
  return result.isConfirmed
}

export async function confirmWithReason({ title, inputLabel, inputPlaceholder, confirmText = 'Confirm', confirmColor = '#ef4444' }) {
  const result = await Swal.fire({
    title,
    input: 'textarea',
    inputLabel,
    inputPlaceholder,
    showCancelButton: true,
    confirmButtonColor: confirmColor,
    cancelButtonColor: '#64748b',
    confirmButtonText: `<span>${confirmText}</span>`,
    cancelButtonText: 'Cancel',
    reverseButtons: true,
    width: '360px',
    customClass: {
      popup:         'swal2-styled-popup',
      title:         'swal2-styled-title',
      htmlContainer: 'swal2-styled-html',
      confirmButton: 'swal2-styled-confirm-btn swal2-danger-btn',
      cancelButton:  'swal2-styled-cancel-btn',
      input:         'swal2-styled-textarea',
    },
    preConfirm: (value) => {
      if (!value?.trim()) Swal.showValidationMessage('This field is required.')
      return value
    },
  })
  return result.isConfirmed ? result.value : null
}
