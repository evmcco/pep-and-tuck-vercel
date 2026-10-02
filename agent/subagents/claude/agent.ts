import { defineAgent } from "eve";

export default defineAgent({
  description: "One half of the debate: answers first or challenges GPT's answer.",
  model: "anthropic/claude-sonnet-5.5",
  tool: false,
  defaultTools: false,
});
