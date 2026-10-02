import { defineInstructions } from "eve/instructions";

import { subagentInstructions } from "../../../lib/instructions";

export default defineInstructions({
  content: subagentInstructions("GPT", "Claude"),
});
