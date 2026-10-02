import { defineAgent } from "eve";

export default defineAgent({
  description: "Tuck: the stoic, steadfast brother in the debate (Claude).",
  model: "anthropic/claude-sonnet-5.5",
  tool: false,
  defaultTools: false,
});
