import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

export async function GET() {
  console.log("API: Initializing database tables")

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

    // First, test if we can connect to the database at all
    try {
      console.log("Testing database connection...")
      const testResult = await sql`SELECT 1 as connection_test`
      console.log("Database connection test successful:", testResult)
    } catch (connectionError) {
      console.error("Database connection test failed:", connectionError)
      return NextResponse.json(
        {
          success: false,
          error: "Failed to connect to database. Please check your database connection.",
          details: connectionError instanceof Error ? connectionError.message : "Unknown error",
        },
        { status: 500 },
      )
    }

    // Create tables one by one with error handling for each
    console.log("Creating symbols table...")
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS symbols (
          symbol VARCHAR(20) PRIMARY KEY,
          base_asset VARCHAR(10) NOT NULL,
          quote_asset VARCHAR(10) NOT NULL,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `
      console.log("Created symbols table")
    } catch (error) {
      console.error("Error creating symbols table:", error)
      return NextResponse.json(
        {
          success: false,
          error: "Failed to create symbols table",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 },
      )
    }

    console.log("Creating daily_candles table...")
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS daily_candles (
          symbol VARCHAR(20) NOT NULL,
          timestamp BIGINT NOT NULL,
          open DECIMAL(30, 15) NOT NULL,
          high DECIMAL(30, 15) NOT NULL,
          low DECIMAL(30, 15) NOT NULL,
          close DECIMAL(30, 15) NOT NULL,
          volume DECIMAL(30, 15) NOT NULL,
          close_time BIGINT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (symbol, timestamp)
        )
      `
      console.log("Created daily_candles table")
    } catch (error) {
      console.error("Error creating daily_candles table:", error)
      return NextResponse.json(
        {
          success: false,
          error: "Failed to create daily_candles table",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 },
      )
    }

    console.log("Creating monthly_candles table...")
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS monthly_candles (
          symbol VARCHAR(20) NOT NULL,
          year INTEGER NOT NULL,
          month INTEGER NOT NULL,
          open DECIMAL(30, 15) NOT NULL,
          high DECIMAL(30, 15) NOT NULL,
          low DECIMAL(30, 15) NOT NULL,
          close DECIMAL(30, 15) NOT NULL,
          volume DECIMAL(30, 15) NOT NULL,
          return_pct DECIMAL(10, 6),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (symbol, year, month)
        )
      `
      console.log("Created monthly_candles table")
    } catch (error) {
      console.error("Error creating monthly_candles table:", error)
      return NextResponse.json(
        {
          success: false,
          error: "Failed to create monthly_candles table",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 },
      )
    }

    console.log("Database tables created successfully")
    return NextResponse.json({
      success: true,
      message: "Database tables created successfully",
    })
  } catch (error) {
    console.error("Unexpected error in init-db API:", error)

    return NextResponse.json(
      {
        success: false,
        error: "Failed to initialize database",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
