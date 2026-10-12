import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { getOrganizationId, validateInput, withErrorHandling } from "../lib/http";
import { taskKeySchema } from "../models/task";
import { deleteTask } from "../repositories/taskRepository";

async function handleDeleteTask(request: HttpRequest): Promise<HttpResponseInit> {
  const organizationId = getOrganizationId(request);
  const { id } = validateInput(taskKeySchema, { id: request.params.id });
  await deleteTask(id, organizationId);
  return { status: 204 };
}

app.http("DeleteTask", {
  methods: ["DELETE"],
  route: "tasks/{id}",
  authLevel: "function",
  handler: withErrorHandling(handleDeleteTask),
});
