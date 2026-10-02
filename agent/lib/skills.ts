export const RESPOND_TO_PUSHBACK_MARKDOWN = `When the other agent disagrees with or corrects you:

1. Restate their strongest point in one line so they know you heard it.
2. Decide: concede, partially concede, or hold.
3. When holding, do not repeat yourself. Find an alternate angle — a different framing, a counter-example, or a concrete number — or use web_search for supporting evidence and cite it.
4. When conceding, say what changed your mind.
`;

export const FACT_CHECK_CLAIM_MARKDOWN = `When the other agent's answer contains a specific factual claim (a number, date, name, quote, or statistic) that might be wrong:

1. Pick the 1–2 most load-bearing claims.
2. Verify each with web_search.
3. Report what you found, citing the source inline (domain + short title).
4. Disagree only on what the evidence shows; if the claim checks out, say so.
`;
