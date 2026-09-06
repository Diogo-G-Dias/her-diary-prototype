# The Candy shell

This folder holds a **static, scrubbed reproduction** of Candy.ai's conversation screen, used only as
the visual frame for the demo. If it's empty, the user hasn't captured it yet — build a faithful lookalike
from the description below.

## How the user captures it (they do this in their own Chrome)

1. Open the conversation page while logged in.
2. Ctrl+S → "Webpage, Complete" → save into `shell/raw/` (this folder, gitignored).
3. Tell Claude Code it's there.

## What Claude Code does with it

From `shell/raw/`, extract the conversation layout into `shell/conversation.html` + `shell/candy.css`, then:
- Replace every message body with the token `{{msg}}`.
- Remove all `<script>` tags and inline JS.
- Remove or replace all images and avatars with neutral placeholders (a coloured circle for the avatar,
  a soft gradient block for character art).
- Delete anything resembling a username, real name, user id, conversation id, token, cookie, email, or
  `data-*` attribute carrying an id. Replace the character name with "Aria".
- Never commit `shell/raw/`.

## If there's no capture: build this layout

Dark theme (near-black background ~#0E0E12, panels ~#17171D, text ~#ECECEC, accent pink ~#E5397F).

- **Left sidebar** (~280px): app wordmark placeholder at top, a search box, then a vertical list of
  character rows — avatar circle, name, one-line last-message preview. "Aria" is the active row (highlighted).
- **Center column**: a header bar with Aria's avatar, her name and a small "online" dot; below it the
  scrolling **message list** — assistant bubbles left-aligned with the avatar, user bubbles right-aligned
  in the accent colour; generous rounding (~18px), comfortable line height.
- **Composer** pinned at the bottom: a rounded input, a send button, and on the last assistant message a
  small **Regenerate** (↻) control.
- **Right edge**: leave room for our `DiaryDrawer` to slide in (~360px) over the message list.

"Recognisably Candy", not pixel-perfect. Our components (`DiaryDrawer`, `RegenerateChips`,
`ReturnPanels`, `CostFooter`, `DemoControls`) mount into this frame.
