import { projects } from "@/db/schema";

export type ProjectRecord = typeof projects.$inferSelect;
export type NewProjectRecord = typeof projects.$inferInsert;
export type ProjectStatus = typeof projects.status.enumValues[number];
export type ProjectPriority = typeof projects.priority.enumValues[number];

export type ProjectFilters = {
  search?: string;
  status?: ProjectStatus;
  pic?: string;
  category?: string;
  periodStart?: Date;
  periodEnd?: Date;
  archived?: boolean;
};

export type ProjectChanges = Partial<Omit<NewProjectRecord, "id" | "createdAt" | "updatedAt" | "version">>;
