# Her Diary — prototype build plan (fully scripted demo)

The smallest slice that proves the one-pager: **she turns a conversation into a page you can read and
edit, and that page is what she opens the next chat from.** Built inside a static copy of Candy's own
conversation screen. No model calls: every AI behaviour is scripted from `seeds/`, with typing delays so
it reads as live. The README says so.

## 0. What the reviewer should believe after 3 minutes

- The diary is real to the user: she writes it after the conversation, in her voice, dated; a filter keeps the wrong things out.
- The user is in control: edit, delete, pin; a deleted line stays gone.
- The return moment changes: silence vs generic vs her opener, side by side.
- One cost number they can check, computed from stated assumptions.

Out of scope, stated in the README (not faked): consent flow, EU opt-in, EverGuard, cohorts, in-house inference, real extraction.

## 1. The shell

Static reproduction of `candy.ai/conversations/<id>`: sidebar, header with character, message list, composer.
Their JS removed, images replaced with neutral placeholders, no IDs or user data. Our components mount into it:
`DiaryDrawer`, `RegenerateChips`, `ReturnPanels`, `CostFooter`, `DemoControls` (a small bar: End conversation · Come back in 2 days · Reset chat · Restart demo).

If `shell/` is empty: rebuild the visible layout from `shell/README.md` (dark theme, left sidebar with character list, centered thread, rounded message bubbles, composer with Regenerate icon on the last reply). Aim for "recognisably Candy", not pixel-perfect.

## 2. Stack

- Next.js 14, app router, TypeScript, CSS modules. No UI kit.
- State: React context + `localStorage` behind `lib/diaryStore.ts` (get/set/delete/pin/tombstones). Persists across reload and Reset.
- Fake model: `lib/fakeModel.ts` — pure functions over `seeds/*.json` with `await sleep()` for realism:
  - `reply(threadState, preference?)` → next scripted reply (variant per chip if a preference is set).
  - `consolidate(turnsSinceLastRun, page, tombstones)` → lines from `seeds/diary.json` not already on the page and not tombstoned; also returns `rejected` (the filtered health line) with a reason.
  - `opener(page, days)` → scripted opener chosen by whether the last lines were scene or real-life.
  - `usage(kind)` → fake token counts for the cost footer, drawn from the assumptions in §6.
- Deploy: Vercel. Public GitHub repo on the user's personal account.

## 3. Data model

```ts
type DiaryLine = {
  id: string
  kind: 'taste' | 'fact' | 'scene'     // taste persists, fact is dated, scene expires
  text: string                          // her voice, second person
  date: string                          // "6 Sep"
  author: 'her' | 'you'                 // yours she never touches; editing hers makes it yours
  pinned: boolean
  sourceMsgId?: string                  // her lines always point at a user message
  expiresAt?: string                    // scene lines only
  deletedAt?: string                    // tombstone: never rewritten
}
type Diary = { characterId: string; lines: DiaryLine[] }
```

Three rules the code enforces (the one-pager promises them):
1. Her lines carry a `sourceMsgId` that exists in the thread, or they are not written.
2. A line with `deletedAt` is passed to `consolidate` as a tombstone and is never written again.
3. The visible page is at most 12 non-deleted lines: pinned first, then newest; older unpinned lines fold in (hidden behind "older lines").

## 4. The three scenes

### Scene 1 — Learn: watch her write the page
- Page loads with `seeds/conversation.json` thread already rendered: a short story scene (a hotel bar, rain outside), one real-life detail (user mentions a big presentation on Thursday), one taste signal (user says "slow down, I like the build-up"), and one line the filter must reject (user mentions a medication).
- User can send messages; replies are scripted (next in sequence; if the script is exhausted, a generic in-character reply).
- **End conversation** (labelled "stands in for the inactivity trigger") → drawer slides open → her lines appear one at a time, typed out, dated today, each marked "hers":
  - taste: "You like the build-up. Slow at the start, then let it turn."
  - fact: "Big presentation on Thursday. You said you were nervous about it." (expires Friday)
  - scene: "Hotel bar, rain outside. You had just sat down next to me." (tagged story, expires)
  - left off: "We left off with you about to say what you'd been thinking all day."
- Counter under the page: "1 line not written" → tooltip: "Health mention. Nothing inferred, nothing kept."

### Scene 2 — Correct: regenerate teaches her
- Regenerate on her last reply stays one tap. After it, four chips slide up above the composer: **slower · more direct · less talking · somewhere else**.
- Tapping a chip: writes a taste line to the diary immediately (no "model" delay) and swaps the reply for the chip's scripted variant. Old and new reply shown stacked for ~2 s, then the old one collapses.
- In the drawer: edit one of her lines (it becomes "yours"), delete another (tombstone; a small "won't come back" toast), pin one (moves to top).

