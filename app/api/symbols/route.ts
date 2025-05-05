import { NextResponse } from "next/server"
import { executeQuery } from "@/lib/db"

export async function GET() {
  try {
    console.log("API: Fetching available symbols")

    // Check if DATABASE_URL is set
    if (!process.env.DATABASE_URL) {
      console.error("DATABASE_URL environment variable is not set")
      return NextResponse.json(
        {
          invalidDbUrl: true,
          error: "Database URL is not configured",
          details:
            "The DATABASE_URL environment variable is not set. Please configure it in your Vercel project settings.",
        },
        { status: 500 },
      )
    }

    // Check if the database URL is valid
    try {
      new URL(process.env.DATABASE_URL)
    } catch (error) {
      console.error("Invalid DATABASE_URL format:", error)
      return NextResponse.json(
        {
          invalidDbUrl: true,
          error: "Invalid database URL format",
          details: "The DATABASE_URL environment variable is not a valid URL. Please check your configuration.",
        },
        { status: 500 },
      )
    }

    // Check if the database URL is a PostgreSQL URL
    if (!process.env.DATABASE_URL.startsWith("postgres://") && !process.env.DATABASE_URL.startsWith("postgresql://")) {
      console.error("DATABASE_URL is not a PostgreSQL URL")
      return NextResponse.json(
        {
          invalidDbUrl: true,
          error: "Invalid database URL",
          details: "The DATABASE_URL must start with postgres:// or postgresql://",
        },
        { status: 500 },
      )
    }

    // Check if tables exist
    const tablesExist = await executeQuery(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'symbols'
      ) as symbols_exists
    `)

    if (!tablesExist || !tablesExist[0].symbols_exists) {
      return NextResponse.json(
        {
          error: "Symbols table does not exist yet",
          needsInit: true,
        },
        { status: 404 },
      )
    }

    // Get active symbols from database
    const symbols = await executeQuery(`
      SELECT symbol FROM symbols 
      WHERE is_active = true 
      ORDER BY symbol ASC
    `)

    return NextResponse.json({
      symbols: symbols.map((s: any) => s.symbol),
    })
  } catch (error) {
    console.error("Error fetching symbols:", error)

    // Check if this is a database initialization issue
    const errorMsg = error instanceof Error ? error.message : String(error)

    if (errorMsg.includes("table") && (errorMsg.includes("not exist") || errorMsg.includes("doesn't exist"))) {
      return NextResponse.json(
        {
          error: "Database tables need to be initialized",
          needsInit: true,
          details: errorMsg,
        },
        { status: 404 },
      )
    }

    return NextResponse.json(
      {
        error: "Failed to fetch symbols",
        details: errorMsg,
      },
      { status: 500 },
    )
  }
}
