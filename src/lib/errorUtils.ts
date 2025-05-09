// src/lib/errorUtils.ts

/**
 * Formats an unknown error into a user-friendly string and logs details.
 * @param error The error object caught (type unknown).
 * @param contextMessage A message describing the context where the error occurred (e.g., "fetching pending appointments").
 * @returns A user-friendly error message string.
 */
export function formatErrorMessage(error: unknown, contextMessage: string = "An operation failed"): string {
  let userFriendlyMessage = `Error ${contextMessage.toLowerCase()}.`;
  let detailedLogMessage = `Context: ${contextMessage}. Error: `;

  if (error instanceof Error) {
    // Handle generic JavaScript Error objects
    detailedLogMessage += `Generic Error - Name: ${error.name}, Message: ${error.message}, Stack: ${error.stack}`;
    userFriendlyMessage += ` Details: ${error.message}.`;
  } else if (typeof error === 'string') {
    // Handle cases where the error is just a string
    detailedLogMessage += `String Error - Message: ${error}`;
    userFriendlyMessage += ` Details: ${error}.`;
  } else {
    // Handle other unknown error types
    detailedLogMessage += `Unknown Error Type - Value: ${JSON.stringify(error)}`;
    userFriendlyMessage += ' An unexpected error occurred.';
  }

  // Log the detailed error for debugging (server-side)
  console.error(detailedLogMessage);

  return userFriendlyMessage;
}
