import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const accountsTable = pgTable("accounts", {
  hash:        text("hash").primaryKey(),
  publicKey:   text("public_key"),
  data:        jsonb("data").notNull().default({}),
  createdAt:   timestamp("created_at").defaultNow(),
  updatedAt:   timestamp("updated_at").defaultNow(),
  lastSeenAt:  timestamp("last_seen_at"),
});

export const insertAccountSchema = createInsertSchema(accountsTable).omit({ createdAt: true, updatedAt: true });
export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type Account = typeof accountsTable.$inferSelect;
