import { pgTable, text, integer, serial, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";

export const marketplaceListingsTable = pgTable("marketplace_listings", {
  id:          text("id").primaryKey(),
  sellerHash:  text("seller_hash").notNull(),
  title:       text("title").notNull(),
  description: text("description").notNull().default(""),
  price:       integer("price").notNull().default(0),
  currency:    text("currency").notNull().default("RUB"),
  category:    text("category").notNull().default("other"),
  condition:   text("condition").notNull().default("used"),
  imageUrls:   jsonb("image_urls").notNull().default([]),
  location:    text("location").notNull().default(""),
  sold:        boolean("sold").notNull().default(false),
  createdAt:   timestamp("created_at").defaultNow(),
});

export type MarketplaceListing = typeof marketplaceListingsTable.$inferSelect;
