import { pgTable, text, jsonb, timestamp, integer } from "drizzle-orm/pg-core";

export const botsTable = pgTable("swaip_bots", {
  id:          text("id").primaryKey(),
  ownerHash:   text("owner_hash").notNull(),
  name:        text("name").notNull().default("Мой бот"),
  avatarUrl:   text("avatar_url"),
  description: text("description").default(""),
  config:      jsonb("config").notNull().default({}),
  isPublic:    text("is_public").default("false"),
  startCount:  integer("start_count").default(0),
  createdAt:   timestamp("created_at").defaultNow(),
  updatedAt:   timestamp("updated_at").defaultNow(),
});

export type SwBot = typeof botsTable.$inferSelect;
