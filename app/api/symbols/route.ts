import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

export async function GET() {
  console.log("API: Fetching symbols from database")

  // Get the database URL
  const dbUrl = process.env.DATABASE_URL || ""

  // Check if the database URL is valid
  if (!dbUrl || dbUrl === "" || dbUrl.includes("váš_neon_database_url") || !dbUrl.startsWith("postgres")) {
    console.error("Invalid database URL detected:", dbUrl.substring(0, 10) + "...")
    return NextResponse.json(
      {
        error: "Invalid database URL. Please set a valid DATABASE_URL environment variable.",
        invalidDbUrl: true,
      },
      { status: 500 },
    )
  }

  try {
    // Create a direct connection for this request
    const sql = neon(dbUrl)

    // First, test if we can connect to the database at all with a simple query
    try {
      console.log("Testing database connection...")
      const testResult = await sql`SELECT 1 as connection_test`
      console.log("Database connection test successful:", testResult)
    } catch (connectionError) {
      console.error("Database connection test failed:", connectionError)

      // Return a more user-friendly error
      return NextResponse.json(
        {
          error: "Database connection failed. Please check your database configuration.",
          details: connectionError instanceof Error ? connectionError.message : "Unknown error",
        },
        { status: 500 },
      )
    }

    // Check if the symbols table exists
    try {
      console.log("Checking if symbols table exists...")
      const tableCheck = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public'
          AND table_name = 'symbols'
        ) as table_exists
      `

      const tableExists = tableCheck[0]?.table_exists
      console.log(`Symbols table exists: ${tableExists}`)

      if (!tableExists) {
        console.log("Symbols table does not exist - returning 404")
        return NextResponse.json(
          {
            error: "Symbols table does not exist. Please initialize the database.",
            needsInit: true,
          },
          { status: 404 },
        )
      }
    } catch (tableCheckError) {
      console.error("Error checking if table exists:", tableCheckError)
      // Continue anyway - we'll handle errors in the main query
    }

    // Now try to get symbols with a simple query
    try {
      console.log("Querying symbols table...")
      const symbols = await sql`SELECT symbol FROM symbols WHERE is_active = true ORDER BY symbol ASC`

      console.log(`API: Found ${symbols?.length || 0} symbols in database`)

      if (!symbols || symbols.length === 0) {
        console.log("API: No symbols found in database")
        return NextResponse.json(
          {
            symbols: [],
            count: 0,
            message: "No symbols found in database. Please run the data update process.",
          },
          { status: 200 }, // Return 200 with empty array instead of 404
        )
      }

      return NextResponse.json({
        symbols: symbols.map((row) => row.symbol),
        count: symbols.length,
      })
    } catch (queryError) {
      console.error("Error executing symbols query:", queryError)

      // Check if the table might not exist
      const errorMessage = queryError instanceof Error ? queryError.message : "Unknown error"
      if (errorMessage.includes("relation") && errorMessage.includes("does not exist")) {
        return NextResponse.json(
          {
            error: "The symbols table does not exist. Database needs initialization.",
            needsInit: true,
          },
          { status: 404 }, // Return 404 instead of 500 for missing table
        )
      }

      // Return a fallback response with empty symbols array
      return NextResponse.json(
        {
          symbols: [],
          count: 0,
          error: "Failed to query symbols from database",
          details: errorMessage,
          fallback: true,
        },
        { status: 200 }, // Return 200 with error info instead of 500
      )
    }
  } catch (error) {
    console.error("Unexpected error in symbols API:", error)

    // Provide more detailed error information
    let errorMessage = "Failed to fetch symbols from database"
    if (error instanceof Error) {
      errorMessage += `: ${error.message}`
    }

    // Return a fallback response with empty symbols array
    return NextResponse.json(
      {
        symbols: [],
        count: 0,
        error: errorMessage,
        details: error instanceof Error ? error.stack : "No stack trace available",
        fallback: true,
      },
      { status: 200 }, // Return 200 with error info instead of 500
    )
  }
}
