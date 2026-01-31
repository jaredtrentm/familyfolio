import * as Sentry from "@sentry/nextjs";

export function captureError(
  error: Error | unknown,
  context?: Record<string, unknown>
) {
  console.error("Error captured:", error);

  if (error instanceof Error) {
    Sentry.captureException(error, {
      extra: context,
    });
  } else {
    Sentry.captureException(new Error(String(error)), {
      extra: { ...context, originalError: error },
    });
  }
}

export function setUser(user: { id: string; email?: string; name?: string }) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.name,
  });
}

export function clearUser() {
  Sentry.setUser(null);
}

export function addBreadcrumb(
  message: string,
  category?: string,
  level?: Sentry.SeverityLevel
) {
  Sentry.addBreadcrumb({
    message,
    category: category || "app",
    level: level || "info",
  });
}
