import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { getOrganizationId, parseJsonBody, withErrorHandling } from "../lib/http";
import { saveFormSettingsSchema } from "../models/formSettings";
import { saveFormSettings } from "../repositories/formSettingsRepository";

async function handleSaveFormSettings(request: HttpRequest): Promise<HttpResponseInit> {
  const organizationId = getOrganizationId(request);
  const input = await parseJsonBody(request, saveFormSettingsSchema);
  return { status: 200, jsonBody: await saveFormSettings(organizationId, input) };
}

app.http("SaveFormSettings", {
  methods: ["PUT"],
  route: "form-settings",
  authLevel: "function",
  handler: withErrorHandling(handleSaveFormSettings),
});
