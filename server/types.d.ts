declare module "better-sqlite3-session-store" {
  import session from "express-session";
  import Database from "better-sqlite3";

  function createSqliteStore(
    session: typeof import("express-session")
  ): new (options: {
    client: Database.Database;
    expired?: {
      clear?: boolean;
      intervalMs?: number;
    };
  }) => session.Store;

  export = createSqliteStore;
}
