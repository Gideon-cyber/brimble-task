import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const deployments = sqliteTable("deployments", {
  id: text("id").primaryKey(),
  status: text("status").notNull().default("pending"),
  gitUrl: text("git_url"),
  containerName: text("container_name").notNull(),
  imageName: text("image_name").notNull(),
  internalPort: integer("internal_port"),
  url: text("url"),
  error: text("error"),
  workspacePath: text("workspace_path").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const logs = sqliteTable(
  "logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    deploymentId: text("deployment_id")
      .notNull()
      .references(() => deployments.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    level: text("level").notNull(),
    message: text("message").notNull(),
    ts: integer("ts", { mode: "timestamp" }).notNull(),
  },
  (t) => [index("idx_logs_deployment_seq").on(t.deploymentId, t.seq)]
);

export type Deployment = typeof deployments.$inferSelect;
export type NewDeployment = typeof deployments.$inferInsert;
export type Log = typeof logs.$inferSelect;
