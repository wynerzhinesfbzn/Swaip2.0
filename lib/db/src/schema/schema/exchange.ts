import { pgTable, text, numeric, timestamp, serial } from "drizzle-orm/pg-core";

export const swpWalletsTable = pgTable("swp_wallets", {
  id:          serial("id").primaryKey(),
  userHash:    text("user_hash").notNull().unique(),
  balanceRub:  numeric("balance_rub", { precision: 20, scale: 8 }).notNull().default("0"),
  balanceUsd:  numeric("balance_usd", { precision: 20, scale: 8 }).notNull().default("0"),
  balanceEur:  numeric("balance_eur", { precision: 20, scale: 8 }).notNull().default("0"),
  balanceGbp:  numeric("balance_gbp", { precision: 20, scale: 8 }).notNull().default("0"),
  balanceCny:  numeric("balance_cny", { precision: 20, scale: 8 }).notNull().default("0"),
  createdAt:   timestamp("created_at").defaultNow(),
  updatedAt:   timestamp("updated_at").defaultNow(),
});

export type SwpWallet = typeof swpWalletsTable.$inferSelect;
