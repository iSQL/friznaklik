// src/lib/errorUtils.ts

/**
 * Interface for a structured error object.
 * This can be used to create more detailed error objects before passing to formatErrorMessage.
 */
export interface FormattedError {
  message: string;        // Primary error message, often user-friendly or a base message
  status?: number;         // HTTP status code, if applicable
  details?: string | object; // Further technical details or parsed error object from a response
  originalError?: unknown; // The original error object/exception caught, for comprehensive logging
  context?: string;        // The specific operation or context where the error occurred
}

/**
 * Formats an unknown error into a user-friendly string and logs detailed information.
 * @param error The error object caught (type unknown). This can be an instance of Error, FormattedError, a string, or any other type.
 * @param contextMessage A message describing the context where the error occurred (e.g., "fetching pending appointments").
 * @returns A user-friendly error message string.
 */
export function formatErrorMessage(error: unknown, contextMessage: string = "An operation failed"): string {
  let userFriendlyMessage = `Error ${contextMessage.toLowerCase()}.`;
  let detailedLogMessage = `Context: ${contextMessage}. Error: `;

  if (typeof error === 'object' && error !== null) {
    // Attempt to cast to FormattedError or a similar structure with a message property
    const errAsObject = error as Partial<FormattedError & Error>; // Cast to allow checking for common error properties

    if (errAsObject.message) { // Prioritize a 'message' property if it exists
      detailedLogMessage += `Structured Error - Message: ${errAsObject.message}`;
      userFriendlyMessage += ` Details: ${errAsObject.message}.`;

      if (errAsObject.status) {
        detailedLogMessage += `, Status: ${errAsObject.status}`;
      }
      if (errAsObject.details) {
        detailedLogMessage += `, Details: ${JSON.stringify(errAsObject.details)}`;
      }
      // Log originalError if it's distinct and provides more info (e.g., stack trace from an Error instance)
      if (errAsObject.originalError) {
        if (errAsObject.originalError instanceof Error) {
          detailedLogMessage += `, OriginalErrorName: ${errAsObject.originalError.name}, OriginalErrorMessage: ${errAsObject.originalError.message}, OriginalErrorStack: ${errAsObject.originalError.stack}`;
        } else {
          detailedLogMessage += `, OriginalError: ${JSON.stringify(errAsObject.originalError)}`;
        }
      } else if (error instanceof Error && !errAsObject.originalError) {
        // If the top-level error is an Error instance and originalError wasn't specifically set
        detailedLogMessage += `, Name: ${error.name}, Stack: ${error.stack}`;
      }
    } else if (error instanceof Error) { // Fallback for generic Error instances not matching FormattedError structure
      detailedLogMessage += `Generic Error - Name: ${error.name}, Message: ${error.message}, Stack: ${error.stack}`;
      userFriendlyMessage += ` Details: ${error.message}.`;
    } else {
      // Handle other unknown object types
      detailedLogMessage += `Unknown Object Error Type - Value: ${JSON.stringify(error)}`;
      userFriendlyMessage += ' An unexpected error occurred with an object.';
    }
  } else if (typeof error === 'string') {
    // Handle cases where the error is just a string
    detailedLogMessage += `String Error - Message: ${error}`;
    userFriendlyMessage += ` Details: ${error}.`;
  } else {
    // Handle other primitive types or null/undefined
    detailedLogMessage += `Unknown Primitive Error Type - Value: ${String(error)}`;
    userFriendlyMessage += ' An unexpected error occurred.';
  }

  // Log the detailed error for debugging (server-side or client-side console)
  console.error(detailedLogMessage);

  return userFriendlyMessage;
}
