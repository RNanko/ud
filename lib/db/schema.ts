import { NoteItem } from "@/types/types";
import type { Blueprint, ExerciseDefinition, SessionData } from "../gym/types";
import type { MomentumData } from "../momentum/types";
import { relations } from "drizzle-orm";
import {
  pgTable,
  primaryKey,
  uniqueIndex,
  text,
  bigint,
  timestamp,
  boolean,
  integer,
  index,
  numeric,
  jsonb,
  unique,
  date,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  groqKey: text("groqKey").default('NO Key')
});

export const gymEntities = pgTable("gym_entities", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), data: jsonb("data").notNull().$type<Blueprint | ExerciseDefinition>(),
  revision: integer("revision").notNull().default(0), lastMutation: text("last_mutation").notNull(),
  archived: boolean("archived").notNull().default(false), createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [index("gym_entities_owner_idx").on(table.userId)]);
export const gymPlans = pgTable("gym_plans", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  date: date("date").notNull(), timezone: text("timezone").notNull(), data: jsonb("data").notNull().$type<Blueprint>(),
  revision: integer("revision").notNull().default(0), lastMutation: text("last_mutation").notNull(),
  archived: boolean("archived").notNull().default(false), createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [index("gym_plans_owner_date_idx").on(table.userId, table.date)]);
export const gymSessions = pgTable("gym_sessions", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  planId: text("plan_id").references(() => gymPlans.id, { onDelete: "set null" }),
  data: jsonb("data").notNull().$type<SessionData>(), revision: integer("revision").notNull().default(0),
  lastMutation: text("last_mutation").notNull(), archived: boolean("archived").notNull().default(false), createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [index("gym_sessions_owner_idx").on(table.userId), unique("gym_sessions_plan_unique").on(table.planId)]);
export const gymRestDays = pgTable("gym_rest_days", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  date: date("date").notNull(), timezone: text("timezone").notNull(), rest: boolean("rest").notNull(),
}, (table) => [unique("gym_rest_owner_date_unique").on(table.userId, table.date)]);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const financeTable = pgTable("finance_table", {
  id: text("id").primaryKey(),

  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),

  date: timestamp("date").notNull(),
  amount: numeric("amount").notNull().default("0"),
  currency: text("currency"),
  category: text("category"),
  subcategory: text("subcategory"),
  comment: text("comment"),
  type: text("type"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const financeCategories = pgTable("finance_categories", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  normalizedName: text("normalized_name").notNull(),
  hidden: boolean("hidden").notNull().default(false),
  type: text("type").notNull(),
}, (table) => [unique("finance_categories_owner_type_name").on(table.userId, table.type, table.normalizedName)]);

export const investmentPositions = pgTable("investment_positions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  assetId: text("asset_id"),
  symbol: text("symbol").notNull(),
  name: text("name").notNull(),
  buyPrice: numeric("buy_price", { precision: 30, scale: 12 }).notNull(),
  currency: text("currency").notNull().default("USD"),
  quantity: numeric("quantity", { precision: 30, scale: 12 }).notNull(),
  boughtOn: date("bought_on").notNull(),
  manualPrice: numeric("manual_price", { precision: 30, scale: 12 }),
  manualPriceAt: timestamp("manual_price_at"),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [index("investment_positions_owner_idx").on(table.userId)]);

export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key"),
  count: integer("count"),
  lastRequest: bigint("last_request", { mode: "number" }),
});

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const kanbanBoard = pgTable("kanban_board", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),

  data: jsonb("data").notNull(),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const momentumState = pgTable("momentum_state", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  data: jsonb("data").$type<MomentumData>().notNull(),
  revision: integer("revision").notNull().default(0),
  mutations: jsonb("mutations").$type<string[]>().notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userEvents = pgTable("user_events", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  week: text("week").notNull(), // "2026-WK4"
  data: jsonb("data").notNull(),
}, table => [uniqueIndex("user_events_owner_week_unique").on(table.userId, table.week)]);

export const userNotes = pgTable("user_notes", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  data: jsonb("data").notNull().$type<NoteItem[]>(),
});

// In your schema file

export const quotes = pgTable("quotes", {
  id: text("id").primaryKey(),
  author: text("author").notNull(),
  quote: text("quote").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  likesCount: integer("likes_count").notNull().default(0),
});

export const quoteLikes = pgTable(
  "quote_likes",
  {
    id: text("id").primaryKey(),
    quoteId: text("quote_id").notNull(),
    userId: text("user_id").notNull(),
  },
  (t) => [unique().on(t.quoteId, t.userId)],
);

// Define relations
export const quotesRelations = relations(quotes, ({ many }) => ({
  likes: many(quoteLikes),
}));

export const quoteLikesRelations = relations(quoteLikes, ({ one }) => ({
  quote: one(quotes, {
    fields: [quoteLikes.quoteId],
    references: [quotes.id],
  }),
}));

