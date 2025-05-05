import { neon } from "@neondatabase/serverless"

// Create a SQL client with the pooled connection
export const sql = neon(process.env.DATABASE_URL!)

// Helper function to execute a query with error handling
export async function executeQuery(query: string, params: any[] = []) {
  try {
    console.log(`DB: Executing query: ${query.substring(0, 100)}${query.length > 100 ? "..." : ""}`)
    console.log(`DB: With params: ${JSON.stringify(params)}`)

    // Use the sql.query method for parameterized queries
    const result = await sql.query(query, params)
    console.log(`DB: Query successful, returned ${result.rows.length} rows`)
    return result.rows
  } catch (error) {
    console.error("Database query error:", error)

    // Pokud je chyba typu "Too Many Requests", přeformátujeme ji na srozumitelnější zprávu
    if (error instanceof Error) {
      const errorMessage = error.message || ""
      if (errorMessage.includes("Too Many Requests") || errorMessage.includes("429")) {
        console.log("DB: Rate limit detected in database query")
        throw new Error("Rate limit exceeded: Too many requests to the database. Please try again later.")
      }

      // Check for connection errors
      if (errorMessage.includes("connect") || errorMessage.includes("connection")) {
        console.log("DB: Connection error detected")
        throw new Error(`Database connection error: ${errorMessage}`)
      }
    }

    throw error
  }
}

// Helper function for using tagged template literals
export function sqlTemplate(strings: TemplateStringsArray, ...values: any[]) {
  try {
    console.log(`DB: Executing SQL template`)
    return sql(strings, ...values)
  } catch (error) {
    console.error("Database query error:", error)

    // Pokud je chyba typu "Too Many Requests", přeformátujeme ji na srozumitelnější zprávu
    if (error instanceof Error) {
      const errorMessage = error.message || ""
      if (errorMessage.includes("Too Many Requests") || errorMessage.includes("429")) {
        console.log("DB: Rate limit detected in SQL template")
        throw new Error("Rate limit exceeded: Too many requests to the database. Please try again later.")
      }
    }

    throw error
  }
}

// Function to test database connection
export async function testDatabaseConnection() {
  try {
    console.log("DB: Testing database connection...")
    const result = await sql`SELECT 1 as test`
    console.log("DB: Connection successful:", result)
    return { success: true, message: "Database connection successful" }
  } catch (error) {
    console.error("DB: Connection test failed:", error)
    let errorMessage = "Database connection failed"
    if (error instanceof Error) {
      errorMessage += `: ${error.message}`
    }
    return { success: false, message: errorMessage }
  }
}
