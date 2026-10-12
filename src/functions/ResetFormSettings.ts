import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { getOrganizationId, withErrorHandling } from "../lib/http";
import { resetFormSettings } from "../repositories/formSettingsRepository";

async function handleResetFormSettings(request: HttpRequest): Promise<HttpResponseInit> {
  const organizationId = getOrganizationId(request);
  await resetFormSettings(organizationId);
  return { status: 204 };
}

app.http("ResetFormSettings", {
  methods: ["DELETE"],
  route: "form-settings",
  authLevel: "function",
  handler: withErrorHandling(handleResetFormSettings),
});
