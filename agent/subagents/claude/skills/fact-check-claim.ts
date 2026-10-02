import { defineSkill } from "eve/skills";

import { FACT_CHECK_CLAIM_MARKDOWN } from "../../../lib/skills";

export default defineSkill({
  description:
    "Use when the other agent's answer contains a specific factual claim (number, date, name, quote, statistic) that might be wrong.",
  markdown: FACT_CHECK_CLAIM_MARKDOWN,
});
