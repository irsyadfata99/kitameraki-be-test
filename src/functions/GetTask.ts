import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { getOrganizationId, validateInput, withErrorHandling } from "../lib/http";
import { taskKeySchema } from "../models/task";
import { getTask } from "../repositories/taskRepository";

async function handleGetTask(request: HttpRequest): Promise<HttpResponseInit> {
  const organizationId = getOrganizationId(request);
  const { id } = validateInput(taskKeySchema, { id: request.params.id });
  return { status: 200, jsonBody: await getTask(id, organizationId) };
}

app.http("GetTask", {
  methods: ["GET"],
  route: "tasks/{id}",
  authLevel: "function",
  handler: withErrorHandling(handleGetTask),
});
