import { NextResponse } from "next/server"
import { executeQuery } from "@/lib/db"

export async function GET() {
  try {
    console.log("API: Initializing database tables")

    // Create symbols table
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS symbols (
        id SERIAL PRIMARY KEY,
        symbol VARCHAR(20) UNIQUE NOT NULL,
        base_asset VARCHAR(10),
        quote_asset VARCHAR(10),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Create daily_candles table
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS daily_candles (
        id SERIAL PRIMARY KEY,
        symbol VARCHAR(20) NOT NULL,
        timestamp BIGINT NOT NULL,
        open DECIMAL(24, 8) NOT NULL,
        high DECIMAL(24, 8) NOT NULL,
        low DECIMAL(24, 8) NOT NULL,
        close DECIMAL(24, 8) NOT NULL,
        volume DECIMAL(36, 8) NOT NULL,
        close_time BIGINT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(symbol, timestamp)
      )
    `)

    // Create monthly_candles table
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS monthly_candles (
        id SERIAL PRIMARY KEY,
        symbol VARCHAR(20) NOT NULL,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        open DECIMAL(24, 8) NOT NULL,
        high DECIMAL(24, 8) NOT NULL,
        low DECIMAL(24, 8) NOT NULL,
        close DECIMAL(24, 8) NOT NULL,
        volume DECIMAL(36, 8) NOT NULL,
        return_pct DECIMAL(10, 6),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(symbol, year, month)
      )
    `)

    // Create processing_state table
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS processing_state (
        id SERIAL PRIMARY KEY,
        last_processed_symbol VARCHAR(20),
        last_processed_index INTEGER,
        total_symbols INTEGER,
        is_processing BOOLEAN DEFAULT false,
        started_at TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    return NextResponse.json({
      success: true,
      message: "Database tables initialized successfully",
    })
  } catch (error) {
    console.error("Error initializing database tables:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to initialize database tables",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
