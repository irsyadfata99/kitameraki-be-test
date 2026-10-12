import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import {
  getOrganizationId,
  parseJsonBody,
  validateInput,
  withErrorHandling,
} from "../lib/http";
import { taskKeySchema, updateTaskSchema } from "../models/task";
import { updateTask } from "../repositories/taskRepository";
import { assertValidCustomFields } from "../services/customFields";

async function handleUpdateTask(
  request: HttpRequest,
): Promise<HttpResponseInit> {
  const organizationId = getOrganizationId(request);
  const { id } = validateInput(taskKeySchema, { id: request.params.id });
  const changes = await parseJsonBody(request, updateTaskSchema);
  await assertValidCustomFields(organizationId, changes.customFields);
  return {
    status: 200,
    jsonBody: await updateTask(id, organizationId, changes),
  };
}

app.http("UpdateTask", {
  methods: ["PATCH"],
  route: "tasks/{id}",
  authLevel: "function",
  handler: withErrorHandling(handleUpdateTask),
});
