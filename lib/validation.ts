import { z } from "zod";

const status = z.enum(["On Going", "Delay", "Pending", "Revisi", "Done"]);
const priority = z.enum(["High", "Medium", "Low"]);
export const projectMemberRole = z.enum(["Lead", "Anggota", "Viewer"]);
const dateValue = z.union([z.string(), z.date()]).transform((value) => new Date(value));
const optionalUrl = z.union([z.url(), z.literal(""), z.null()]).optional();
const projectAssignments = z.array(z.object({
  userId: z.string().trim().min(1).max(255),
  role: projectMemberRole,
})).max(100).optional();

export const createProjectSchema = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(4000).default(""),
  pic: z.string().trim().min(2).max(100),
  picInitials: z.string().trim().min(1).max(4).optional(),
  primaryPicUserId: z.string().trim().min(1).max(255).nullable().optional(),
  memberAssignments: projectAssignments,
  deadline: dateValue,
  status: status.default("Pending"),
  priority: priority.default("Medium"),
  category: z.string().trim().min(2).max(100),
  workingDocLink: optionalUrl,
});

export const updateProjectSchema = createProjectSchema.partial().refine((data) => Object.keys(data).length > 0, "No fields supplied");

export const projectCommentSchema = z.object({
  body: z.string().trim().min(1).max(4000),
  mentionUserIds: z.array(z.string().trim().min(1).max(255)).max(50).default([]),
});

export const projectCompletionRequestSchema = z.object({
  note: z.string().trim().max(1000).default(""),
});

export const projectCompletionReviewSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  note: z.string().trim().max(1000).default(""),
});

export const createAgendaSchema = z.object({
  title: z.string().trim().min(2).max(160),
  pic: z.string().trim().min(2).max(100),
  category: z.string().trim().min(2).max(100),
  startTime: dateValue,
  endTime: dateValue,
  note: z.string().trim().max(4000).default(""),
  projectId: z.number().int().positive().nullable().optional(),
}).refine((data) => data.endTime >= data.startTime, { message: "End time must be after start time", path: ["endTime"] });

export const updateAgendaSchema = z.object({
  title: z.string().trim().min(2).max(160).optional(),
  pic: z.string().trim().min(2).max(100).optional(),
  category: z.string().trim().min(2).max(100).optional(),
  startTime: dateValue.optional(),
  endTime: dateValue.optional(),
  note: z.string().trim().max(4000).optional(),
  projectId: z.number().int().positive().nullable().optional(),
}).refine((data) => Object.keys(data).length > 0, "No fields supplied");

export const createAssetSchema = z.object({
  projectName: z.string().trim().min(2).max(160),
  category: z.string().trim().min(2).max(100),
  pic: z.string().trim().min(2).max(100),
  picInitials: z.string().trim().min(1).max(4).optional(),
  completedDate: dateValue,
  description: z.string().trim().max(4000).default(""),
  assetLink: optionalUrl,
  docLink: optionalUrl,
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  projectId: z.number().int().positive().nullable().optional(),
});

export const updateAssetSchema = createAssetSchema.partial().refine((data) => Object.keys(data).length > 0, "No fields supplied");
