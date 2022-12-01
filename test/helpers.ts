export function getErrorMessageAndStack(error: unknown): {
  message: string;
  stack?: string;
} {
  if (error instanceof Error) return error;
  return { message: String(error), stack: new Error().stack };
}