### Scene 3 — Return: three panels
- **Come back in 2 days** clears the thread and shows three panels side by side (stack on mobile):
  - *silence*: empty chat, composer only
  - *generic*: "hey, missed you 🙂"
  - *diary*: opener from the page: "Still at the hotel bar, or somewhere new tonight? And it's Friday — how did Thursday go?"
  - Caption: "memory's effect is panel 3 minus panel 2". Clicking a panel continues from it.
- **Reset chat** wipes the thread; the drawer still shows the page.
- End conversation again on the new short exchange: the line deleted in Scene 2 does not come back (tombstone visible in a collapsed "deleted" section for the demo, labelled).

### Footer, always visible
`CostFooter`: per-"call" fake tokens and USD (consolidate ≈ 5.2k in / 200 out; opener ≈ 2.3k / 80; reply block 300 tokens) at 0.30 USD per M blended, and a running "per paid user per month" estimate = (23 consolidations + 23 openers + 450 × 300-token block) × price. Shows ≈ 0.09 USD, labelled "illustrative, from the assumptions in the doc".

## 5. Fake-model behaviour, precisely

- `consolidate` returns only lines from `seeds/diary.json` whose `sourceMsgId` exists in the thread and that are not on the page or tombstoned. It always returns the `rejected` health line with `reason: "health"` when the seeded medication message is in the thread.
- `reply` picks the next scripted reply; with a chip preference it returns that chip's variant from `regenerateVariants`.
- `opener` returns `openers.scene` if the newest non-deleted line is `scene`, else `openers.real`. If the fact line was deleted, it omits the Thursday reference (use `openers.sceneNoFact` / `openers.realNoFact`).
- `sleep` 600–1400 ms before "AI" output; typing animation 25 ms/char for diary lines, 15 ms/char for replies.

## 6. Cost assumptions (from the doc)

450 exchanges and 23 conversation boundaries per paid user per month; block 300 tokens per turn;
consolidation 5.2k tokens; opener 2.3k tokens; 0.30 USD per M tokens blended API-equivalent; in-house ≈ ⅓.

## 7. Build order (cut from the bottom; 1–5 mandatory)

1. Shell in place (from `shell/` or rebuilt). Thread renders seeds. Composer works with scripted replies.
2. `diaryStore` + `DiaryDrawer` (dated lines, "hers" mark, edit / delete / pin, cap 12, older-lines fold).
3. End conversation → typed-out lines + "1 line not written". (Scene 1)
4. Come back in 2 days → three panels; Reset keeps the page. (Scene 3)
5. Regenerate chips → line written, reply swapped. (Scene 2)
6. Tombstone proof on second End conversation.
7. `CostFooter`.
8. README, `.gitignore` (exclude `shell/raw/`), `gh repo create`, Vercel deploy.

## 8. README must contain

- What it proves; the three scenes; how to run (`npm i && npm run dev`).
- **Everything is scripted** — no model, no keys; what production would run instead (one consolidation call per conversation boundary on in-house inference; the prompts are in `docs/prompts.md`).
- Real vs faked table. Data model and the three rules. Cost footer formula.
- Shell note: static reproduction of Candy's conversation screen, content replaced, scripts and assets removed.
- AI-use note: "Claude Code built this from a build plan I wrote with Claude and ChatGPT; the scenes, rules and seed content are mine."
- Link to the two-page case doc.

Also write `docs/prompts.md` with the three production prompts (consolidate / reply / opener) and the post-filter rules, so the reviewer sees what the real version would send.

## 9. Video beats (under 3:00)

0:00 three quotes + two screenshots (profile 35%, Custom Memory 1/1) · 0:25 Scene 1 · 1:00 Scene 2 · 1:35 Scene 3 · 2:05 Reset keeps page, deleted line stays gone · 2:30 cost footer, "one job per conversation, one capped page, flat with tenure" · 2:45 the three decisions from the doc.

## 10. Definition of done

- [ ] Deploy link opens to the seeded thread inside the Candy-style shell
- [ ] End conversation types out four lines; "1 line not written" shows the filtered one
- [ ] A chip swaps the reply and writes a line
- [ ] Three panels render; the diary opener references the page (and drops Thursday if that line was deleted)
- [ ] Reset keeps the diary; a deleted line never returns
- [ ] Cost footer shows per-call and per-user-month figures with the "illustrative" label
- [ ] README: scripted-demo statement, real vs faked, prompts doc, AI-use note
- [ ] No personal data anywhere; `shell/raw/` ignored; repo public on the user's GitHub
