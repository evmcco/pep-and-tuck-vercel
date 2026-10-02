import { defineInstructions } from "eve/instructions";

import { subagentInstructions, TUCK_PERSONA } from "../../../lib/instructions";

export default defineInstructions({
  content: subagentInstructions(TUCK_PERSONA),
});
