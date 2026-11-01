import { Link } from 'react-router-dom'
import { Compass, Home } from 'lucide-react'
import { Button } from '../components/ui/Button'

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="card card-pad max-w-md text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent-ink">
          <Compass className="h-6 w-6" />
        </div>
        <p className="mt-5 font-display text-4xl font-extrabold tracking-tight text-ink">404</p>
        <h1 className="mt-1 text-lg font-bold text-ink">Pagina non trovata</h1>
        <p className="mt-2 text-sm text-muted">
          La pagina che cerchi non esiste o è stata spostata. Torna alla dashboard per riprendere da lì.
        </p>
        <Link to="/" className="mt-5 inline-block">
          <Button icon={<Home className="h-4 w-4" />}>Torna alla dashboard</Button>
        </Link>
      </div>
    </div>
  )
}
