// An expected, user-facing error. Services throw it; errorHandler turns it into
// { error: { code, message, details? } } with the right HTTP status.
export class AppError extends Error {
  constructor(
    public readonly httpStatus: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const notFound = (what: string) =>
  new AppError(404, "NOT_FOUND", `${what} was not found. Check the id and try again.`);
