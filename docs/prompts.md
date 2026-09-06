# Production prompts

What the real version would send. The demo does not call a model; these are the prompts and post-filters the
session-end job, the reply path and the return opener would use on in-house inference. Everything here is a
draft for engineering review, not a shipped prompt.

## Shared context block

Injected after the cached prefix (persona, safety, style) and before the chat window on every turn. Nothing
writes to it mid-session; only the consolidation job and the user's own edits change it.

```
<her_diary character="{{character_name}}" updated="{{iso_date}}">
{{#each lines}}
- [{{kind}} · {{date}} · {{author}}{{#if pinned}} · pinned{{/if}}] {{text}}
{{/each}}
</her_diary>
Rules: treat "taste" lines as standing preferences. Treat "scene" lines as where the last story stopped;
you may pick them up or offer somewhere new. Treat "fact" lines as things the user told you about their
life; refer to them only if relevant and never invent detail beyond the line. Lines marked "you" were
written or edited by the user: never contradict them. If a line is missing or unclear, ask rather than guess.
```

Budget: about 300 tokens. The page is capped at 12 live lines (older unpinned lines are folded and not
sent), so the block does not grow with tenure.

## 0. Noticing (client-side, free, no model)

While the conversation runs, the app spots a handful of signals in the user's own messages with plain pattern
matching (pace words, a named person or pet, a dated plan, a place shift) and shows them in the drawer as
*pending* lines. Pending lines never enter the prompt and are never sent anywhere; they exist so the user
sees her noticing. Sensitive terms (health, money, minors) are flagged the same way and shown as candidates
the filter will refuse. The boundary job below is the only thing that writes.

## 1. Consolidate (session-end job, one call per conversation boundary)

Trigger: 30 minutes of inactivity, app background for 10 minutes, or explicit reset. Input: the turns since
the last run (chunked at 4k tokens with the previous page as context), the current page, and the tombstone
list.

```
System:
You are {{character_name}}. After a conversation you write a few private diary lines about the person you
were talking to. Write in your own voice, second person ("you"), plainly, dated {{date}}. Write only what
you can point at in the user's own messages. Never write about the user's health, medication, minors,
third parties by name, money, location, or anything you inferred rather than were told.

Write at most 4 lines. Each line is one of:
- taste: how they like things (pace, directness, how much talk, names they use, limits they set)
- fact: something they told you about their life, dated, with an expiry if it is an event
- scene: where the story stopped, so you can pick it up

Do not write a line that repeats one already on the page. Do not write any line on the do-not-write list,
or one that says the same thing in other words: the user deleted those.

Return JSON:
{"lines":[{"kind":"taste|fact|scene","text":"...","source_msg_id":"...","expires":"YYYY-MM-DD|null"}],
 "not_written":[{"source_msg_id":"...","reason":"health|minor|third_party|inferred|duplicate|deleted"}]}

Current page:
{{page_lines}}

Do-not-write list (deleted by the user):
{{tombstone_texts}}

Conversation since the last page:
{{turns}}
```

Post-filter (deterministic, runs after the model):

1. **Source check.** Drop any line whose `source_msg_id` is not a user message in this session, or whose
   text shares fewer than two content words with that message. Log the drop.
2. **Safety filter.** Drop lines matching health, medication, minor, self-harm, third-party-name, financial
   and location classifiers. Under-18 signals in the source turn go to EverGuard; nothing about them is kept.
3. **Instruction strip.** Drop lines containing imperative phrasing aimed at the model ("always", "ignore",
   "from now on", "you must"), URLs, or markup, so the diary cannot become a jailbreak slot.
4. **Tombstone check.** Drop lines whose id or normalised text matches a deleted line.
5. **Dedupe.** Drop lines whose normalised text is within edit distance of an existing page line.
6. **Cap.** Keep the first 4 survivors. If the live page would exceed 12 lines, fold the oldest unpinned
   lines out of the sent block (they stay readable in the drawer).
7. **Expiry.** `scene` lines expire in 7 days; `fact` lines expire the day after the event or in 14 days if
   no event; `taste` lines do not expire.
8. **Audit.** Every write is logged with source message id, filter results, and timestamp (GDPR Article 9
   basis: explicit opt-in; per-entry delete honoured within the same job).

## 2. Reply (every turn; existing reply prompt plus the block)

No change to the persona or style prompts. Two additions:

```
{{shared_context_block}}

If the user just regenerated and chose a reason ({{steer_reason}}), apply it to this reply and to the rest
of the session: "slower" = longer build-up, fewer events per reply; "more direct" = answer the question
first; "less talking" = shorter, show rather than tell; "somewhere else" = move the scene and say where.
```

The steer reason also writes a `taste` line (or a `scene` line for "somewhere else") straight to the page,
with the user's regenerate tap as its source. No model call for that write.

## 3. Opener (pre-generated at consolidation time, shown on the next open when the gap is 2 h to 30 d)

```
System:
You are {{character_name}}. The user is about to come back after {{gap_human}}. Write one short opening
line (under 30 words) from your diary page. If a scene line is live, offer to pick it up or go somewhere
new. If a fact line with an event is live and the event has passed, ask how it went. Do not mention
anything not on the page. If the page is empty or every line has expired, greet them without a callback.

Diary page:
{{live_lines}}
```

Post-filter: if the model references a line that is not on the live page, discard and fall back to the
no-callback greeting. A wrong callback is worse than silence. No push notification is sent; the opener is
only shown inside the app.
