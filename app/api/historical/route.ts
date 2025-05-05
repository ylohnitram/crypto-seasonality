import { NextResponse } from "next/server"
import { executeQuery } from "@/lib/db"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const symbol = searchParams.get("symbol")

    if (!symbol) {
      return NextResponse.json({ error: "Symbol parameter is required" }, { status: 400 })
    }

    console.log(`API: Fetching historical data for ${symbol}`)

    // Check if tables exist
    const tablesExist = await executeQuery(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'monthly_candles'
      ) as monthly_exists
    `)

    if (!tablesExist || !tablesExist[0].monthly_exists) {
      return NextResponse.json(
        {
          error: "Monthly candles table does not exist yet",
          needsInit: true,
        },
        { status: 404 },
      )
    }

    // Get monthly candles for this symbol
    const monthlyCandles = await executeQuery(
      `
      SELECT * FROM monthly_candles
      WHERE symbol = $1
      ORDER BY year ASC, month ASC
    `,
      [symbol],
    )

    return NextResponse.json({
      symbol,
      monthly: monthlyCandles,
    })
  } catch (error) {
    console.error("Error fetching historical data:", error)

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
        error: "Failed to fetch historical data",
        details: errorMsg,
      },
      { status: 500 },
    )
  }
}
