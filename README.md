# eve debate

A standalone [eve](https://eve.dev) + Next.js app. Ask any question: one agent
answers, the other jumps in and pushes back, and the two have a short, friendly
back-and-forth. When they settle, a one-line **Bottom line** appears.

The debaters are **Claude** (`anthropic/claude-sonnet-5.5`) and **GPT**
(`openai/gpt-6-sol`), moderated by a root agent on `openai/gpt-5.4-mini`.

## Architecture

```
user question
    │
    ▼
root agent (moderator) ── calls `debate` exactly once
    │
    ▼
debate workflow tool
    │  pickOpener()  (random, in a workflow step)
    ▼
 opener ──► challenger ──► opener ──► challenger ──► …
 (Claude/GPT)   relay each other's latest reply every turn
    │
    ▼  ends early when a reply's STANCE is `agree`, capped at MAX_TURNS
root agent writes the one-line "Bottom line"
```

Each debater keeps its own session history across the debate, so the workflow
only relays the other agent's latest reply. Every reply ends with a
`STANCE: agree|partial|disagree` line that the workflow parses (and the UI
turns into a chip); the line is stripped before display.

The web app follows the root session, attaches to each child session announced
by `agent.started`, and renders one bubble per debate turn, streamed live.

## Layout

```
agent/
  agent.ts            root moderator (openai/gpt-5.4-mini)
  instructions.md
  channels/eve.ts     channel auth (OIDC + local dev + placeholder)
  tools/debate.ts     the workflow tool
  tools/agent.ts      disableTool() — no root-copy delegation
  lib/debate.ts       MAX_TURNS, stance parsing, prompt builders, turn-loop decision
  lib/skills.ts       shared skill markdown
  lib/instructions.ts shared subagent instruction builder
  lib/debate.test.ts  unit tests (node --test)
  subagents/claude/   Claude debater + tools + skills
  subagents/gpt/      GPT debater + tools + skills
apps/web/             Next.js chat UI
```

## Run it

```sh
pnpm install
pnpm dev
```

`pnpm dev` runs `next dev apps/web`. During development `apps/web/next.config.ts`
wraps the config with `withEve` from `eve/next`, which starts `eve dev --no-ui`
on a free port and rewrites `/eve/v1/*` to it, so the UI and the eve API share
`http://localhost:3000`. On Vercel, production routing is owned by the root
`vercel.ts` service graph and the plugin is not applied.

Models go through Vercel AI Gateway. Either set `AI_GATEWAY_API_KEY` in
`.env.local`, or link the project with `pnpm exec eve link`.

## Tuning

- Models: `agent/agent.ts` (moderator), `agent/subagents/claude/agent.ts`,
  `agent/subagents/gpt/agent.ts`.
- Turn cap: `MAX_TURNS` in `agent/lib/debate.ts`.
- Skills: markdown in `agent/lib/skills.ts`, declared per agent under
  `agent/subagents/<name>/skills/`.

## Other scripts

- `pnpm typecheck` — `tsc` over the agent + web sources.
- `pnpm test` — unit tests for the debate logic (`node --test`).
- `pnpm build` — `eve build` then `next build`.
