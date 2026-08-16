import { createFileRoute } from '@tanstack/react-router'

import { Button } from '#/components/ui/button'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col items-start gap-4 p-8">
      <h1 className="text-3xl font-semibold tracking-tight">
        UI Divergence Feedback
      </h1>
      <p className="text-muted-foreground">
        Nothing is wired up yet. This page exists to prove the stack renders.
      </p>
      <Button>Scaffold works</Button>
    </main>
  )
}
