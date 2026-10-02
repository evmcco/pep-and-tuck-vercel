import { defineSkill } from "eve/skills";

import { RESPOND_TO_PUSHBACK_MARKDOWN } from "../../../lib/skills";

export default defineSkill({
  description: "Use when the other agent disagrees with or corrects something you said.",
  markdown: RESPOND_TO_PUSHBACK_MARKDOWN,
});
