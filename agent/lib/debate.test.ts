import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  challengerPrompt,
  extractFollowUp,
  stripMarkersStreaming,
  transcriptPrompt,
  type FollowUp,
} from "./debate.ts";

describe("stripMarkersStreaming", () => {
  it("hides partial FOLLOW-UP tails while streaming", () => {
    assert.equal(stripMarkersStreaming("body\nFOL"), "body");
    assert.equal(stripMarkersStreaming("body\nFOLLOW-UP: Wh"), "body");
    assert.equal(stripMarkersStreaming("body\n**FOLLOW-UP: Wh"), "body");
  });

  it("keeps unrelated trailing lines", () => {
    assert.equal(stripMarkersStreaming("body\nstill typing"), "body\nstill typing");
    assert.equal(stripMarkersStreaming("no newline yet"), "no newline yet");
  });
});

describe("extractFollowUp", () => {
  it("extracts a plain trailing FOLLOW-UP line", () => {
    const result = extractFollowUp("Here is my answer.\nFOLLOW-UP: How big is your yard?");
    assert.equal(result.question, "How big is your yard?");
    assert.equal(result.text, "Here is my answer.");
  });

  it("handles a bold markdown variant", () => {
    const result = extractFollowUp("Answer.\n**FOLLOW-UP:** Rent or own?");
    assert.equal(result.question, "Rent or own?");
    assert.equal(result.text, "Answer.");
  });

  it("is case-insensitive", () => {
    const result = extractFollowUp("Answer.\nfollow-up: any pets?");
    assert.equal(result.question, "any pets?");
    assert.equal(result.text, "Answer.");
  });

  it("returns undefined and leaves the body alone when missing", () => {
    const result = extractFollowUp("Answer with no follow-up.");
    assert.equal(result.question, undefined);
    assert.equal(result.text, "Answer with no follow-up.");
  });

  it("ignores a FOLLOW-UP line that is not the last line", () => {
    const result = extractFollowUp("FOLLOW-UP: ignored?\nMore body text.");
    assert.equal(result.question, undefined);
    assert.equal(result.text, "FOLLOW-UP: ignored?\nMore body text.");
  });
});

describe("challengerPrompt", () => {
  const followUp = (answer: string | null): FollowUp => ({
    question: "How big is your yard?",
    answer,
  });

  it("includes the user's reply when answered", () => {
    const prompt = challengerPrompt("Q?", "Pep", "Pep's answer", followUp("Tiny"));
    assert.ok(prompt.includes("The user replied: Tiny"));
    assert.ok(prompt.includes("Take the user's reply into account."));
  });

  it("notes the skip when the user chose not to answer", () => {
    const prompt = challengerPrompt("Q?", "Pep", "Pep's answer", followUp(null));
    assert.ok(prompt.includes("The user chose not to answer."));
    assert.ok(!prompt.includes("Take the user's reply into account."));
  });
});

describe("transcriptPrompt", () => {
  it("contains every turn in order plus the speaker and last speaker names", () => {
    const debateTurns = [
      { speaker: "pep" as const, text: "First answer" },
      { speaker: "tuck" as const, text: "Pushback" },
      { speaker: "pep" as const, text: "Rebuttal" },
    ];
    const prompt = transcriptPrompt("Q?", "tuck", debateTurns, null);
    const firstIdx = prompt.indexOf("First answer");
    const pushIdx = prompt.indexOf("Pushback");
    const rebuttalIdx = prompt.indexOf("Rebuttal");
    assert.ok(firstIdx !== -1 && pushIdx > firstIdx && rebuttalIdx > pushIdx);
    assert.ok(prompt.includes("**Pep:**"));
    assert.ok(prompt.includes("**Tuck:**"));
    assert.ok(prompt.includes("You are Tuck."));
    assert.ok(prompt.includes("Pep's latest message"));
  });

  it("includes the follow-up block when followUp is given", () => {
    const debateTurns = [
      { speaker: "pep" as const, text: "First answer" },
      { speaker: "tuck" as const, text: "Pushback" },
    ];
    const prompt = transcriptPrompt("Q?", "pep", debateTurns, {
      question: "How big is your yard?",
      answer: "Tiny",
    });
    assert.ok(prompt.includes("Pep asked the user: How big is your yard?"));
    assert.ok(prompt.includes("The user replied: Tiny"));
    assert.ok(prompt.indexOf("The user replied: Tiny") < prompt.indexOf("You are Pep."));
  });

  it("omits the follow-up block when followUp is null", () => {
    const debateTurns = [
      { speaker: "pep" as const, text: "First answer" },
      { speaker: "tuck" as const, text: "Pushback" },
    ];
    const prompt = transcriptPrompt("Q?", "pep", debateTurns, null);
    assert.ok(!prompt.includes("asked the user"));
    assert.ok(!prompt.includes("The user replied"));
    assert.ok(!prompt.includes("The user chose not to answer"));
  });
});
