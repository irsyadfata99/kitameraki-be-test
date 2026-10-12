import { Container, SqlParameter } from "@azure/cosmos";
import { randomUUID } from "node:crypto";
import { getTasksContainer } from "../lib/cosmos";
import { stripSystemFields } from "../lib/cosmosDocument";
import { AppError, badRequest, conflict, cosmosErrorCode, notFound } from "../lib/errors";
import { buildPatchOperations, clearsValues } from "../lib/taskPatch";
import { pageOfSortedIds, SORT_KEY_PROJECTION, TaskSortKeys } from "../lib/taskSort";
import {
  CreateTaskInput,
  ListTasksQuery,
  PagedResult,
  Task,
  UpdateTaskInput,
} from "../models/task";

const toTask = (document: object): Task => stripSystemFields<Task>(document);

function buildFilter(
  organizationId: string,
  query: ListTasksQuery,
): {
  where: string;
  parameters: SqlParameter[];
} {
  const conditions = ["c.organizationId = @organizationId"];
  const parameters: SqlParameter[] = [
    { name: "@organizationId", value: organizationId },
  ];

  if (query.status) {
    conditions.push("c.status = @status");
    parameters.push({ name: "@status", value: query.status });
  }
  if (query.priority) {
    conditions.push("c.priority = @priority");
    parameters.push({ name: "@priority", value: query.priority });
  }
  if (query.tag) {
    conditions.push("ARRAY_CONTAINS(c.tags, @tag)");
    parameters.push({ name: "@tag", value: query.tag });
  }
  if (query.search) {
    conditions.push(
      "(CONTAINS(LOWER(c.title), @search) OR CONTAINS(LOWER(c.description), @search))",
    );
    parameters.push({ name: "@search", value: query.search.toLowerCase() });
  }

  return { where: conditions.join(" AND "), parameters };
}

/**
 * Above this many matching tasks, sorting by anything other than createdAt is refused
 * (see pageInMemory). A single organization's task list is far below this in practice.
 */
const MAX_IN_MEMORY_SORT = 2000;

interface QueryScope {
  container: Container;
  /** The partition key: one organization. */
  organizationId: string;
  where: string;
  parameters: SqlParameter[];
}

async function countTasks({ container, organizationId, where, parameters }: QueryScope): Promise<number> {
  const { resources } = await container.items
    .query<number>(
      { query: `SELECT VALUE COUNT(1) FROM c WHERE ${where}`, parameters },
      { partitionKey: organizationId },
    )
    .fetchAll();
  return resources[0] ?? 0;
}

/** Default sort: `_ts` exists on every document, so Cosmos can sort and page it directly. */
async function pageByCreation(scope: QueryScope, query: ListTasksQuery): Promise<Task[]> {
  const { resources } = await scope.container.items
    .query<object>(
      {
        query:
          `SELECT * FROM c WHERE ${scope.where} ` +
          `ORDER BY c._ts ${query.sortOrder.toUpperCase()} OFFSET @offset LIMIT @limit`,
        parameters: [
          ...scope.parameters,
          { name: "@offset", value: (query.page - 1) * query.pageSize },
          { name: "@limit", value: query.pageSize },
        ],
      },
      { partitionKey: scope.organizationId },
    )
    .fetchAll();
  return resources.map(toTask);
}

/**
 * Every other sort field. Cosmos cannot be used for these: ORDER BY silently drops documents
 * where the property is missing (a task without a due date would vanish), and it only sorts
 * strings alphabetically (priority "high" < "low" < "medium").
 *
 * So: load only the small sort keys, sort in memory, then load the full documents of the
 * requested page. The task count is checked first so memory use stays bounded.
 */
