import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get("symbol")

  if (!symbol) {
    return NextResponse.json({ error: "Symbol parameter is required" }, { status: 400 })
  }

  console.log(`API: Fetching historical data for ${symbol}`)

  // Log the environment variable (without exposing sensitive info)
  const dbUrlExists = !!process.env.DATABASE_URL
  console.log(`Database URL exists: ${dbUrlExists}`)

  if (!dbUrlExists) {
    return NextResponse.json(
      {
        error: "DATABASE_URL environment variable is not set",
      },
      { status: 500 },
    )
  }

  try {
    // Create a direct connection for this request
    const sql = neon(process.env.DATABASE_URL || "")

    // Get the current year
    const currentYear = new Date().getFullYear()

    // Get monthly candles from database, excluding the current year
    try {
      const monthlyData = await sql`
        SELECT 
          symbol, year, month, open, high, low, close, volume, return_pct
        FROM 
          monthly_candles 
        WHERE 
          symbol = ${symbol} AND year < ${currentYear}
        ORDER BY 
          year ASC, month ASC
      `

      if (!monthlyData || monthlyData.length === 0) {
        return NextResponse.json(
          {
            error: "No historical data found for this symbol in the database",
          },
          { status: 404 },
        )
      }

      return NextResponse.json({ monthly: monthlyData })
    } catch (queryError) {
      console.error(`Error fetching historical data for ${symbol}:`, queryError)

      // Check if the table might not exist
      const errorMessage = queryError instanceof Error ? queryError.message : "Unknown error"
      if (errorMessage.includes("relation") && errorMessage.includes("does not exist")) {
        return NextResponse.json(
          {
            error: "The monthly_candles table does not exist. Database may not be initialized properly.",
            details: errorMessage,
          },
          { status: 500 },
        )
      }

      return NextResponse.json(
        {
          error: `Failed to fetch data for ${symbol} from database`,
          details: errorMessage,
        },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error(`Error in historical API for ${symbol}:`, error)
    return NextResponse.json(
      {
        error: `Failed to fetch data for ${symbol}`,
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
