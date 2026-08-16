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

**Coding agent**:
The AI model that consumes reported divergences and edits the code to resolve them. The tool's only consumer.
_Avoid_: model, AI, assistant, LLM