// npx drizzle-kit generate
// npx drizzle-kit migrate

export const b1AccountSettings = pgTable("b1_account_settings", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  product: text("product").notNull(),
  preferences: jsonb("preferences").notNull(),
  notifications: jsonb("notifications").notNull(),
  revision: integer("revision").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  notificationCheckedAt: timestamp("notification_checked_at", { withTimezone: true }),
}, table => [primaryKey({ columns: [table.userId, table.product] })]);

export const b1Memberships = pgTable("b1_memberships", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  product: text("product").notNull(),
  enrolledAt: timestamp("enrolled_at", { withTimezone: true }),
  trialStartedAt: timestamp("trial_started_at", { withTimezone: true }),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  customerId: text("customer_id").unique(),
  subscriptionId: text("subscription_id").unique(),
  billingCurrency: text("billing_currency"),
  priceId: text("price_id"),
  paidConfirmed: boolean("paid_confirmed").notNull().default(false),
  paidThrough: timestamp("paid_through", { withTimezone: true }),
  renewalOff: boolean("renewal_off").notNull().default(false),
  status: text("status").notNull().default("eligible"),
  graceUntil: timestamp("grace_until", { withTimezone: true }),
  operatorReview: boolean("operator_review").notNull().default(false),
  checkoutId: text("checkout_id"),
  checkoutOperation: text("checkout_operation"),
  checkoutCurrency: text("checkout_currency"),
  checkoutPrice: text("checkout_price"),
  checkoutLease: timestamp("checkout_lease", { withTimezone: true }),
  checkoutExpires: timestamp("checkout_expires", { withTimezone: true }),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  syncError: text("sync_error"),
  syncLock: text("sync_lock"),
  syncLease: timestamp("sync_lease", { withTimezone: true }),
  gracePeriodKey: text("grace_period_key"),
}, table => [primaryKey({ columns: [table.userId, table.product] })]);

export const b1RateBuckets = pgTable("b1_rate_buckets", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const b1EmailLedgers = pgTable("b1_email_ledgers", {
  recipientKey: text("recipient_key").notNull(),
  purpose: text("purpose").notNull(),
  sends: integer("sends").notNull().default(0),
  firstAt: timestamp("first_at", { withTimezone: true }),
  lastAt: timestamp("last_at", { withTimezone: true }),
  blockedUntil: timestamp("blocked_until", { withTimezone: true }),
  activeAttempt: text("active_attempt"),
}, table => [primaryKey({ columns: [table.recipientKey, table.purpose] })]);

export const b1EmailAttempts = pgTable("b1_email_attempts", {
  id: text("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  email: text("email").notNull(),
  purpose: text("purpose").notNull(),
  ownerId: text("owner_id").references(() => user.id, { onDelete: "cascade" }),
  oldEmail: text("old_email"),
  codeDigest: text("code_digest").notNull(),
  version: integer("version").notNull().default(1),
  wrongAttempts: integer("wrong_attempts").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  userId: text("user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const b1EmailOutbox = pgTable("b1_email_outbox", {
  id: text("id").primaryKey(),
  recipientKey: text("recipient_key").notNull(),
  scope: text("scope").notNull(),
  kind: text("kind").notNull(),
  payload: text("payload").notNull(),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  providerId: text("provider_id"),
  nextAt: timestamp("next_at", { withTimezone: true }).notNull().defaultNow(),
  leaseUntil: timestamp("lease_until", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  outcome: text("outcome"),
}, table => [index("b1_email_outbox_due").on(table.status, table.nextAt)]);

export const b1EmailSuppressions = pgTable("b1_email_suppressions", {
  scope: text("scope").notNull(),
  recipientKey: text("recipient_key").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [primaryKey({ columns: [table.scope, table.recipientKey] })]);

export const b1ProviderEvents = pgTable("b1_provider_events", {
  provider: text("provider").notNull(),
  eventId: text("event_id").notNull(),
  payload: jsonb("payload").notNull(),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  nextAt: timestamp("next_at", { withTimezone: true }).notNull().defaultNow(),
  leaseUntil: timestamp("lease_until", { withTimezone: true }),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [primaryKey({ columns: [table.provider, table.eventId] })]);

export const b1RecoveryClaims = pgTable("b1_recovery_claims", {
  tokenKey: text("token_key").primaryKey(),
  userId: text("user_id").notNull(),
  purpose: text("purpose").notNull(),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const b1NotificationReceipts = pgTable("b1_notification_receipts", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [primaryKey({ columns: [table.userId, table.key] })]);

export const b1Deletions = pgTable("b1_deletions", {
  userId: text("user_id").notNull(),
  product: text("product").notNull(),
  customerId: text("customer_id"),
  subscriptionId: text("subscription_id"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  error: text("error"),
}, table => [primaryKey({ columns: [table.userId, table.product] })]);
