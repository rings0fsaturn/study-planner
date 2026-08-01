import { useState } from 'react'

interface InlineEditTitleProps {
  title: string
  onCommit: (newTitle: string) => void
}

export function InlineEditTitle({ title, onCommit }: InlineEditTitleProps) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(title)

  const handleCommit = () => {
    setEditing(false)
    if (value.trim() && value !== title) {
      onCommit(value.trim())
    }
  }

  if (!editing) {
    return (
      <span onClick={() => { setValue(title); setEditing(true) }} style={{ cursor: 'text' }}>
        {title}
        <svg className="icon icon-sm" viewBox="0 0 24 24"
          style={{ marginLeft: '4px', verticalAlign: '-2px', color: 'var(--text-tertiary)', stroke: 'currentColor', fill: 'none', strokeWidth: 1.75 }}>
          <polygon points="14 3 21 10 8 23 1 24 2 17"/>
        </svg>
      </span>
    )
  }

  return (
    <input
      className="field"
      style={{ display: 'inline', width: 'auto', padding: '2px 4px', fontSize: 'inherit' }}
      value={value}
      autoFocus
      onChange={e => setValue(e.target.value)}
      onBlur={handleCommit}
      onKeyDown={e => { if (e.key === 'Enter') handleCommit() }}
    />
  )
}