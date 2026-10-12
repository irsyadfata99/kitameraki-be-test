import type { PatchOperation } from "@azure/cosmos";
import type { UpdateTaskInput } from "../models/task";

export const clearsValues = (changes: UpdateTaskInput): boolean =>
  Object.values(changes).some((value) => value === null);

export function buildPatchOperations(
  changes: UpdateTaskInput,
  existing?: object,
): PatchOperation[] {
  const operations: PatchOperation[] = [];
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined) continue;
    if (value === null) {
      if (existing && key in existing) {
        operations.push({ op: "remove", path: `/${key}` });
      }
      continue;
    }
    operations.push({ op: "set", path: `/${key}`, value });
  }
  return operations;
}
