# Her Diary: prototype

A fully scripted demo of **Her Diary**, the memory feature proposed in my Senior PM case for EverAI (Candy.ai).
It proves the smallest slice of the one-pager: **she turns a conversation into a page you can read and edit,
and that page is what she opens the next chat from.**

- Live demo: https://her-diary-prototype.vercel.app
- Case doc (two pages): [Retention through the companion experience](https://docs.google.com/document/d/1G9b514-8ZQip1RkWp7yfY7DwpvchnIUiPxm2Jb0Cv1E/edit?usp=sharing)
- Production prompts the real version would send: [`docs/prompts.md`](docs/prompts.md)

## Everything is scripted

**There is no model behind this demo.** No API, no keys, no network calls. Every "AI" behaviour is a state
machine over `seeds/*.json` with 600 to 1400 ms delays and typing animations so it reads as live. The cost
footer counts fake tokens from stated assumptions.

Production would run one small consolidation call per conversation boundary on in-house inference, one
pre-generated opener, and a 300-token diary block on every turn. The prompts and post-filters are in
[`docs/prompts.md`](docs/prompts.md).

## The three scenes

1. **Learn.** The thread opens mid-story (a hotel bar, rain outside) with one real-life detail, one taste
   signal, and one line the filter must reject. As you talk, dimmed *noticing...* lines form in the drawer
   for free: a deterministic noticer in the browser, no model call, nothing in her prompt yet. The header
   reads like "2 noticed · 0 written". **End conversation** (it stands in for the inactivity trigger) is the
   one faked consolidation call: pending lines firm up into dated lines marked *hers*, the story lines only
   the boundary job writes are typed out, and the therapy mention is visibly struck through with its reason
   before it fades. Header: "4 written · 1 not kept".
2. **Correct.** **Regenerate** on her last reply stays one tap. After it, four chips ask why: *slower · more
   direct · less talking · somewhere else*. A chip writes a taste line to the diary at once and swaps the
   reply for that chip's variant. In the drawer you can edit a line (it becomes *yours*), delete one (a
   tombstone: it never comes back), or pin one (stays on top, never folds).
3. **Return.** **Come back in 2 days** clears the thread and shows three panels side by side: silence, a
   generic "hey, missed you", and her opener written from the page. Memory's effect is panel 3 minus panel
   2. If you deleted the Thursday line, the opener drops the Thursday question. **Reset chat** wipes the
   thread; the page survives. End the conversation again and the deleted line stays deleted.

## Run it

```
npm i
npm run dev
```

Open http://localhost:3000. **Restart demo** in the top bar clears the saved diary (localStorage) and reloads.

## Real vs faked

| Real in this demo | Faked or out of scope |
| --- | --- |
| The diary store: add, edit, delete (tombstone), pin, 12-line cap, fold, persistence across reload and Reset | Extraction at the boundary: the polished lines come from `seeds/diary.json`, gated by the three rules below |
| The noticer (`lib/notice.ts`): a pure regex function that proposes at most one pending line per message and flags sensitive terms | The safety filter's judgement: the regex list stands in for a classifier |
| The three rules, enforced in code (`lib/diaryStore.ts`, `lib/fakeModel.ts`), plus a tombstone check by wording, not only by id | Replies to free-typed messages: scripted sequence, then a small pool of fallback lines |
| The return-moment logic: opener chosen from what is live on the page, omitting deleted or expired lines | Reply generation: scripted sequence plus one variant per chip |
| The cost arithmetic from the stated assumptions | Consent flow, EU opt-in, EverGuard, cohorts, in-house inference, a real inactivity trigger |
| Dates and expiry on a fictional calendar (Wed 6 Sep, presentation Thu, return Fri) | The frame: a scrubbed static capture of the conversation screen, nothing in it works except our slots |

## Data model and the three rules

```ts
type DiaryLine = {
  id: string
  kind: 'taste' | 'fact' | 'scene'   // taste persists, fact is dated, scene expires
  text: string                        // her voice, second person
  date: string                        // "6 Sep"
  author: 'her' | 'you'               // yours she never touches; editing hers makes it yours
  pinned: boolean
  sourceMsgId?: string                // her lines always point at a user message
  expiresAt?: string                  // scene and fact lines only
  deletedAt?: string                  // tombstone: never rewritten
}
```

1. Her lines carry a `sourceMsgId` that exists in the thread, or they are not written.
2. A line with `deletedAt` is passed to consolidation as a tombstone and is never written again, by id or
   by saying the same thing in other words.
3. The visible page is at most 12 committed lines: pinned first, then newest. Older unpinned lines fold in.

Every line also has a `status`. **Pending** lines are noticed live, cost nothing and do not ride the prompt
block. **Committed** lines are written by the one consolidation call at the conversation boundary. Chips
(explicit corrections) write committed lines directly.

## Cost footer

Per call: consolidate 5.2k in / 200 out, opener 2.3k in / 80 out, diary block 300 tokens per turn, at 0.30 USD
per million tokens blended API-equivalent. Noticing is free and logs nothing; exactly one consolidation call
appears per End conversation. Per paid user per month:

```
(23 consolidations x 5.4k + 23 openers x 2.4k + 450 turns x 300) = 314k tokens x $0.30/M = about $0.09
```

In-house inference at about a third: about $0.03. Labelled *illustrative, from the assumptions in the doc*.
One job per conversation, one capped page, so the cost is flat with tenure.

## The shell

The frame is Candy.ai's real conversation screen, captured once from a logged-in session with Chrome's
"Webpage, Complete" save and turned into a static, scrubbed fixture by `shell/build_shell.py`:

- scripts, iframes, hidden modals, toasts, forms and every identifier, data attribute, handler and link
  target removed;
- every message, chat-list name, preview and timestamp replaced and the character renamed Aria; every
  image and icon the save included copied into `public/shell/` so the frame is a 1:1 visual copy;
- the stylesheet purged from 943 KB to the rules the frame and our components actually use, with every
  external asset reference stripped.

The result is `shell/conversation.html` (also emitted as `lib/shellHtml.ts`) and `shell/candy-purged.css`.
Six slots are left in the frame (`thread`, `composer`, `chatlist`, `drawer`, `controls`, `cost`) and
`components/CandyShell.tsx` portals the demo's React components into them, so Her Diary lives in the
right-hand panel where Candy shows the character profile. The raw capture stays in `shell/raw/`, which is
gitignored; rerun `python shell/build_shell.py` to regenerate the fixture. The frame is a visual stand-in
for a take-home demo, not a copy of the product: nothing in it is interactive except our components.

## No personal data

Seeds are fictional and SFW. Nothing leaves the browser: the diary lives in `localStorage` on your machine.
Character portraits in `public/avatars/` are five random stock portraits from the randomuser.me set, bundled
locally so the demo makes no network requests. They stand in for character art and belong to no one in
the story.

## AI use

Claude Code built this from a build plan I wrote with Claude and ChatGPT; the scenes, rules and seed content
are mine.

## Deploy

```
vercel --prod
```

Any static Next.js host works; there is no server-side code.
