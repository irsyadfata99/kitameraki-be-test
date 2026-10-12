import {
  HttpHandler,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { z } from "zod";
import { AppError, badRequest } from "./errors";

/**
 * The organization id is the tenant key. It travels in a header (not in the URL),
 * so it does not end up in access logs, browser history or proxy logs.
 */
export const ORGANIZATION_HEADER = "x-organization-id";

/** Upper bound for a request body; the largest valid payload is far below this. */
const MAX_BODY_BYTES = 256 * 1024;

const RESPONSE_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

export function getOrganizationId(request: HttpRequest): string {
  const result = z.string().uuid().safeParse(request.headers.get(ORGANIZATION_HEADER));
  if (!result.success) {
    throw badRequest(`Header "${ORGANIZATION_HEADER}" is required and must be a valid UUID`);
  }
  // Partition keys are case-sensitive: normalize so one UUID is always one tenant.
  return result.data.toLowerCase();
}

export function validateInput<S extends z.ZodTypeAny>(
  schema: S,
  data: unknown,
): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw badRequest(
      "Validation failed",
      result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    );
  }
  return result.data;
}

export async function parseJsonBody<S extends z.ZodTypeAny>(
  request: HttpRequest,
  schema: S,
): Promise<z.infer<S>> {
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) {
    throw new AppError(413, "Request body is too large");
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw badRequest("Request body must be valid JSON");
  }
  return validateInput(schema, raw);
}

export function parseQuery<S extends z.ZodTypeAny>(
  request: HttpRequest,
  schema: S,
): z.infer<S> {
  return validateInput(schema, Object.fromEntries(request.query.entries()));
}

function withResponseHeaders(response: HttpResponseInit): HttpResponseInit {
  // Handlers in this project never set headers themselves, so a plain object is enough.
  const existing = (response.headers ?? {}) as Record<string, string>;
  return { ...response, headers: { ...existing, ...RESPONSE_HEADERS } };
}

export function withErrorHandling(handler: HttpHandler): HttpHandler {
  return async (request, context) => {
    try {
      return withResponseHeaders(await handler(request, context));
    } catch (error) {
      return withResponseHeaders(toErrorResponse(error, context));
    }
  };
}

function toErrorResponse(
  error: unknown,
  context: InvocationContext,
): HttpResponseInit {
  if (error instanceof AppError) {
    return {
      status: error.status,
      jsonBody: { error: error.message, details: error.details },
    };
  }

  context.error("Unhandled error", error);
  return { status: 500, jsonBody: { error: "Internal server error" } };
}
