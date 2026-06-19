import { Edit2, Eye, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'

const VIEW_CLS =
  'inline-flex items-center justify-center rounded-lg p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 active:bg-blue-200 transition-colors'
const EDIT_CLS =
  'inline-flex items-center justify-center rounded-lg p-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 active:bg-amber-200 transition-colors'
const DEL_CLS =
  'inline-flex items-center justify-center rounded-lg p-1.5 bg-red-50 text-red-500 hover:bg-red-100 active:bg-red-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed'

export function ViewBtn({ to, onClick, title = 'View', size = 14 }) {
  const icon = <Eye size={size} strokeWidth={2} />
  if (to) return <Link to={to} title={title} className={VIEW_CLS}>{icon}</Link>
  return (
    <button type="button" title={title} onClick={onClick} className={VIEW_CLS}>
      {icon}
    </button>
  )
}

export function EditBtn({ to, onClick, title = 'Edit', size = 14 }) {
  const icon = <Edit2 size={size} strokeWidth={2} />
  if (to) return <Link to={to} title={title} className={EDIT_CLS}>{icon}</Link>
  return (
    <button type="button" title={title} onClick={onClick} className={EDIT_CLS}>
      {icon}
    </button>
  )
}

export function DeleteBtn({ onClick, disabled, title = 'Delete', size = 14 }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={DEL_CLS}
    >
      <Trash2 size={size} strokeWidth={2} />
    </button>
  )
}
