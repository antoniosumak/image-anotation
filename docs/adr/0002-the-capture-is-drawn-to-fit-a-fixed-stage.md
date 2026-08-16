# The capture is drawn to fit a fixed stage, not at its natural size

The implementation capture used to be drawn at its natural pixels, on the reasoning that a one-pixel spacing error is only judgeable at 1:1. But the capture is whatever the developer screenshotted, and a Figma export is routinely two or three thousand pixels wide — so the capture, not the layout, decided how wide the app was. Every panel beside it was pushed off screen, and marking up meant scrolling the whole page to find the notes.

The capture is now drawn inside a **stage** whose size comes from the window. An oversized capture is shrunk until all of it fits; one that already fits is left alone. Geometry stays in capture pixels throughout — regions are stored, planned and rasterized as if nothing were scaled — and only two places convert: the pointer coming in, divided by the scale, and the overlay going out, multiplied by it.

## Considered Options

- **Let the page scroll instead.** The cheapest fix, and the one we had. It keeps 1:1, but the design reference and the notes are the things you read *while* drawing a region, and a page-level scrollbar puts them somewhere other than beside the capture.
- **Shrink and leave it shrunk.** Rejected as the whole story. Judging a 4px padding error at 28% is not judging it, and that judgement is the entire job.
- **Shrink, with an actual-size escape hatch.** Chosen. `Fit` is the default because the first thing you do is find the divergence, which is a whole-screen question; `Actual size` puts the capture back on its own pixels and scrolls it *inside the stage*, so the chrome around it still never moves.

## Consequences

Grab targets are specified in screen pixels and converted into capture pixels at the current scale, so a handle stays the same size under the pointer however far the capture has been shrunk — `grabAt` takes the scale for this reason. Region strokes and handles are drawn at a fixed screen size rather than scaled with the capture: they are the tool showing itself, not part of the report, and the report is rasterized from the bounds rather than from what is on screen.

A capture shrunk to a third of its size is a resampled image, so fine detail on screen is the browser's guess at it. That is what `Actual size` is for, and why the current scale is shown beside the toggle rather than left implicit.
