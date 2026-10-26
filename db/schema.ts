import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
export const users = sqliteTable("users", {
  id: text().primaryKey(),
  username: text().notNull().unique(),
  password_hash: text().notNull(),
  recovery_hash: text().notNull(),
  session_version: integer().notNull().default(0),
  revision: integer().notNull().default(0),
  write_token: text(),
  display_name: text().notNull(),
  cycle_day: integer().notNull().default(1),
  safety_cents: integer().notNull().default(0),
  onboarded: integer().notNull().default(0),
  created_at: text().notNull(),
});
export const sessions = sqliteTable(
  "sessions",
  {
    token_hash: text().primaryKey(),
    user_id: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    version: integer().notNull(),
    expires_at: text().notNull(),
  },
  (t) => [index("session_user").on(t.user_id)],
);
export const attempts = sqliteTable("attempts", {
  key: text().primaryKey(),
  count: integer().notNull(),
  expires_at: integer().notNull(),
});
export const accounts = sqliteTable(
  "accounts",
  {
    id: text().primaryKey(),
    user_id: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text().notNull(),
    opening_cents: integer().notNull(),
    opening_date: text().notNull(),
  },
  (t) => [uniqueIndex("account_owner").on(t.user_id)],
);
export const categories = sqliteTable(
  "categories",
  {
    id: text().primaryKey(),
    user_id: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text().notNull(),
    priority: integer().notNull().default(3),
    limit_cents: integer(),
  },
  (t) => [index("category_owner").on(t.user_id)],
);
export const movements = sqliteTable(
  "movements",
  {
    id: text().primaryKey(),
    user_id: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text().notNull(),
    description: text().notNull(),
    amount_cents: integer().notNull(),
    category: text().notNull(),
    date: text().notNull(),
    effective_date: text(),
    competency_date: text(),
    payment_method: text().notNull().default("pix"),
    priority: integer().notNull().default(3),
    recurrence_id: text(),
    frequency: text(),
    created_at: text().notNull(),
  },
  (t) => [index("movement_owner_date").on(t.user_id, t.date)],
);
export const cards = sqliteTable(
  "cards",
  {
    id: text().primaryKey(),
    user_id: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text().notNull(),
    closing_day: integer().notNull(),
    due_day: integer().notNull(),
    limit_cents: integer(),
  },
  (t) => [index("card_owner").on(t.user_id)],
);
export const purchases = sqliteTable(
  "purchases",
  {
    id: text().primaryKey(),
    user_id: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    card_id: text()
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    description: text().notNull(),
    category: text().notNull(),
    total_cents: integer().notNull(),
    date: text().notNull(),
    count: integer().notNull(),
  },
  (t) => [index("purchase_owner").on(t.user_id)],
);
export const invoices = sqliteTable(
  "invoices",
  {
    id: text().primaryKey(),
    user_id: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    card_id: text()
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    month: text().notNull(),
    due_date: text().notNull(),
    closing_date: text().notNull(),
  },
  (t) => [
    uniqueIndex("invoice_card_month").on(t.card_id, t.month),
    index("invoice_owner_date").on(t.user_id, t.due_date),
  ],
);
export const installments = sqliteTable(
  "installments",
  {
    id: text().primaryKey(),
    user_id: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    purchase_id: text()
      .notNull()
      .references(() => purchases.id, { onDelete: "cascade" }),
    invoice_id: text()
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    installment_index: integer().notNull(),
    amount_cents: integer().notNull(),
  },
  (t) => [index("installment_invoice").on(t.invoice_id)],
);
export const payments = sqliteTable(
  "payments",
  {
    id: text().primaryKey(),
    user_id: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    invoice_id: text()
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    amount_cents: integer().notNull(),
    date: text().notNull(),
  },
  (t) => [index("payment_owner").on(t.user_id)],
);
export const goals = sqliteTable(
  "goals",
  {
    id: text().primaryKey(),
    user_id: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text().notNull(),
    description: text().notNull().default(""),
    target_cents: integer().notNull(),
    monthly_cents: integer().notNull(),
    deadline: text(),
    priority: integer().notNull(),
    color: text().notNull(),
    icon: text().notNull(),
    status: text().notNull().default("active"),
  },
  (t) => [index("goal_owner").on(t.user_id)],
);
export const contributions = sqliteTable(
  "contributions",
  {
    id: text().primaryKey(),
    user_id: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    goal_id: text()
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    amount_cents: integer().notNull(),
    kind: text().notNull().default("deposit"),
    date: text().notNull(),
  },
  (t) => [index("contribution_goal").on(t.goal_id)],
);
export const allocations = sqliteTable(
  "allocations",
  {
    id: text().primaryKey(),
    user_id: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    goal_id: text()
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    month: text().notNull(),
    reserved_cents: integer().notNull(),
  },
  (t) => [uniqueIndex("allocation_goal_month").on(t.goal_id, t.month)],
);
export const allocationUsages = sqliteTable(
  "allocation_usages",
  {
    id: text().primaryKey(),
    user_id: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    allocation_id: text()
      .notNull()
      .references(() => allocations.id, { onDelete: "cascade" }),
    contribution_id: text()
      .notNull()
      .references(() => contributions.id, { onDelete: "cascade" }),
    amount_cents: integer().notNull(),
  },
  (t) => [
    index("usage_allocation").on(t.allocation_id),
    index("usage_contribution").on(t.contribution_id),
  ],
);
export const audit = sqliteTable(
  "audit",
  {
    id: text().primaryKey(),
    user_id: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    description: text().notNull(),
    date: text().notNull(),
  },
  (t) => [index("audit_owner").on(t.user_id)],
);
