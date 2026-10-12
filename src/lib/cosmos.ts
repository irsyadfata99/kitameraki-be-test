import { Container, CosmosClient } from "@azure/cosmos";
import { getConfig } from "./config";

let client: CosmosClient | undefined;

function getContainer(
  containerId: (c: ReturnType<typeof getConfig>["cosmos"]) => string,
): Container {
  const { cosmos } = getConfig();
  client ??= new CosmosClient(cosmos.connectionString);
  return client.database(cosmos.databaseId).container(containerId(cosmos));
}

export const getTasksContainer = (): Container =>
  getContainer((cosmos) => cosmos.tasksContainerId);

export const getFormSettingsContainer = (): Container =>
  getContainer((cosmos) => cosmos.formSettingsContainerId);
