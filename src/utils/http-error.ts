import axios from "axios";

/**
 * Builds a compact, log-safe summary of an HTTP client error.
 * Avoids serializing request bodies (e.g. base64 images) that axios attaches to `error.config`.
 */
export function formatHttpError(error: unknown): Record<string, unknown> {
  if (!axios.isAxiosError(error)) {
    if (error instanceof Error) {
      return { message: error.message, name: error.name };
    }
    return { message: String(error) };
  }

  const responseData = error.response?.data;
  let responseBody: unknown;

  if (typeof responseData === "string") {
    responseBody = responseData.length > 500 ? `${responseData.slice(0, 500)}…` : responseData;
  } else if (
    typeof responseData === "object" &&
    responseData !== null &&
    "error" in responseData
  ) {
    responseBody = (responseData as { error: unknown }).error;
  } else if (responseData !== undefined) {
    responseBody = responseData;
  }

  return {
    message: error.message,
    code: error.code,
    url: error.config?.url,
    method: error.config?.method?.toUpperCase(),
    status: error.response?.status,
    statusText: error.response?.statusText,
    responseBody,
  };
}
