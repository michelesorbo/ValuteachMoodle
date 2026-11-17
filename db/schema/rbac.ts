import { index, pgEnum, pgTable, primaryKey, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

/** "global" roles are assigned to users; "course" roles are assigned through an enrollment. */
export const roleKind = pgEnum("role_kind", ["global", "course"]);

export const role = pgTable(
  "role",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Set for the built-in roles ("admin", "teacher", "student"): they cannot be deleted. */
    systemKey: text("system_key").unique(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    kind: roleKind("kind").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [unique("role_kind_name_unique").on(table.kind, table.name)],
);

/** Scope names are validated against the catalog in modules/auth/scopes.ts. */
export const roleScope = pgTable(
  "role_scope",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => role.id, { onDelete: "cascade" }),
    scope: text("scope").notNull(),
  },
  (table) => [primaryKey({ columns: [table.roleId, table.scope] })],
);

/** Global roles of a user. */
export const userRole = pgTable(
  "user_role",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => role.id, { onDelete: "restrict" }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.roleId] }), index("user_role_role_idx").on(table.roleId)],
);

/** Scopes assigned directly to a user, on top of their roles. Course scopes here apply to every course. */
export const userScope = pgTable(
  "user_scope",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    scope: text("scope").notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.scope] })],
);

export type Role = typeof role.$inferSelect;
