# Her Diary prototype — instructions for this Claude Code session

You are building a demo prototype for a Senior PM take-home case (EverAI / Candy.ai).
Read `BUILD_PLAN.md` fully before writing code. The plan is the spec; this file is how to work.

## Ground rules

1. **Everything is faked, deliberately.** No model API, no keys, no network calls. Every "AI" behaviour
   is a scripted state machine driven by `seeds/*.json`. Delays and typing animations make it feel live.
   The README must say this plainly.
2. **No personal data, ever.** Seeds are fictional and SFW. The Candy shell (if provided in `shell/`)
   has already been scrubbed; if you find any username, avatar URL, ID, token or real message text in it,
   remove it before continuing.
3. **Use the user's personal GitHub.** Create the repo with `gh repo create her-diary-prototype --public --source=. --push`
   from the project root once the first runnable version exists. Commit in small steps with clear messages.
   If `gh` is not authenticated, stop and ask the user to run `gh auth login`.
4. **Deploy to Vercel** at the end with `vercel --prod` if the CLI is logged in; otherwise leave deploy
   instructions in the README and tell the user.
5. **Build order in `BUILD_PLAN.md §7` is binding.** Steps 1–5 are mandatory; cut from the bottom if late.
6. Stack: Next.js 14 (app router, TypeScript), no UI library, plain CSS modules on top of the Candy shell CSS.
   Keep dependencies minimal.
7. After each build step, run `npm run build` and fix errors before moving on.
8. When done, print: the repo URL, the deploy URL (or how to deploy), and a checklist against `BUILD_PLAN.md §10`.

## Where things are

- `BUILD_PLAN.md` — the spec: scenes, data model, fake-model behaviour, README, video beats.
- `seeds/conversation.json` — the seeded thread, scripted replies, regenerate variants.
- `seeds/diary.json` — the lines "she writes" on End conversation, the filtered line, the openers.
- `shell/` — static copy of Candy's conversation screen (HTML + CSS), if the user has added it.
  If `shell/` is empty, build a faithful lookalike of the conversation screen from `shell/README.md`.

## How the user gets the Candy shell (they do this, not you)

In Chrome on the conversation page: Ctrl+S → "Webpage, Complete" → save into `shell/raw/`.
Then you: extract the main conversation layout HTML and its CSS into `shell/conversation.html` and
`shell/candy.css`, replace every message body with `{{msg}}`, remove all scripts, remove all images
(swap for neutral placeholders), remove anything that looks like an ID, token, username or avatar.
Never commit `shell/raw/`. Add it to `.gitignore` first.
