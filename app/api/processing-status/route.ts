import { NextResponse } from "next/server"
import { executeQuery } from "@/lib/db"

export async function GET() {
  try {
    console.log("API: Fetching processing status")

    // Zkontrolujeme, zda tabulka processing_state existuje
    const tableExists = await executeQuery(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'processing_state'
      ) as table_exists
    `)

    if (!tableExists || !tableExists[0].table_exists) {
      return NextResponse.json({
        exists: false,
        message: "Processing state table does not exist yet",
      })
    }

    // Získáme aktuální stav
    const state = await executeQuery(`SELECT * FROM processing_state ORDER BY id DESC LIMIT 1`)

    if (!state || state.length === 0) {
      return NextResponse.json({
        exists: true,
        isProcessing: false,
        message: "No processing state found",
      })
    }

    // Vypočítáme procento dokončení
    const percentComplete =
      state[0].total_symbols > 0 ? Math.round(((state[0].last_processed_index + 1) / state[0].total_symbols) * 100) : 0

    // Zjistíme, jak dlouho zpracování běží nebo kdy skončilo
    let duration = null
    let lastUpdated = null

    if (state[0].started_at) {
      const startedAt = new Date(state[0].started_at)
      const updatedAt = new Date(state[0].updated_at)

      if (state[0].is_processing) {
        // Pokud stále běží, vypočítáme dobu od začátku do teď
        const now = new Date()
        duration = Math.round((now.getTime() - startedAt.getTime()) / 1000) // v sekundách
      } else {
        // Pokud skončilo, vypočítáme dobu od začátku do poslední aktualizace
        duration = Math.round((updatedAt.getTime() - startedAt.getTime()) / 1000) // v sekundách
        lastUpdated = Math.round((new Date().getTime() - updatedAt.getTime()) / 1000) // v sekundách
      }
    }

    return NextResponse.json({
      exists: true,
      isProcessing: state[0].is_processing,
      lastProcessedSymbol: state[0].last_processed_symbol,
      lastProcessedIndex: state[0].last_processed_index,
      totalSymbols: state[0].total_symbols,
      percentComplete,
      startedAt: state[0].started_at,
      updatedAt: state[0].updated_at,
      duration, // v sekundách
      lastUpdated, // v sekundách
      remainingSymbols: state[0].total_symbols - (state[0].last_processed_index + 1),
    })
  } catch (error) {
    console.error("Error fetching processing status:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch processing status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
