# Reports are annotated images; the tool never resolves a region to code

A region is a rectangle over pixels, and the obvious next step would be to turn it into something that names code — a CSS selector, a component, a line number. We deliberately don't: a report hands the coding agent the annotated implementation capture and the notes, and the agent resolves which JSX produces that rectangle by working against the repo it already has.

## Considered Options

- **Emit a CSS selector.** Requires reading the DOM under the region, which means capturing from a live tab rather than accepting a pasted image — i.e. becoming a browser extension. That is a different product with a different distribution story, and it makes the tool useless for the case that motivated it: a design reference exported from Figma, which has no DOM at all.
- **Emit pixel coordinates plus a note.** Rejected outright. Coordinates are less meaningful to an agent than the prose they'd replace, and shipping them would discard the tool's entire advantage — that a drawn region is unambiguous where a description of a location isn't.

## Consequences

Precision depends on the agent's vision correctly mapping a boxed element to its source. If it starts fixing the wrong element despite an unambiguous region, that — not a richer coordinate format — is the signal to revisit DOM capture.
