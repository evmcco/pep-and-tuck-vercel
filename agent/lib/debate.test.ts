import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MAX_TURNS,
  parseStance,
  shouldContinue,
  stripStance,
  stripStanceStreaming,
  transcriptPrompt,
  type DebateTurn,
} from "./debate.ts";

describe("parseStance", () => {
  it("parses a trailing STANCE line", () => {
    assert.equal(parseStance("Good point!\nSTANCE: agree"), "agree");
    assert.equal(parseStance("Hmm.\nSTANCE: partial"), "partial");
    assert.equal(parseStance("No way.\nSTANCE: disagree"), "disagree");
  });

  it("is case-insensitive and tolerates trailing whitespace", () => {
    assert.equal(parseStance("text\n  STANCE: Agree  \n"), "agree");
  });

  it("defaults to partial when the line is missing", () => {
    assert.equal(parseStance("no stance here"), "partial");
    assert.equal(parseStance(""), "partial");
  });

  it("ignores a STANCE line that is not last", () => {
    assert.equal(parseStance("STANCE: agree\nbut then more text"), "partial");
  });
});

describe("stripStance", () => {
  it("removes the trailing STANCE line", () => {
    assert.equal(stripStance("Answer body.\nSTANCE: agree"), "Answer body.");
  });

  it("leaves other text untouched", () => {
    assert.equal(stripStance("STANCE: agree\nkept"), "STANCE: agree\nkept");
  });
});

describe("stripStanceStreaming", () => {
  it("hides a complete stance line", () => {
    assert.equal(stripStanceStreaming("body\nSTANCE: agree"), "body");
  });

  it("hides a partial stance line while streaming", () => {
    assert.equal(stripStanceStreaming("body\nSTA"), "body");
    assert.equal(stripStanceStreaming("body\nSTANCE: agr"), "body");
    assert.equal(stripStanceStreaming("body\nS"), "body");
  });

  it("keeps unrelated trailing lines", () => {
    assert.equal(stripStanceStreaming("body\nstill typing"), "body\nstill typing");
    assert.equal(stripStanceStreaming("no newline yet"), "no newline yet");
  });
});

const turns = (...stances: Array<DebateTurn["stance"]>) =>
  stances.map((stance) => ({ stance }));

describe("transcriptPrompt", () => {
  it("contains every turn in order plus the speaker and last speaker names", () => {
    const debateTurns = [
      { speaker: "pep" as const, text: "First answer" },
      { speaker: "tuck" as const, text: "Pushback" },
      { speaker: "pep" as const, text: "Rebuttal" },
    ];
    const prompt = transcriptPrompt("Q?", "tuck", debateTurns);
    const firstIdx = prompt.indexOf("First answer");
    const pushIdx = prompt.indexOf("Pushback");
    const rebuttalIdx = prompt.indexOf("Rebuttal");
    assert.ok(firstIdx !== -1 && pushIdx > firstIdx && rebuttalIdx > pushIdx);
    assert.ok(prompt.includes("**Pep:**"));
    assert.ok(prompt.includes("**Tuck:**"));
    assert.ok(prompt.includes("You are Tuck."));
    assert.ok(prompt.includes("Pep's latest message"));
  });
});

describe("shouldContinue", () => {
  it("continues after the opener's first turn", () => {
    assert.equal(shouldContinue(turns("agree")), true);
  });

  it("stops when a reply after turn 2 agrees", () => {
    assert.equal(shouldContinue(turns("disagree", "agree")), false);
    assert.equal(shouldContinue(turns("disagree", "partial", "agree")), false);
  });

  it("keeps going on partial or disagree", () => {
    assert.equal(shouldContinue(turns("partial", "disagree", "partial")), true);
  });

  it("stops at the max-turns cap", () => {
    assert.equal(shouldContinue(turns("disagree", "disagree", "partial", "disagree", "disagree")), false);
    assert.equal(MAX_TURNS, 5);
  });
});
