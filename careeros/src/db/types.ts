import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type * as schema from "@/db/schema";

/** Injected Drizzle client (see `src/db/client.ts` or route handlers). */
export type DrizzleDB = NodePgDatabase<typeof schema>;
