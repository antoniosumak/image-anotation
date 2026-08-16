import { Badge } from '@plerivo/ui/badge'

/**
 * A heading for one of the rail's panels. Shared so the design reference and
 * the divergences beneath it read as two parts of one column rather than two
 * things that happened to be stacked.
 */
export function PanelHeading({
  children,
  count,
}: {
  children: React.ReactNode
  /** Shown beside the heading where there is something to count. */
  count?: number
}) {
  return (
    <div className="flex h-6 items-center gap-2">
      <h2 className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
        {children}
      </h2>
      {count ? (
        <Badge variant="muted" className="px-1.5 py-0 text-[11px]">
          {count}
        </Badge>
      ) : null}
    </div>
  )
}
