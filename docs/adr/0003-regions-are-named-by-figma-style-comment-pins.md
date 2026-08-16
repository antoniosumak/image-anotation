# Regions are named by Figma-style comment pins, not by label plates

A region used to be named by a small rounded plate of the region's own colour, sitting above the rectangle with the number and — on the report image — the note in white text. It worked, but it was hard to *find*: an implementation capture is a screenshot of a UI, and a UI is already wall-to-wall flat coloured rectangles with text in them. A label plate is one more of those, so the eye has to search for it rather than land on it.

A region is now named by a **pin** shaped like a Figma comment: a disc with one corner squared off, a white collar and a shadow, with the squared corner touching a corner of the rectangle. The note goes on a **note card** beside it — dark text on white, the way Figma draws an open comment — but only on the report image, since on screen the note lives in the panel where it is written.

The shape is the whole point. Nothing in a screenshot of a UI is disc-shaped with one square corner, so a pin cannot be mistaken for part of the screenshot; and because the squared corner is the one that points, the shape also says *which* point on the capture is meant. The collar and the shadow are what keep it legible over a capture that may be any colour underneath — including the pin's own.

## Considered Options

- **Keep the plate and make it louder** — bigger, brighter, thicker. Rejected: every increment of loudness is also an increment of how much of the capture it hides, and the capture is the evidence. The problem was never that the plate was too quiet, it was that it was the same *kind* of thing as its surroundings.
- **A pin and no card, with the notes left to the text block.** Tempting, because the notes are already in the text block the developer pastes alongside. Rejected because the image is routinely pasted on its own, and a report that only makes sense with its text block attached is a report that will be handed over half-complete.
- **A pin and a card, the card only on the report image.** Chosen. On screen the note is already visible in the panel, and drawing it over the capture as well would cover the thing being marked up at exactly the moment the developer is looking at it.

## Consequences

A note card is taller than a pin as soon as the note runs to two lines, so the card grows *away* from the region — upwards from a pin that sits above it, downwards from one that sits below. It flips to the left of the pin when there is no room on the right. Both rules exist to stop the card lying across the divergence the note is about; the placement helper is unit-tested for exactly that, because it is not something the eye reliably catches on every capture.

The pin has no gap between its tip and the rectangle's corner. That is deliberate and worth not "fixing": the gap is what would make it read as a label that happens to be nearby rather than a pin stuck at that corner.

Figma's pin carries the commenter's avatar, because in Figma the useful thing to know at a glance is *who*. This tool has one author and a numbered list, so the number takes the avatar's place — the pin is the only place the number is drawn on the capture, and it is what the text block's entries refer to.
