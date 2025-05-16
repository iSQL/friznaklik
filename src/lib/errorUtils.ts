// src/lib/errorUtils.ts
// LINIJA "import 'server-only';" JE UKLONJENA ODOZGO

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
export function formatErrorMessage(error: unknown, contextMessage: string = "Operacija nije uspela"): string { // Prevedena podrazumevana poruka
  let userFriendlyMessage = `Greška: ${contextMessage.toLowerCase()}.`; // Prevod
  let detailedLogMessage = `Kontekst: ${contextMessage}. Greška: `; // Prevod

  if (typeof error === 'object' && error !== null) {
    const errAsObject = error as Partial<FormattedError & Error>;

    if (errAsObject.message) {
      detailedLogMessage += `Strukturirana Greška - Poruka: ${errAsObject.message}`;
      userFriendlyMessage += ` Detalji: ${errAsObject.message}.`;

      if (errAsObject.status) {
        detailedLogMessage += `, Status: ${errAsObject.status}`;
      }
      if (errAsObject.details) {
        detailedLogMessage += `, Detalji: ${JSON.stringify(errAsObject.details)}`;
      }
      if (errAsObject.originalError) {
        if (errAsObject.originalError instanceof Error) {
          detailedLogMessage += `, OriginalErrorName: ${errAsObject.originalError.name}, OriginalErrorMessage: ${errAsObject.originalError.message}, OriginalErrorStack: ${errAsObject.originalError.stack}`;
        } else {
          detailedLogMessage += `, OriginalError: ${JSON.stringify(errAsObject.originalError)}`;
        }
      } else if (error instanceof Error && !errAsObject.originalError) {
        detailedLogMessage += `, Naziv: ${error.name}, Stek: ${error.stack}`;
      }
    } else if (error instanceof Error) {
      detailedLogMessage += `Generička Greška - Naziv: ${error.name}, Poruka: ${error.message}, Stek: ${error.stack}`;
      userFriendlyMessage += ` Detalji: ${error.message}.`;
    } else {
      detailedLogMessage += `Nepoznat Tip Objektne Greške - Vrednost: ${JSON.stringify(error)}`;
      userFriendlyMessage += ' Došlo je do neočekivane greške sa objektom.'; // Prevod
    }
  } else if (typeof error === 'string') {
    detailedLogMessage += `String Greška - Poruka: ${error}`;
    userFriendlyMessage += ` Detalji: ${error}.`;
  } else {
    detailedLogMessage += `Nepoznat Tip Primitivne Greške - Vrednost: ${String(error)}`;
    userFriendlyMessage += ' Došlo je do neočekivane greške.'; // Prevod
  }

  console.error(detailedLogMessage); // Logovanje detaljne greške ostaje važno

  return userFriendlyMessage;
}
