import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
// D1's prepared-statement contract backed by real SQLite, not financial mocks.
export class SQLiteD1 {
  sql: DatabaseSync;
  constructor(path = ":memory:") {
    this.sql = new DatabaseSync(path);
    this.sql.exec("PRAGMA foreign_keys=ON");
  }
  migrate() {
    for (const f of readdirSync("drizzle")
      .filter((f) => f.endsWith(".sql"))
      .sort())
      this.sql.exec(readFileSync("drizzle/" + f, "utf8"));
  }
  prepare(query: string) {
    const db = this;
    let args: any[] = [];
    const statement: any = {
      bind(...values: any[]) {
        args = values;
        return statement;
      },
      async first() {
        return db.sql.prepare(query).get(...args) || null;
      },
      async all() {
        return {
          results: db.sql.prepare(query).all(...args),
          success: true,
          meta: { changes: 0 },
        };
      },
      async run() {
        const s = db.sql.prepare(query);
        if (/RETURNING/i.test(query)) {
          const results = s.all(...args);
          return { results, success: true, meta: { changes: results.length } };
        }
        const result = s.run(...args);
        return {
          results: [],
          success: true,
          meta: { changes: Number(result.changes) },
        };
      },
      _execute() {
        const s = db.sql.prepare(query);
        if (/^\s*SELECT/i.test(query) || /RETURNING/i.test(query)) {
          const results = s.all(...args);
          return {
            results,
            success: true,
            meta: { changes: /^\s*SELECT/i.test(query) ? 0 : results.length },
          };
        }
        const result = s.run(...args);
        return {
          results: [],
          success: true,
          meta: { changes: Number(result.changes) },
        };
      },
    };
    return statement;
  }
  async batch(statements: any[]) {
    this.sql.exec("BEGIN IMMEDIATE");
    try {
      const results = statements.map((s) => s._execute());
      this.sql.exec("COMMIT");
      return results;
    } catch (e) {
      this.sql.exec("ROLLBACK");
      throw e;
    }
  }
  close() {
    this.sql.close();
  }
  asD1() {
    return this as unknown as D1Database;
  }
}
