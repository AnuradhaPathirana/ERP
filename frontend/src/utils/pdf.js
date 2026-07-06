/**
 * Triggers the browser's print dialog for a PDF Blob via a hidden iframe.
 * Avoids popup blockers (unlike window.open) since the iframe stays in-page.
 */
export function printPdfBlob(blob) {
  const url = URL.createObjectURL(blob)
  const iframe = document.createElement('iframe')
  iframe.style.display = 'none'
  iframe.src = url
  document.body.appendChild(iframe)

  iframe.onload = () => {
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
  }

  // Give the print dialog time to open before releasing the iframe/blob URL.
  setTimeout(() => {
    document.body.removeChild(iframe)
    URL.revokeObjectURL(url)
  }, 60000)
}
