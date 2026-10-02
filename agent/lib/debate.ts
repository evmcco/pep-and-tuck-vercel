export const MAX_TURNS = 5;

export const SPEAKERS = ["claude", "gpt"] as const;
export type Speaker = (typeof SPEAKERS)[number];

export const SPEAKER_NAMES: Record<Speaker, string> = {
  claude: "Claude",
  gpt: "GPT",
};

export type Stance = "agree" | "partial" | "disagree";

export type DebateTurn = {
  speaker: Speaker;
  text: string;
  stance: Stance;
};

export type DebateResult = {
  opener: Speaker;
  turns: DebateTurn[];
  endedBy: "agreement" | "max_turns" | "error";
};

export function otherSpeaker(speaker: Speaker): Speaker {
  return speaker === "claude" ? "gpt" : "claude";
}

const STANCE_LINE = /(^|\n)\s*STANCE:\s*(agree|partial|disagree)\b[^\n]*$/i;
const STANCE_WORD = "STANCE";

export function parseStance(text: string): Stance {
  const match = text.trimEnd().match(STANCE_LINE);
  const value = match?.[2]?.toLowerCase();
  if (value === "agree" || value === "partial" || value === "disagree") return value;
  return "partial";
}

export function stripStance(text: string): string {
  return text.replace(STANCE_LINE, "").trimEnd();
}

function isStanceish(line: string): boolean {
  const upper = line.trim().toUpperCase();
  if (upper === "") return false;
  return STANCE_WORD.startsWith(upper) || upper.startsWith(STANCE_WORD);
}

export function stripStanceStreaming(text: string): string {
  const newline = text.lastIndexOf("\n");
  if (newline === -1) return isStanceish(text) ? "" : text;
  const tail = text.slice(newline + 1);
  return isStanceish(tail) ? text.slice(0, newline).trimEnd() : text;
}

export function shouldContinue(
  turns: readonly Pick<DebateTurn, "stance">[],
  maxTurns: number = MAX_TURNS,
): boolean {
  if (turns.length >= maxTurns) return false;
  const last = turns[turns.length - 1];
  if (turns.length >= 2 && last?.stance === "agree") return false;
  return true;
}

export function openingPrompt(question: string, context?: string): string {
  const prior = context?.trim()
    ? `\n\nEarlier in this chat, for context:\n${context.trim()}`
    : "";
  return `The user asked: ${question}${prior}\n\nAnswer the user. You are opening the debate; ${SPEAKER_NAMES.gpt} or ${SPEAKER_NAMES.claude} will push back on your answer next.`;
}

export function challengerPrompt(
  question: string,
  openerName: string,
  openerAnswer: string,
): string {
  return `The user asked: ${question}\n\n${openerName} answered:\n${openerAnswer}\n\nYour turn. Engage with what ${openerName} actually said.`;
}

export function relayPrompt(otherName: string, otherReply: string): string {
  return `${otherName} replied:\n${otherReply}\n\nYour turn.`;
}
