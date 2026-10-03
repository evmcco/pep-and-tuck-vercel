export const MAX_TURNS = 5;

export const SPEAKERS = ["pep", "tuck"] as const;
export type Speaker = (typeof SPEAKERS)[number];

export const SPEAKER_NAMES: Record<Speaker, string> = {
  pep: "Pep",
  tuck: "Tuck",
};

export type Stance = "agree" | "partial" | "disagree";

export type DebateTurn = {
  speaker: Speaker;
  text: string;
  stance: Stance;
};

export type FollowUp = {
  question: string;
  answer: string | null;
};

export type DebateResult = {
  opener: Speaker;
  turns: DebateTurn[];
  endedBy: "agreement" | "max_turns" | "error";
  followUp: FollowUp | null;
  next: string;
};

export function otherSpeaker(speaker: Speaker): Speaker {
  return speaker === "pep" ? "tuck" : "pep";
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

const MARKER_WORDS = [STANCE_WORD, "FOLLOW-UP", "FOLLOW UP"];

function isMarkerish(line: string): boolean {
  const upper = line.trim().replace(/^\*+/, "").toUpperCase();
  if (upper === "") return false;
  return MARKER_WORDS.some((word) => word.startsWith(upper) || upper.startsWith(word));
}

export function stripMarkersStreaming(text: string): string {
  const newline = text.lastIndexOf("\n");
  if (newline === -1) return isMarkerish(text) ? "" : text;
  const tail = text.slice(newline + 1);
  return isMarkerish(tail) ? text.slice(0, newline).trimEnd() : text;
}

export function stripStanceStreaming(text: string): string {
  return stripMarkersStreaming(text);
}

const FOLLOWUP_LINE = /(^|\n)\s*\**\s*FOLLOW[- ]?UP\s*\**\s*:\s*\**\s*(.+?)\s*\**\s*$/i;

export function extractFollowUp(text: string): { text: string; question: string | undefined } {
  const stripped = stripStance(text);
  const match = stripped.match(FOLLOWUP_LINE);
  if (!match) return { text: stripped, question: undefined };
  const question = match[2]?.replace(/^\*+|\*+$/g, "").trim();
  if (!question) return { text: stripped, question: undefined };
  return { text: stripped.replace(FOLLOWUP_LINE, "").trimEnd(), question };
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
  return `The user asked: ${question}${prior}\n\nAnswer the user. You are opening the debate; your sibling will push back on your answer next. Then ask the user exactly one short follow-up question whose answer would most improve your advice (their situation, constraints, or what they meant). Put it on the final line in exactly this format:\nFOLLOW-UP: <your question>\nDo not add a STANCE line.`;
}

export function followUpBlock(openerName: string, followUp: FollowUp): string {
  return followUp.answer === null
    ? `${openerName} asked the user: ${followUp.question}\nThe user chose not to answer.`
    : `${openerName} asked the user: ${followUp.question}\nThe user replied: ${followUp.answer}`;
}

export function challengerPrompt(
  question: string,
  openerName: string,
  openerAnswer: string,
  followUp: FollowUp,
): string {
  const hint = followUp.answer === null ? "" : "Take the user's reply into account.";
  return `The user asked: ${question}\n\n${openerName} answered:\n${openerAnswer}\n\n${followUpBlock(openerName, followUp)}${hint ? `\n${hint}` : ""}\n\nYour turn. Engage with what ${openerName} actually said.`;
}

export function transcriptPrompt(
  question: string,
  speaker: Speaker,
  turns: readonly Pick<DebateTurn, "speaker" | "text">[],
  followUp: FollowUp | null,
): string {
  const transcript = turns
    .map((turn) => `**${SPEAKER_NAMES[turn.speaker]}:**\n${turn.text}`)
    .join("\n\n");
  const last = turns[turns.length - 1];
  const block = followUp === null ? "" : `\n\n${followUpBlock(SPEAKER_NAMES[turns[0].speaker], followUp)}`;
  return `The user asked: ${question}\n\nThe debate so far:\n\n${transcript}${block}\n\nYou are ${SPEAKER_NAMES[speaker]}. Reply to ${SPEAKER_NAMES[last.speaker]}'s latest message. Build on the discussion; don't repeat points you already made.`;
}