async function pageInMemory(scope: QueryScope, query: ListTasksQuery, total: number): Promise<Task[]> {
  if (total === 0) return [];
  if (total > MAX_IN_MEMORY_SORT) {
    throw badRequest(
      `Too many tasks (${total}) to sort by ${query.sortBy}. Narrow the results with a filter or search, or sort by createdAt.`,
    );
  }

  const options = { partitionKey: scope.organizationId };
  const { resources: keys } = await scope.container.items
    .query<TaskSortKeys>(
      { query: `SELECT ${SORT_KEY_PROJECTION} FROM c WHERE ${scope.where}`, parameters: scope.parameters },
      options,
    )
    .fetchAll();

  const ids = pageOfSortedIds(keys, query.sortBy, query.sortOrder, query.page, query.pageSize);
  if (ids.length === 0) return [];

  const { resources: documents } = await scope.container.items
    .query<{ id: string }>(
      { query: "SELECT * FROM c WHERE ARRAY_CONTAINS(@ids, c.id)", parameters: [{ name: "@ids", value: ids }] },
      options,
    )
    .fetchAll();

  // The page query returns documents in any order: restore the sorted order.
  const byId = new Map(documents.map((document) => [document.id, document]));
  return ids.flatMap((id) => {
    const document = byId.get(id);
    return document ? [toTask(document)] : []; // deleted in between: just skip it
  });
}

export async function listTasks(
  organizationId: string,
  query: ListTasksQuery,
): Promise<PagedResult<Task>> {
  const { where, parameters } = buildFilter(organizationId, query);
  const scope: QueryScope = { container: getTasksContainer(), organizationId, where, parameters };

  let total: number;
  let items: Task[];
  if (query.sortBy === "createdAt") {
    [total, items] = await Promise.all([countTasks(scope), pageByCreation(scope, query)]);
  } else {
    total = await countTasks(scope);
    items = await pageInMemory(scope, query, total);
  }

  return {
    items,
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.ceil(total / query.pageSize),
  };
}

export async function getTask(
  id: string,
  organizationId: string,
): Promise<Task> {
  const { resource } = await getTasksContainer()
    .item(id, organizationId)
    .read<object>();
  if (!resource) throw notFound();
  return toTask(resource);
}

export async function createTask(
  organizationId: string,
  input: CreateTaskInput,
): Promise<Task> {
  try {
    const { resource } = await getTasksContainer().items.create({
      ...input,
      id: input.id ?? randomUUID(),
      organizationId,
    });
    if (!resource) throw new Error("Cosmos did not return the created task");
    return toTask(resource);
  } catch (error) {
    if (cosmosErrorCode(error) === 409) throw conflict("Task already exists");
    throw error;
  }
}

export async function updateTask(
  id: string,
  organizationId: string,
  changes: UpdateTaskInput,
): Promise<Task> {
  const item = getTasksContainer().item(id, organizationId);

  // Clearing a value removes the property, which Cosmos only allows if it exists:
  // read the stored task first (only needed in that case).
  let existing: object | undefined;
  if (clearsValues(changes)) {
    const { resource } = await item.read<object>();
    if (!resource) throw notFound();
    existing = resource;
  }

  const operations = buildPatchOperations(changes, existing);
  // Only possible when every change cleared a value that was already empty.
  if (operations.length === 0) return existing ? toTask(existing) : getTask(id, organizationId);

  try {
    const { resource } = await item.patch<object>(operations);
    if (!resource) throw notFound();
    return toTask(resource);
  } catch (error) {
    if (cosmosErrorCode(error) === 404) throw notFound();
    throw error;
  }
}

export async function deleteTask(
  id: string,
  organizationId: string,
): Promise<void> {
  try {
    await getTasksContainer().item(id, organizationId).delete();
  } catch (error) {
    if (cosmosErrorCode(error) === 404) throw notFound();
    throw error;
  }
}

export interface BulkDeleteResult {
  deleted: string[];
  failed: { id: string; reason: "not_found" | "error" }[];
}

export async function bulkDeleteTasks(
  ids: string[],
  organizationId: string,
): Promise<BulkDeleteResult> {
  const uniqueIds = [...new Set(ids)];
  const outcomes = await Promise.allSettled(
    uniqueIds.map((id) => deleteTask(id, organizationId)),
  );

  const result: BulkDeleteResult = { deleted: [], failed: [] };
  outcomes.forEach((outcome, index) => {
    const id = uniqueIds[index];
    if (outcome.status === "fulfilled") {
      result.deleted.push(id);
      return;
    }
    const missing = outcome.reason instanceof AppError && outcome.reason.status === 404;
    result.failed.push({ id, reason: missing ? "not_found" : "error" });
  });
  return result;
}
