import { fileURLToPath } from "node:url";

import { withEve } from "eve/next";
import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

const nextConfig: NextConfig = {
  experimental: {
    useTypeScriptCli: true,
  },
};

// Development: start `eve dev` and rewrite /eve/v1/* to it so the UI and API
// share one origin. Production routing is owned by the root vercel.ts service
// graph, so the plugin only wraps the config during `next dev`.
export default (phase: string, context: { defaultConfig: NextConfig }) =>
  phase === PHASE_DEVELOPMENT_SERVER
    ? withEve(nextConfig, {
        eveRoot: fileURLToPath(new URL("../../", import.meta.url)),
      })(phase, context)
    : nextConfig;
