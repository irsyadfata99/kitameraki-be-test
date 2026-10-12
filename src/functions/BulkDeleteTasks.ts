import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { getOrganizationId, parseJsonBody, withErrorHandling } from "../lib/http";
import { bulkDeleteSchema } from "../models/task";
import { bulkDeleteTasks } from "../repositories/taskRepository";

async function handleBulkDelete(request: HttpRequest): Promise<HttpResponseInit> {
  const organizationId = getOrganizationId(request);
  const { ids } = await parseJsonBody(request, bulkDeleteSchema);
  // Every delete is awaited; partial failures are reported instead of being swallowed.
  return { status: 200, jsonBody: await bulkDeleteTasks(ids, organizationId) };
}

app.http("BulkDeleteTasks", {
  methods: ["POST"],
  route: "tasks/bulk-delete",
  authLevel: "function",
  handler: withErrorHandling(handleBulkDelete),
});
