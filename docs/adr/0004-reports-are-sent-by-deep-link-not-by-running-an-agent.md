# Reports are sent by deep link, and the tool never runs a coding agent

Handing a report over used to end at the developer: copy the image, or write it and copy the text block, then go and paste it somewhere. The paste is the part with nothing in it — the report is finished before it happens, and the only thing standing between a marked-up capture and a coding agent looking at it was an alt-tab.

**Send to Claude Code** closes that gap by following a `claude-cli://open` link. Claude Code registers that URL scheme with the operating system, so the link opens a new terminal session in the project with the prompt already typed into its input box. The developer reads it and presses Enter.

The tool does not run Claude. It writes an image, builds a prompt, and hands a URL to the operating system — the session that opens is the developer's own, in their own terminal, under their own permission rules and their own `CLAUDE.md`.

## Considered Options

- **Spawn `claude -p` from a server function and stream the result into the app.** The obvious reading of "send it to Claude Code", and the wrong one. It makes the tool an agent runner: it would need a permission posture of its own — headless mode cannot stop and ask, so anything it was allowed to do it would do unattended — and a transcript panel to show what happened, which is a second UI for a thing the developer's terminal already renders better. It also answers to nobody: a run started by a button press in a browser tab has no session the developer is sitting in front of.
- **`claude -c -p`, continuing the most recent conversation in the directory.** Closer to "*your* Claude Code" than a fresh session, and rejected for the risk that makes it appealing. If the developer has that session open — which is the whole scenario — two writers share one transcript.
- **An MCP server the running session pulls reports from.** Sound, and inverted: the developer would have to ask for the report they just made, which is the alt-tab again with extra setup.
- **A `claude-cli://` deep link.** Chosen. The delivery mechanism is a URL, so the tool needs no subprocess, no permission model, no streaming transport and no opinion about what the agent is allowed to do — all of which stay where they already were, with Claude Code.

## Consequences

**The session opens on the machine where the link is clicked, not where the app is running.** That is the browser's machine. The report image is written by the server, so the two must be the same computer — which they are, for a tool that is run locally and holds no login. Run the app on one machine and open it from another and the link opens a session pointing at an image that isn't there. The two older buttons still work in that case, and that is now most of what they are for.

**Nothing happens until the developer presses Enter.** The link fills the prompt box; it does not send it. This is a property of Claude Code's handler rather than a choice made here, and it is the right one — the prompt is a request to change code, and it arrives somewhere it can be read and edited first.

**Whether the link was handled is not knowable from the page.** Following a `claude-cli://` URL is handing a string to the operating system, which reports nothing back. Claude Code registers the handler on first prompt of an interactive session, so a machine where it has never been run interactively will do nothing at all when the button is pressed. The button therefore says `Sent` and never `Opened` — and the status bar keeps saying where the image was written, because that path is what the developer falls back to when nothing happened.

**Reports are written inside the project rather than beside the app.** A session started in the project can read a file under it without stopping to ask for access outside its working directory, and a report the agent has to be talked into opening is one that was not really handed over. `UI_DIVERGENCE_PROJECT_DIR` names the project when the app is not being run from inside it; otherwise it is where the app was started, as before.

**The prompt asks for something; the text block only describes.** A pasted report lands in a conversation that is already about something, so `reportTextReferencing` names the image and lists the notes. A session opened from a link holds nothing else, so `reportPromptReferencing` also has to say what the picture is and what is being asked for — otherwise the report arrives as a screenshot with red rectangles on it and no request attached.

**A link carries 5,000 characters, and past that the notes come off rather than get cut.** Claude Code truncates a longer prompt, and a truncated report is one whose last few notes went missing without saying so. Dropping the whole text block instead is lossless, because ADR-0003 already put every note on a card beside its pin *on the image* — the agent reads them off the picture rather than out of the prompt. This is the second time that duplication has paid for itself, and it is worth not "tidying away".
