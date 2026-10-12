import { getFormSettingsContainer } from "../lib/cosmos";
import { stripSystemFields } from "../lib/cosmosDocument";
import { cosmosErrorCode } from "../lib/errors";
import {
  createDefaultFormSettings,
  FormSettings,
  SaveFormSettingsInput,
} from "../models/formSettings";

const SETTINGS_DOCUMENT_ID = "form-settings";

function toFormSettings(document: object): FormSettings {
  const { id: _id, ...settings } = stripSystemFields<
    FormSettings & { id: string }
  >(document);
  return settings;
}

export async function getFormSettings(
  organizationId: string,
): Promise<FormSettings> {
  const { resource } = await getFormSettingsContainer()
    .item(SETTINGS_DOCUMENT_ID, organizationId)
    .read<object>();
  return resource
    ? toFormSettings(resource)
    : createDefaultFormSettings(organizationId);
}

export async function saveFormSettings(
  organizationId: string,
  input: SaveFormSettingsInput,
): Promise<FormSettings> {
  const { resource } = await getFormSettingsContainer().items.upsert({
    ...input,
    organizationId,
    id: SETTINGS_DOCUMENT_ID,
    updatedAt: new Date().toISOString(),
  });
  if (!resource)
    throw new Error("Cosmos did not return the saved form settings");
  return toFormSettings(resource);
}

export async function resetFormSettings(organizationId: string): Promise<void> {
  try {
    await getFormSettingsContainer()
      .item(SETTINGS_DOCUMENT_ID, organizationId)
      .delete();
  } catch (error) {
    if (cosmosErrorCode(error) !== 404) throw error;
  }
}
