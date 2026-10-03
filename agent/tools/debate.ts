import { defineWorkflowTool, type WorkflowToolContext } from "eve/tools";
import { z } from "zod";

import {
  challengerPrompt,
  extractFollowUp,
  openingPrompt,
  otherSpeaker,
  parseStance,
  shouldContinue,
  SPEAKER_NAMES,
  stripStance,
  transcriptPrompt,
  type DebateResult,
  type DebateTurn,
  type FollowUp,
  type Speaker,
} from "../lib/debate";

async function pickOpener(): Promise<Speaker> {
  "use step";
  return Math.random() < 0.5 ? "pep" : "tuck";
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

async function askFollowUp(
  ctx: WorkflowToolContext,
  opener: Speaker,
  question: string | undefined,
): Promise<FollowUp> {
  const text =
    question ??
    `Anything about your situation I should know before ${SPEAKER_NAMES[otherSpeaker(opener)]} jumps in?`;
  try {
    const response = await ctx.ask({
      prompt: text,
      allowFreeform: true,
      dismissible: true,
      display: "text",
      options: [{ id: "skip", label: "Skip" }],
    });
    const answer =
      response.status === "answered" && response.optionId !== "skip" && response.text?.trim()
        ? response.text.trim()
        : null;
    return { question: text, answer };
  } catch {
    return { question: text, answer: null };
  }
}

export default defineWorkflowTool({
  description:
    "Run a friendly back-and-forth debate about the user's question between Pep and Tuck, and return the transcript.",
  inputSchema: z.object({
    question: z.string(),
    context: z.string().optional(),
  }),
  async execute({ question, context }, ctx) {
    "use workflow";

    const opener = await pickOpener();
    const turns: DebateTurn[] = [];
    let followUp: FollowUp | null = null;
    let errored = false;

    while (shouldContinue(turns)) {
      const speaker: Speaker =
        turns.length === 0 ? opener : otherSpeaker(turns[turns.length - 1].speaker);
      const prompt =
        turns.length === 0
          ? openingPrompt(question, context)
          : turns.length === 1 && followUp !== null
            ? challengerPrompt(question, SPEAKER_NAMES[opener], turns[0].text, followUp)
            : transcriptPrompt(question, speaker, turns, followUp);

      try {
        const reply = await ctx.agent(speaker, { message: prompt });
        const message = replyText(reply);
        if (!message) {
          errored = true;
          break;
        }
        if (turns.length === 0) {
          const extracted = extractFollowUp(message);
          turns.push({ speaker, text: extracted.text, stance: "partial" });
          followUp = await askFollowUp(ctx, opener, extracted.question);
        } else {
          turns.push({
            speaker,
            text: stripStance(message),
            stance: parseStance(message),
          });
        }
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

    return {
      opener,
      turns,
      endedBy,
      followUp,
      next: "The debate is finished. Reply now with the one-sentence Bottom line. Do not call debate again.",
    };
  },
});
