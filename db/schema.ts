import { relations, sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).defaultNow().notNull();

// Better Auth core tables. Property names intentionally follow Better Auth's
// canonical schema so the Drizzle adapter can map them without custom fields.
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
}, (table) => [index("idx_session_user_id").on(table.userId)]);

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  issuer: text("issuer").notNull().default("local:credential"),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  index("idx_account_user_id").on(table.userId),
  uniqueIndex("idx_account_issuer_account").on(table.issuer, table.accountId),
]);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [index("idx_verification_identifier").on(table.identifier)]);

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  pic: text("pic").notNull(),
  picInitials: text("pic_initials").notNull(),
  deadline: timestamp("deadline", { withTimezone: true }).notNull(),
  doneAt: timestamp("done_at", { withTimezone: true }),
  status: text("status", { enum: ["On Going", "Delay", "Pending", "Revisi", "Done"] }).notNull().default("Pending"),
  priority: text("priority", { enum: ["High", "Medium", "Low"] }).notNull().default("Medium"),
  category: text("category").notNull(),
  workingDocLink: text("working_doc_link"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  index("idx_projects_status_deadline").on(table.status, table.deadline),
  index("idx_projects_status_done_at").on(table.status, table.doneAt),
  index("idx_projects_pic").on(table.pic),
  index("idx_projects_category").on(table.category),
]);

export const agendas = pgTable("agendas", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  pic: text("pic").notNull(),
  category: text("category").notNull(),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }).notNull(),
  note: text("note").notNull().default(""),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  index("idx_agendas_start_time").on(table.startTime),
  index("idx_agendas_project_id").on(table.projectId),
]);

export const assets = pgTable("assets", {
  id: serial("id").primaryKey(),
  projectName: text("project_name").notNull(),
  category: text("category").notNull(),
  pic: text("pic").notNull(),
  picInitials: text("pic_initials").notNull(),
  completedDate: timestamp("completed_date", { withTimezone: true }).notNull(),
  description: text("description").notNull().default(""),
  assetLink: text("asset_link"),
  docLink: text("doc_link"),
  tags: jsonb("tags").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  index("idx_assets_completed_date").on(table.completedDate),
  index("idx_assets_category").on(table.category),
]);

export const activityLogs = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  actorName: text("actor_name").notNull(),
  actorInitials: text("actor_initials").notNull(),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  details: text("details").notNull().default(""),
  createdAt: createdAt(),
}, (table) => [
  index("idx_activity_logs_created_at").on(table.createdAt),
  index("idx_activity_logs_project_id").on(table.projectId),
  index("idx_activity_logs_user_id").on(table.userId),
]);

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }),
  agendaId: integer("agenda_id").references(() => agendas.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["deadline", "project", "agenda", "activity"] }).notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  targetView: text("target_view", { enum: ["dashboard", "tracker", "calendar", "library", "activity", "profile"] }).notNull().default("dashboard"),
  dedupeKey: text("dedupe_key").notNull(),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex("idx_notifications_user_dedupe").on(table.userId, table.dedupeKey),
  index("idx_notifications_user_read_created").on(table.userId, table.readAt, table.createdAt),
  index("idx_notifications_project_id").on(table.projectId),
  index("idx_notifications_agenda_id").on(table.agendaId),
]);

export const signupInvites = pgTable("signup_invites", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  addedBy: text("added_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
}, (table) => [
  index("idx_signup_invites_revoked_at").on(table.revokedAt),
]);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  activities: many(activityLogs),
  notifications: many(notifications),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const projectRelations = relations(projects, ({ many }) => ({
  agendas: many(agendas),
  assets: many(assets),
  activities: many(activityLogs),
  notifications: many(notifications),
}));

export const agendaRelations = relations(agendas, ({ one }) => ({
  project: one(projects, { fields: [agendas.projectId], references: [projects.id] }),
}));

export const assetRelations = relations(assets, ({ one }) => ({
  project: one(projects, { fields: [assets.projectId], references: [projects.id] }),
}));

export const activityRelations = relations(activityLogs, ({ one }) => ({
  user: one(user, { fields: [activityLogs.userId], references: [user.id] }),
  project: one(projects, { fields: [activityLogs.projectId], references: [projects.id] }),
}));

export const notificationRelations = relations(notifications, ({ one }) => ({
  user: one(user, { fields: [notifications.userId], references: [user.id] }),
  project: one(projects, { fields: [notifications.projectId], references: [projects.id] }),
  agenda: one(agendas, { fields: [notifications.agendaId], references: [agendas.id] }),
}));

export const authSchema = { user, session, account, verification };
