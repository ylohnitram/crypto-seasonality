import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

export async function GET() {
  console.log("API: Testing database connection")

  // Log the environment variable (without exposing sensitive info)
  const dbUrlExists = !!process.env.DATABASE_URL
  console.log(`Database URL exists: ${dbUrlExists}`)

  if (!dbUrlExists) {
    return NextResponse.json(
      {
        success: false,
        error: "DATABASE_URL environment variable is not set",
      },
      { status: 500 },
    )
  }

  try {
    // Create a direct connection for this request
    const sql = neon(process.env.DATABASE_URL || "")

    // Test the connection with a simple query
    const result = await sql`SELECT 1 as connection_test`

    return NextResponse.json({
      success: true,
      message: "Database connection successful",
      result,
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
}
