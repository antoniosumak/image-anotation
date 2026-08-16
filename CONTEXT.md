# UI Divergence Feedback

A local, single-developer tool for pointing a coding agent at exactly where its UI implementation drifted from the intended design. It exists because a drawn region is a higher-bandwidth channel to a model than a prose description of a location.

## Language

**Design reference**:
The intended appearance of a screen, as a Figma export or a screenshot of a design.
_Avoid_: mockup, spec, source of truth, target

**Implementation capture**:
A screenshot of the UI as actually built and running.
_Avoid_: screenshot (ambiguous — either side is a screenshot), actual, live shot

**Divergence**:
One specific, located way an implementation capture differs from its design reference.
_Avoid_: bug, diff, error, issue, defect

**Region**:
The rectangle drawn on an implementation capture that locates a divergence. Always a rectangle, because UI elements are rectangles.
_Avoid_: box, bounding box, selection, marker, annotation

**Report**:
The single artifact handed to the coding agent for one implementation capture: the annotated capture plus the note for every region on it. One report per capture, never one per divergence.
_Avoid_: payload, handoff (collides with the `/handoff` skill), prompt, export

**Stage**:
The fixed region of the screen an implementation capture is drawn inside. Its size comes from the window, never from the capture, so an oversized capture is shrunk or scrolled rather than allowed to lay the app out.
_Avoid_: canvas (taken — the rasterizing adapter), viewport, workspace

**Coding agent**:
The AI model that consumes reported divergences and edits the code to resolve them. The tool's only consumer.
_Avoid_: model, AI, assistant, LLM
