import { defineWorkflowTool } from "eve/tools";
import { z } from "zod";

import {
  challengerPrompt,
  openingPrompt,
  otherSpeaker,
  parseStance,
  shouldContinue,
  SPEAKER_NAMES,
  stripStance,
  transcriptPrompt,
  type DebateResult,
  type DebateTurn,
  type Speaker,
} from "../lib/debate";

async function pickOpener(): Promise<Speaker> {
  "use step";
  return Math.random() < 0.5 ? "claude" : "gpt";
}

function replyText(reply: unknown): string {
  if (typeof reply === "string") return reply;
  if (
    reply !== null &&
    typeof reply === "object" &&
    "message" in reply &&
    typeof reply.message === "string"
  ) {
    return reply.message;
  }
  return "";
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
    const turns: DebateTurn[] = [];
    let errored = false;

    while (shouldContinue(turns)) {
      const speaker: Speaker =
        turns.length === 0 ? opener : otherSpeaker(turns[turns.length - 1].speaker);
      const prompt =
        turns.length === 0
          ? openingPrompt(question, context)
          : turns.length === 1
            ? challengerPrompt(question, SPEAKER_NAMES[opener], turns[0].text)
            : transcriptPrompt(question, speaker, turns);

      try {
        const reply = await ctx.agent(speaker, { message: prompt });
        const message = replyText(reply);
        if (!message) {
          errored = true;
          break;
        }
        turns.push({
          speaker,
          text: stripStance(message),
          stance: parseStance(message),
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
