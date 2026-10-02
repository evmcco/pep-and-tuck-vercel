import { defineInstructions } from "eve/instructions";

import { PEP_PERSONA, subagentInstructions } from "../../../lib/instructions";

export default defineInstructions({
  content: subagentInstructions(PEP_PERSONA),
});
