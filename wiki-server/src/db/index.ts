import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";
import { config } from "../config.js";

const client = postgres(config.database.url);
export const db = drizzle(client, { schema });
