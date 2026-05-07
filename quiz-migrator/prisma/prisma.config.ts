import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "node:path";

const dbUrl = process.env.DATABASE_URL ?? "file:../data/quiz.db";

export default {
  earlyAccess: true,
  schema: path.join(import.meta.dirname, "schema.prisma"),
  migrate: {
    adapter: async () => {
      const adapter = new PrismaBetterSqlite3({ url: dbUrl });
      return adapter;
    },
  },
};
