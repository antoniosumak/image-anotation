/**
 * Re-exported rather than reimplemented: the design system's components merge
 * their classes with this one, and two copies of `tailwind-merge` would resolve
 * a conflicting class differently depending on which side wrote it last.
 */
export { cn } from '@plerivo/ui/utils'
