import Swal from 'sweetalert2'

const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
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
    html: `<span style="font-size:14px;color:#475569">Are you sure you want to delete <strong>${name}</strong>?<br>This action cannot be undone.</span>`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'Yes, Delete',
    cancelButtonText: 'Cancel',
    reverseButtons: true,
    focusCancel: true,
    customClass: {
      popup: 'swal-compact',
    },
  })
  return result.isConfirmed
}
