import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { getOrganizationId, withErrorHandling } from "../lib/http";
import { getFormSettings } from "../repositories/formSettingsRepository";

async function handleGetFormSettings(request: HttpRequest): Promise<HttpResponseInit> {
  const organizationId = getOrganizationId(request);
  return { status: 200, jsonBody: await getFormSettings(organizationId) };
}

app.http("GetFormSettings", {
  methods: ["GET"],
  route: "form-settings",
  authLevel: "function",
  handler: withErrorHandling(handleGetFormSettings),
});
