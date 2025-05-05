import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get("symbol")

  if (!symbol) {
    return NextResponse.json({ error: "Symbol parameter is required" }, { status: 400 })
  }

  try {
    console.log(`API: Getting data status for ${symbol}`)

    // Get the last timestamp for this symbol
    try {
      const result = await sql`
        SELECT MAX(timestamp) as last_timestamp 
        FROM daily_candles 
        WHERE symbol = ${symbol}
      `

      if (!result || result.length === 0 || !result[0].last_timestamp) {
        return NextResponse.json({ lastUpdate: null })
      }

      // Convert timestamp to ISO string
      const lastTimestamp = Number(result[0].last_timestamp)
      const lastUpdate = new Date(lastTimestamp).toISOString()

      return NextResponse.json({
        lastUpdate,
        symbol,
      })
    } catch (error) {
      console.error(`Error getting data status for ${symbol}:`, error)

      // Check if the table might not exist
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      if (errorMessage.includes("relation") && errorMessage.includes("does not exist")) {
        return NextResponse.json(
          {
            error: "The daily_candles table does not exist. Database may not be initialized properly.",
            details: errorMessage,
          },
          { status: 500 },
        )
      }

      return NextResponse.json(
        {
          error: "Failed to get data status",
          details: errorMessage,
        },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error(`Error in data-status API for ${symbol}:`, error)
    return NextResponse.json(
      {
        error: "Failed to get data status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
