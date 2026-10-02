import { defineAgent } from "eve";

export default defineAgent({
  description: "Pep: the fiery, sassy sister in the debate (GPT).",
  model: "openai/gpt-6-sol",
  tool: false,
  defaultTools: false,
});
