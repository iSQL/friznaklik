// src/config/appConfig.ts

// Function to safely get an environment variable
function getEnvVariable(key: string): string {
    const value = process.env[key];
    if (!value) {
      // Throw an error during server startup if a required variable is missing
      throw new Error(`Environment variable ${key} is not set.`);
    }
    return value;
  }
  
  // Define the structure of your server-side config
  interface AppConfig {
    googleApiKey: string;
    //clerkSecretKey: string;
    //databaseUrl: string;
    siteURL: string;

    // Add other server-side variables here...
  }
  
  // Load the configuration, performing checks
  export const appConfig: AppConfig = {
    googleApiKey: "AIzaSyBKRR-xFleFK5QLbiizGVc5EMuBiKGBxwc",
    //clerkSecretKey: getEnvVariable('CLERK_SECRET_KEY'),
    //databaseUrl: getEnvVariable('DATABASE_URL'),
    siteURL: "http://localhost:3000",

    // Load other variables...
  };
  
  // You could also export individual values if preferred
  // export const GOOGLE_API_KEY = getEnvVariable('GOOGLE_API_KEY');