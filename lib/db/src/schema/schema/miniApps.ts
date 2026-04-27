import { pgTable, text, jsonb, timestamp, integer } from "drizzle-orm/pg-core";

export const miniAppsTable = pgTable("swaip_mini_apps", {
  id:          text("id").primaryKey(),
  ownerHash:   text("owner_hash").notNull(),
  name:        text("name").notNull().default("Мой мини-апп"),
  description: text("description").default(""),
  icon:        text("icon").default("✨"),
  config:      jsonb("config").notNull().default({}),
  isPublic:    text("is_public").default("false"),
  viewCount:   integer("view_count").default(0),
  createdAt:   timestamp("created_at").defaultNow(),
  updatedAt:   timestamp("updated_at").defaultNow(),
});

export type SwMiniApp = typeof miniAppsTable.$inferSelect;
