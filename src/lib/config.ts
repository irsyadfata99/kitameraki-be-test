import { z } from "zod";

const envSchema = z.object({
  COSMOS_CONNECTION_STRING: z.string().min(1, "is required"),
  COSMOS_DATABASE: z.string().min(1).default("TaskApp"),
  COSMOS_TASKS_CONTAINER: z.string().min(1).default("Tasks"),
  COSMOS_FORM_SETTINGS_CONTAINER: z.string().min(1).default("FormSettings"),
});

export interface AppConfig {
  cosmos: {
    connectionString: string;
    databaseId: string;
    tasksContainerId: string;
    formSettingsContainerId: string;
  };
}

let cached: AppConfig | undefined;

export function getConfig(): AppConfig {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")} ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  cached = {
    cosmos: {
      connectionString: parsed.data.COSMOS_CONNECTION_STRING,
      databaseId: parsed.data.COSMOS_DATABASE,
      tasksContainerId: parsed.data.COSMOS_TASKS_CONTAINER,
      formSettingsContainerId: parsed.data.COSMOS_FORM_SETTINGS_CONTAINER,
    },
  };
  return cached;
}
