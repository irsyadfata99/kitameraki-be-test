import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { getOrganizationId, parseQuery, withErrorHandling } from "../lib/http";
import { listTasksQuerySchema } from "../models/task";
import { listTasks } from "../repositories/taskRepository";

async function getTasks(request: HttpRequest): Promise<HttpResponseInit> {
  const organizationId = getOrganizationId(request);
  const query = parseQuery(request, listTasksQuerySchema);
  return { status: 200, jsonBody: await listTasks(organizationId, query) };
}

app.http("GetTasks", {
  methods: ["GET"],
  route: "tasks",
  authLevel: "function",
  handler: withErrorHandling(getTasks),
});
