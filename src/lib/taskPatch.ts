import type { PatchOperation } from "@azure/cosmos";
import type { UpdateTaskInput } from "../models/task";

/** True when the update clears at least one value (`null`), which needs the stored document. */
export const clearsValues = (changes: UpdateTaskInput): boolean =>
  Object.values(changes).some((value) => value === null);

/**
 * Cosmos patch operations for an update.
 * - a value sets the property;
 * - `null` removes it. Cosmos rejects removing a property that does not exist, so a removal is
 *   only emitted when `existing` (the stored document) has it;
 * - `undefined` is ignored.
 */
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
