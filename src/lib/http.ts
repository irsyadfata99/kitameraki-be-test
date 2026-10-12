import {
  HttpHandler,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { z } from "zod";
import { AppError, badRequest } from "./errors";

export const ORGANIZATION_HEADER = "x-organization-id";

const MAX_BODY_BYTES = 256 * 1024;

const RESPONSE_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

export function getOrganizationId(request: HttpRequest): string {
  const result = z
    .string()
    .uuid()
    .safeParse(request.headers.get(ORGANIZATION_HEADER));
  if (!result.success) {
    throw badRequest(
      `Header "${ORGANIZATION_HEADER}" is required and must be a valid UUID`,
    );
  }
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
