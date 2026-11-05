import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { Loader2, Plus, Search } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface ComboboxOption {
  value: string
  label: string
  hint?: string
}

interface ComboboxProps {
  id?: string
  value: string
  onChange: (value: string) => void
  onSelect?: (option: ComboboxOption) => void
  options: ComboboxOption[]
  placeholder?: string
  allowCreate?: boolean
  onCreate?: (value: string) => Promise<void> | void
  createLabel?: (value: string) => string
  loading?: boolean
  emptyText?: string
  disabled?: boolean
  autoFocus?: boolean
  showSearchIcon?: boolean
}

export function Combobox({
  id,
  value,
  onChange,
  onSelect,
  options,
  placeholder,
  allowCreate = false,
  onCreate,
  createLabel,
  loading = false,
  emptyText = 'Nessun risultato',
  disabled = false,
  autoFocus = false,
  showSearchIcon = true,
}: ComboboxProps) {
  const listId = useId()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  const filtered = useMemo(() => {
    const query = value.trim().toLowerCase()
    if (!query) return options
    return options.filter((option) => option.label.toLowerCase().includes(query))
  }, [options, value])

  const exactMatch = options.some((option) => option.label.toLowerCase() === value.trim().toLowerCase())
  const canCreate = allowCreate && Boolean(onCreate) && value.trim().length > 0 && !exactMatch
  const totalItems = filtered.length + (canCreate ? 1 : 0)

  useEffect(() => {
    setHighlighted(0)
  }, [value, open])

  useEffect(() => {
    if (!open) return
    setHighlighted((current) => Math.min(current, Math.max(totalItems - 1, 0)))
  }, [open, totalItems])

  const choose = async (index: number) => {
    if (index < filtered.length) {
      const option = filtered[index]
      onChange(option.label)
      onSelect?.(option)
      setOpen(false)
      return
    }
    if (canCreate && index === filtered.length && onCreate) {
      setCreating(true)
      try {
        await onCreate(value.trim())
        setOpen(false)
      } catch {
        // The parent shows the error toast; keep the dropdown usable.
      } finally {
        setCreating(false)
      }
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setHighlighted((current) => Math.min(current + 1, Math.max(totalItems - 1, 0)))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      setHighlighted((current) => Math.max(current - 1, 0))
    } else if (event.key === 'Enter' && open && totalItems > 0) {
      event.preventDefault()
      void choose(highlighted)
    } else if (event.key === 'Escape') {
      setOpen(false)
    } else if (event.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="relative">
        {showSearchIcon ? (
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        ) : null}
        <input
          id={id}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={
            open && totalItems > 0 ? `${listId}-option-${highlighted}` : undefined
          }
          autoComplete="off"
          autoFocus={autoFocus}
          disabled={disabled}
          value={value}
          onChange={(event) => {
            onChange(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn('input-base', showSearchIcon && 'pl-10')}
        />
      </div>

      {open ? (
        <div
          id={listId}
          role="listbox"
          className="absolute z-[70] mt-1.5 max-h-64 w-full overflow-y-auto rounded-xl border border-line bg-surface p-1.5 shadow-[var(--shadow-float)] animate-pop-in"
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2 px-3 py-3 text-xs text-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Caricamento…
            </div>
          ) : totalItems === 0 ? (
            <p className="px-3 py-3 text-center text-xs text-muted">{emptyText}</p>
          ) : (
            <>
              {filtered.map((option, index) => (
                <button
                  key={option.value}
                  id={`${listId}-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={highlighted === index}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setHighlighted(index)}
                  onClick={() => void choose(index)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition',
                    highlighted === index ? 'bg-surface-2' : 'hover:bg-surface-2',
                  )}
                >
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{option.label}</span>
                  {option.hint ? (
                    <span className="shrink-0 text-[10.5px] text-muted">{option.hint}</span>
                  ) : null}
                </button>
              ))}
              {canCreate ? (
                <button
                  type="button"
                  role="option"
                  aria-selected={highlighted === filtered.length}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setHighlighted(filtered.length)}
                  onClick={() => void choose(filtered.length)}
                  disabled={creating}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition',
                    highlighted === filtered.length ? 'bg-surface-2' : 'hover:bg-surface-2',
                  )}
                >
                  <Plus className="h-3.5 w-3.5 shrink-0 text-accent" />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-accent-ink">
                    {createLabel ? createLabel(value.trim()) : `Crea «${value.trim()}»`}
                  </span>
                  {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" /> : null}
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
