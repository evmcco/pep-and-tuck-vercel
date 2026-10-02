import { defineAgent } from "eve";

export default defineAgent({
  description: "One half of the debate: answers first or challenges Claude's answer.",
  model: "openai/gpt-6-sol",
  tool: false,
  defaultTools: false,
});
