import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Archive,
  ArchiveRestore,
  Pencil,
  Plus,
  Tag,
  Tags,
  Trash2,
} from 'lucide-react'
import { api } from '../lib/api'
import type { Category, CategoryType } from '../types'
import { useToast } from '../context/ToastContext'
import { cn, PALETTE, parseAmount } from '../lib/utils'
import { AppIcon } from '../lib/icons'
import { Button, IconButton } from '../components/ui/Button'
import { Field, FormError, Input } from '../components/ui/Field'
import { ConfirmDialog, Modal } from '../components/ui/Modal'
import {
  Badge,
  ColorIconPicker,
  EmptyState,
  PageHeader,
  SegmentedControl,
  Skeleton,
  ToggleRow,
} from '../components/ui/Primitives'

interface CategoryModalProps {
  open: boolean
  onClose: () => void
  category: Category | null
  defaultType: CategoryType
  total: number
}

function CategoryModal({ open, onClose, category, defaultType, total }: CategoryModalProps) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [name, setName] = useState('')
  const [type, setType] = useState<CategoryType>('expense')
  const [color, setColor] = useState(PALETTE[0])
  const [icon, setIcon] = useState('tag')
  const [archived, setArchived] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    if (category) {
      setName(category.name)
      setType(category.type)
      setColor(category.color)
      setIcon(category.icon)
      setArchived(category.archived)
    } else {
      setName('')
      setType(defaultType)
      setColor(PALETTE[(total + 2) % PALETTE.length])
      setIcon(defaultType === 'expense' ? 'tag' : 'plus-circle')
      setArchived(false)
    }
  }, [open, category, defaultType, total])

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      category
        ? api.patch<Category>(`/categories/${category.id}`, payload)
        : api.post<Category>('/categories', payload),
    onSuccess: () => {
      queryClient.invalidateQueries()
      toast.success(category ? 'Categoria aggiornata' : 'Categoria creata')
      onClose()
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  })

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('Dai un nome alla categoria')
      return
    }
    mutation.mutate({
      name: name.trim(),
      type,
      color,
      icon,
      archived,
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={category ? 'Modifica categoria' : 'Nuova categoria'}
      description="Le categorie raggruppano movimenti e budget. Scegli un nome chiaro e un colore riconoscibile."
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Annulla
          </Button>
          <Button type="submit" form="category-form" loading={mutation.isPending}>
            {category ? 'Salva modifiche' : 'Crea categoria'}
          </Button>
        </div>
      }
    >
      <form id="category-form" onSubmit={handleSubmit} className="space-y-5">
        {error ? <FormError message={error} /> : null}

        <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2 p-3">
          <span
            className="grid h-12 w-12 shrink-0 place-items-center rounded-xl"
            style={{ backgroundColor: `${color}1f`, color }}
          >
            <AppIcon name={icon} className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">{name || 'La tua nuova categoria'}</p>
            <p className="text-xs text-muted">{type === 'expense' ? 'Categoria di spesa' : 'Categoria di entrata'}</p>
          </div>
        </div>

        <Field label="Nome" htmlFor="category-name">
          <Input
            id="category-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Es. Animale domestico, Formazione…"
            maxLength={80}
          />
        </Field>

        {category ? (
          <div className="flex items-center justify-between rounded-xl border border-line bg-surface-2 px-3.5 py-3">
            <div>
              <p className="text-[13px] font-medium text-ink">Tipo</p>
              <p className="mt-0.5 text-xs text-muted">
                {category.transaction_count > 0
                  ? 'Il tipo non è modificabile perché la categoria è già usata.'
                  : 'Puoi cambiare il tipo finché la categoria non viene usata.'}
              </p>
            </div>
            <Badge variant={category.type === 'expense' ? 'warning' : 'success'}>
              {category.type === 'expense' ? 'Spesa' : 'Entrata'}
            </Badge>
          </div>
        ) : (
          <SegmentedControl
            options={[
              { value: 'expense', label: 'Spesa' },
              { value: 'income', label: 'Entrata' },
            ]}
            value={type}
            onChange={setType}
            fullWidth
          />
        )}

        <ColorIconPicker color={color} icon={icon} onColorChange={setColor} onIconChange={setIcon} />

        {category ? (
          <ToggleRow
            checked={archived}
            onChange={setArchived}
            label="Archivia categoria"
            description="Resta nei movimenti storici ma non compare più nei nuovi inserimenti."
          />
        ) : null}
      </form>
    </Modal>
  )
}

