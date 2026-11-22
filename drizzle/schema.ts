import { bigint, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const a1TelemetryHistory = mysqlTable("a1_telemetry_history", {
  id: int("id").autoincrement().primaryKey(),
  printerId: varchar("printerId", { length: 16 }).notNull(),
  serial: varchar("serial", { length: 32 }),
  observedAt: bigint("observedAt", { mode: "number" }).notNull(),
  state: varchar("state", { length: 16 }).notNull(),
  progress: int("progress"),
  remainingSeconds: int("remainingSeconds"),
  nozzleTemperature: int("nozzleTemperature"),
  bedTemperature: int("bedTemperature"),
  fanSpeed: int("fanSpeed"),
  wifiSignal: int("wifiSignal"),
  layerNumber: int("layerNumber"),
  totalLayers: int("totalLayers"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type A1TelemetryHistory = typeof a1TelemetryHistory.$inferSelect;

// TODO: Add your feature tables here
