import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { getOrganizationId, parseJsonBody, withErrorHandling } from "../lib/http";
import { createTaskSchema } from "../models/task";
import { createTask } from "../repositories/taskRepository";
import { assertValidCustomFields } from "../services/customFields";

async function insertTask(request: HttpRequest): Promise<HttpResponseInit> {
  const organizationId = getOrganizationId(request);
  const input = await parseJsonBody(request, createTaskSchema);
  await assertValidCustomFields(organizationId, input.customFields);
  return { status: 201, jsonBody: await createTask(organizationId, input) };
}

app.http("InsertTask", {
  methods: ["POST"],
  route: "tasks",
  authLevel: "function",
  handler: withErrorHandling(insertTask),
});
