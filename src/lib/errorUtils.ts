// src/lib/errorUtils.ts

import { Prisma } from '@prisma/client'; // Import Prisma types for specific error handling

/**
 * Interface for Prisma known request errors which include a 'code'.
 * This helps in identifying specific database-related issues.
 */
interface PrismaErrorWithCode extends Error {
  code?: string;
  meta?: Record<string, unknown>; // Prisma errors can also have a 'meta' field
}

/**
 * Formats an unknown error into a user-friendly string and logs details.
 * @param error The error object caught (type unknown).
 * @param contextMessage A message describing the context where the error occurred (e.g., "fetching pending appointments").
 * @returns A user-friendly error message string.
 */
export function formatErrorMessage(error: unknown, contextMessage: string = "An operation failed"): string {
  let userFriendlyMessage = `Error ${contextMessage.toLowerCase()}.`;
  let detailedLogMessage = `Context: ${contextMessage}. Error: `;

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Handle known Prisma request errors (e.g., unique constraint violation, record not found)
    detailedLogMessage += `Prisma Known Request Error - Code: ${error.code}, Message: ${error.message}, Meta: ${JSON.stringify(error.meta)}`;
    userFriendlyMessage += ` A database error occurred (Code: ${error.code}).`;
    // You could customize messages based on specific Prisma error codes
    // if (error.code === 'P2025') {
    //   userFriendlyMessage = `Error ${contextMessage.toLowerCase()}: The required record was not found.`;
    // }
  } else if (error instanceof Prisma.PrismaClientValidationError) {
    // Handle Prisma validation errors (e.g., invalid data format for a field)
    detailedLogMessage += `Prisma Validation Error - Message: ${error.message}`;
    userFriendlyMessage += ` There was a data validation issue. Please check your input.`;
  } else if (error instanceof Error) {
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

/**
 * Type guard to check if an error is a PrismaErrorWithCode.
 * This is an alternative way to check for the 'code' property if not using Prisma.PrismaClientKnownRequestError directly.
 * @param error The error object.
 * @returns True if the error has a 'code' property, false otherwise.
 */
export function isPrismaErrorWithCode(error: any): error is PrismaErrorWithCode {
  return error instanceof Error && typeof (error as PrismaErrorWithCode).code === 'string';
}
