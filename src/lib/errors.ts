export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const badRequest = (message: string, details?: unknown): AppError =>
  new AppError(400, message, details);

export const notFound = (message = "Task not found"): AppError =>
  new AppError(404, message);

export const conflict = (message: string): AppError =>
  new AppError(409, message);

/** The `code` of an error thrown by the Cosmos SDK (an HTTP status), if there is one. */
export const cosmosErrorCode = (error: unknown): unknown =>
  (error as { code?: unknown } | null)?.code;
