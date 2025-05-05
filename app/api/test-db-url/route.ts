import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

export async function POST(request: Request) {
  try {
    const { dbUrl } = await request.json()

    if (!dbUrl || typeof dbUrl !== "string" || !dbUrl.startsWith("postgres")) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid database URL. URL should start with postgres://",
        },
        { status: 400 },
      )
    }

    // Test the connection
    try {
      const sql = neon(dbUrl)
      const result = await sql`SELECT 1 as connection_test`

      return NextResponse.json({
        success: true,
        message: "Database connection successful",
      })
    } catch (error) {
      console.error("Database connection test failed:", error)

      return NextResponse.json(
        {
          success: false,
          error: "Database connection failed",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error("Error in test-db-url API:", error)

    return NextResponse.json(
      {
        success: false,
        error: "Failed to process request",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
