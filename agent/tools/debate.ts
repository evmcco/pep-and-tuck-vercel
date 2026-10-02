import { defineWorkflowTool } from "eve/tools";
import { z } from "zod";

import {
  challengerPrompt,
  openingPrompt,
  otherSpeaker,
  parseStance,
  relayPrompt,
  shouldContinue,
  SPEAKER_NAMES,
  stripStance,
  type DebateResult,
  type DebateTurn,
  type Speaker,
} from "../lib/debate";

async function pickOpener(): Promise<Speaker> {
  "use step";
  return Math.random() < 0.5 ? "claude" : "gpt";
}

export default defineWorkflowTool({
  description:
    "Run a friendly back-and-forth debate about the user's question between Claude and GPT, and return the transcript.",
  inputSchema: z.object({
    question: z.string(),
    context: z.string().optional(),
  }),
  async execute({ question, context }, ctx) {
    "use workflow";

    const opener = await pickOpener();
    const sessions: Record<Speaker, ReturnType<typeof ctx.agent>> = {
      [opener]: ctx.agent(opener),
      [otherSpeaker(opener)]: ctx.agent(otherSpeaker(opener)),
    };

    const turns: DebateTurn[] = [];
    let errored = false;

    while (shouldContinue(turns)) {
      const speaker: Speaker =
        turns.length === 0 ? opener : otherSpeaker(turns[turns.length - 1].speaker);
      const previous = turns[turns.length - 1];
      const prompt =
        turns.length === 0
          ? openingPrompt(question, context)
          : turns.length === 1
            ? challengerPrompt(question, SPEAKER_NAMES[opener], previous.text)
            : relayPrompt(SPEAKER_NAMES[previous.speaker], previous.text);

      try {
        const response = await sessions[speaker].send(prompt, { signal: ctx.abortSignal });
        const result = await response.result();
        if (result.status === "failed" || !result.message) {
          errored = true;
          break;
        }
        turns.push({
          speaker,
          text: stripStance(result.message),
          stance: parseStance(result.message),
        });
      } catch {
        errored = true;
        break;
      }
    }

    const endedBy: DebateResult["endedBy"] = errored
      ? "error"
      : turns.length >= 2 && turns[turns.length - 1].stance === "agree"
        ? "agreement"
        : "max_turns";

    return { opener, turns, endedBy };
  },
});
