import { z } from "zod";

export const TASK_STATUSES = ["todo", "in-progress", "completed"] as const;
export const TASK_PRIORITIES = ["low", "medium", "high"] as const;
export const SORT_FIELDS = [
  "title",
  "dueDate",
  "priority",
  "status",
  "createdAt",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export type SortField = (typeof SORT_FIELDS)[number];

export interface Task {
  id: string;
  organizationId: string;
  title: string;
  description?: string;
  dueDate?: string;
  priority?: TaskPriority;
  status: TaskStatus;
  tags?: string[];
  customFields?: Record<string, string>;
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const uuid = z.string().uuid();

const dueDate = z.string().datetime({ offset: true });
const priority = z.enum(TASK_PRIORITIES);

const taskFields = z.object({
  title: z.string().trim().min(1).max(100),
  description: z.string().max(1000).optional(),
  dueDate: dueDate.optional(),
  priority: priority.optional(),
  status: z.enum(TASK_STATUSES),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  customFields: z
    .record(uuid, z.string().max(1000))
    .refine((value) => Object.keys(value).length <= 100, {
      message: "Too many custom fields",
    })
    .optional(),
});

export const createTaskSchema = taskFields
  .extend({
    id: uuid.optional(),
    status: z.enum(TASK_STATUSES).default("todo"),
  })
  .strict();

export const updateTaskSchema = taskFields
  .extend({
    dueDate: dueDate.nullable().optional(),
    priority: priority.nullable().optional(),
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export const taskKeySchema = z.object({ id: uuid });

export const bulkDeleteSchema = z
  .object({
    ids: z.array(uuid).min(1).max(100),
  })
  .strict();

const optionalParam = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(
    (value) => (value === "" ? undefined : value),
    schema.optional(),
  );

export const listTasksQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  status: optionalParam(z.enum(TASK_STATUSES)),
  priority: optionalParam(z.enum(TASK_PRIORITIES)),
  tag: optionalParam(z.string().trim().min(1).max(50)),
  search: optionalParam(z.string().trim().min(1).max(100)),
  sortBy: z.enum(SORT_FIELDS).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