export function CategoriesPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [type, setType] = useState<CategoryType>('expense')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [deleting, setDeleting] = useState<Category | null>(null)

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<Category[]>('/categories'),
  })

  const archiveMutation = useMutation({
    mutationFn: ({ category, archived }: { category: Category; archived: boolean }) =>
      api.patch<Category>(`/categories/${category.id}`, { archived }),
    onSuccess: () => {
      queryClient.invalidateQueries()
      toast.success('Categoria aggiornata')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (category: Category) => api.delete(`/categories/${category.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries()
      toast.success('Categoria eliminata')
      setDeleting(null)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const visible = categories.filter((category) => category.type === type)
  const expenseCount = categories.filter((category) => category.type === 'expense').length
  const incomeCount = categories.filter((category) => category.type === 'income').length

  const openCreate = () => {
    setEditing(null)
    setModalOpen(true)
  }

  const openEdit = (category: Category) => {
    setEditing(category)
    setModalOpen(true)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Categorie"
        title="Organizza i tuoi movimenti"
        subtitle="Crea categorie su misura per spese ed entrate. Colori e icone rendono i report immediati da leggere."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
            Nuova categoria
          </Button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          options={[
            { value: 'expense', label: `Uscite (${expenseCount})` },
            { value: 'income', label: `Entrate (${incomeCount})` },
          ]}
          value={type}
          onChange={setType}
          size="sm"
        />
        <p className="text-xs text-muted">
          {visible.filter((category) => category.archived).length > 0
            ? `${visible.filter((category) => category.archived).length} archiviate`
            : 'Tutte attive'}
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-3xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Tags}
            title="Nessuna categoria"
            description="Crea una categoria per iniziare a organizzare i movimenti di questo tipo."
            action={
              <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
                Nuova categoria
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((category) => (
            <article
              key={category.id}
              className={cn(
                'card group p-4 transition hover:border-line-strong',
                category.archived && 'opacity-70',
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                  style={{ backgroundColor: `${category.color}1c`, color: category.color }}
                >
                  <AppIcon name={category.icon} className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h3 className="truncate text-[13.5px] font-semibold text-ink">{category.name}</h3>
                    {category.is_default ? <Badge variant="neutral">Predefinita</Badge> : null}
                    {category.archived ? <Badge variant="warning">Archiviata</Badge> : null}
                  </div>
                  <p className="mt-0.5 text-[11.5px] text-muted">
                    {category.type === 'expense' ? 'Spesa' : 'Entrata'} · {category.transaction_count}{' '}
                    {category.transaction_count === 1 ? 'movimento' : 'movimenti'}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {category.budgeted ? <Badge variant="success">Budget attivo</Badge> : null}
                    {!category.budgeted && !category.archived ? (
                      <span className="text-[10.5px] text-muted">Nessun budget questo mese</span>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                  <IconButton label="Modifica categoria" onClick={() => openEdit(category)}>
                    <Pencil className="h-4 w-4" />
                  </IconButton>
                  <IconButton
                    label={category.archived ? 'Ripristina categoria' : 'Archivia categoria'}
                    onClick={() => archiveMutation.mutate({ category, archived: !category.archived })}
                  >
                    {category.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                  </IconButton>
                  <IconButton
                    label="Elimina categoria"
                    variant="danger"
                    onClick={() => setDeleting(category)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="card card-pad flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-ink">
          <Tag className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-[13px] font-semibold text-ink">Categorie e budget</h3>
          <p className="mt-0.5 text-[12px] leading-relaxed text-muted">
            Puoi creare un budget mensile solo per le categorie di spesa. Le categorie archiviate
            restano visibili nei movimenti e nei report storici, ma non sono più proposte nei nuovi
            inserimenti.
          </p>
        </div>
      </div>

      <CategoryModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        category={editing}
        defaultType={type}
        total={visible.length}
      />

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting)}
        title="Eliminare la categoria?"
        description={
          deleting
            ? deleting.transaction_count > 0
              ? `"${deleting.name}" è usata da ${deleting.transaction_count} movimenti. Archiviala per conservare lo storico.`
              : `"${deleting.name}" verrà rimossa definitivamente.`
            : ''
        }
        confirmLabel="Elimina categoria"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
