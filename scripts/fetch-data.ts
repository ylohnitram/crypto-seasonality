import { neon } from "@neondatabase/serverless"
import dotenv from "dotenv"

// Načtení proměnných prostředí z .env souboru
dotenv.config()

// Vytvoření SQL klienta
const sql = neon(process.env.DATABASE_URL!)

// Helper funkce pro vykonání dotazu s ošetřením chyb
async function executeQuery(query: string, params: any[] = []) {
  try {
    const result = await sql.query(query, params)
    return result.rows
  } catch (error) {
    console.error("Database query error:", error)

    if (error instanceof Error) {
      const errorMessage = error.message || ""
      if (errorMessage.includes("Too Many Requests") || errorMessage.includes("429")) {
        console.log("Rate limit exceeded: Too many requests to the database. Waiting before retry...")
        await new Promise((resolve) => setTimeout(resolve, 15000))
        return executeQuery(query, params) // Retry after waiting
      }
    }

    throw error
  }
}

// Vylepšená funkce pro fetch s retry logikou
async function fetchWithRetry(url: string, options = {}, retries = 3, initialBackoff = 1000) {
  let backoff = initialBackoff

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options)

      // Zpracování rate limitingu
      if (response.status === 429) {
        const retryAfter = response.headers.get("retry-after")
        const waitTime = retryAfter ? Number.parseInt(retryAfter) * 1000 : backoff

        console.log(`Rate limited. Waiting ${waitTime}ms before retry. Attempt ${attempt + 1}/${retries + 1}`)

        if (attempt === retries) {
          throw new Error(`Rate limit exceeded after ${retries} retries`)
        }

        await new Promise((resolve) => setTimeout(resolve, waitTime))
        backoff = backoff * 2
        continue
      }

      // Zpracování serverových chyb
      if (response.status >= 500) {
        console.log(`Server error ${response.status}. Retrying in ${backoff}ms. Attempt ${attempt + 1}/${retries + 1}`)

        if (attempt === retries) {
          throw new Error(`Server error ${response.status} after ${retries} retries`)
        }

        await new Promise((resolve) => setTimeout(resolve, backoff))
        backoff = backoff * 2
        continue
      }

      // Zpracování ostatních chyb
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`)
      }

      // Kontrola typu obsahu před parsováním JSON
      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text()
        console.error(`Non-JSON response: ${text.substring(0, 100)}...`)
        throw new Error(`Expected JSON response but got: ${contentType}`)
      }

      // Parsování JSON odpovědi
      return await response.json()
    } catch (error) {
      if (attempt === retries) {
        throw error
      }

      console.log(`Fetch error: ${error}. Retrying in ${backoff}ms. Attempt ${attempt + 1}/${retries + 1}`)
      await new Promise((resolve) => setTimeout(resolve, backoff))
      backoff = backoff * 2
    }
  }

  throw new Error(`Failed after ${retries} retries`)
}

// Zpracování denních svíček do měsíčních
async function processMonthlyCandles(symbol: string) {
  try {
    // Získání všech denních svíček pro tento symbol
    const dailyCandles = await executeQuery(`SELECT * FROM daily_candles WHERE symbol = $1 ORDER BY timestamp ASC`, [
      symbol,
    ])

    if (!dailyCandles || dailyCandles.length === 0) {
      return
    }

    // Seskupení svíček podle roku a měsíce
    const monthlyGroups: Record<string, any[]> = {}

    for (const candle of dailyCandles) {
      const date = new Date(Number(candle.timestamp))
      const year = date.getFullYear()
      const month = date.getMonth() + 1 // 1-12
      const key = `${year}-${month}`

      if (!monthlyGroups[key]) {
        monthlyGroups[key] = []
      }

      monthlyGroups[key].push(candle)
    }

    // Zpracování každého měsíce
    for (const key of Object.keys(monthlyGroups)) {
      const [yearStr, monthStr] = key.split("-")
      const year = Number.parseInt(yearStr)
      const month = Number.parseInt(monthStr)
      const candles = monthlyGroups[key]

      if (candles.length === 0) continue

      // První svíčka měsíce
      const firstCandle = candles[0]

      // Poslední svíčka měsíce
      const lastCandle = candles[candles.length - 1]

      // Výpočet měsíčního high a low
      let monthlyHigh = Number(candles[0].high)
      let monthlyLow = Number(candles[0].low)
      let monthlyVolume = 0

      for (const candle of candles) {
        const high = Number(candle.high)
        const low = Number(candle.low)
        const volume = Number(candle.volume)

        if (high > monthlyHigh) monthlyHigh = high
        if (low < monthlyLow) monthlyLow = low
        monthlyVolume += volume
      }

      // Výpočet měsíčního returnu
      let returnPct = null

      try {
        // Získání close ceny předchozího měsíce
        const prevMonth = month === 1 ? 12 : month - 1
        const prevYear = month === 1 ? year - 1 : year

        const prevMonthData = await executeQuery(
          `SELECT close FROM monthly_candles WHERE symbol = $1 AND year = $2 AND month = $3`,
          [symbol, prevYear, prevMonth],
        )

        if (prevMonthData && prevMonthData.length > 0) {
          const prevClose = Number(prevMonthData[0].close)
          const currentClose = Number(lastCandle.close)
          returnPct = (currentClose - prevClose) / prevClose
        }
      } catch (error) {
        console.error(`Error calculating return for ${symbol} ${year}-${month}:`, error)

        if (error instanceof Error && error.message.includes("Rate limit")) {
          console.log("Rate limit detected, waiting 10 seconds before continuing...")
          await new Promise((resolve) => setTimeout(resolve, 10000))
        }

        returnPct = null
      }

      // Uložení měsíční svíčky
      try {
        await executeQuery(
          `INSERT INTO monthly_candles 
            (symbol, year, month, open, high, low, close, volume, return_pct) 
           VALUES 
            ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (symbol, year, month) 
           DO UPDATE SET 
            open = $4, high = $5, low = $6, close = $7, volume = $8, return_pct = $9,
            updated_at = CURRENT_TIMESTAMP`,
          [symbol, year, month, firstCandle.open, monthlyHigh, monthlyLow, lastCandle.close, monthlyVolume, returnPct],
        )
      } catch (error) {
        console.error(`Error storing monthly candle for ${symbol} ${year}-${month}:`, error)

        if (error instanceof Error && error.message.includes("Rate limit")) {
          console.log("Rate limit detected, waiting 10 seconds before continuing...")
          await new Promise((resolve) => setTimeout(resolve, 10000))

          try {
            await executeQuery(
              `INSERT INTO monthly_candles 
                (symbol, year, month, open, high, low, close, volume, return_pct) 
               VALUES 
                ($1, $2, $3, $4, $5, $6, $7, $8, $9)
               ON CONFLICT (symbol, year, month) 
               DO UPDATE SET 
                open = $4, high = $5, low = $6, close = $7, volume = $8, return_pct = $9,
                updated_at = CURRENT_TIMESTAMP`,
              [
                symbol,
                year,
                month,
                firstCandle.open,
                monthlyHigh,
                monthlyLow,
                lastCandle.close,
                monthlyVolume,
                returnPct,
              ],
            )
          } catch (retryError) {
            console.error(`Error retrying to store monthly candle for ${symbol} ${year}-${month}:`, retryError)
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error processing monthly candles for ${symbol}:`, error)
    throw error
  }
}

// Hlavní funkce pro načtení dat
async function fetchData() {
  try {
    console.log("Starting data update process to fetch crypto data")

    // 1. Načtení dostupných symbolů z Binance
    console.log("Fetching available symbols from Binance...")

    // Použití správného endpointu pro získání informací o symbolech
    const exchangeInfoUrl = "https://data-api.binance.vision/api/v3/exchangeInfo"

    let exchangeInfo
    try {
      exchangeInfo = await fetchWithRetry(exchangeInfoUrl, {}, 5, 2000)
    } catch (error) {
      console.error("Failed to fetch exchange info:", error)
      return
    }

    // Filtrování pouze USDT párů
    const symbols = exchangeInfo.symbols.filter(
      (symbol: any) => symbol.status === "TRADING" && symbol.quoteAsset === "USDT",
    )

    console.log(`Found ${symbols.length} trading pairs to update`)

    // 2. Aktualizace symbolů v databázi
    console.log("Updating symbols in database...")

    // Zpracování symbolů v menších dávkách
    const symbolBatchSize = 5
    for (let i = 0; i < symbols.length; i += symbolBatchSize) {
      const batch = symbols.slice(i, i + symbolBatchSize)
      const batchNumber = Math.floor(i / symbolBatchSize) + 1
      const totalBatches = Math.ceil(symbols.length / symbolBatchSize)

      console.log(`Processing symbol batch ${batchNumber}/${totalBatches}`)

      try {
        for (const symbol of batch) {
          try {
            await executeQuery(
              `INSERT INTO symbols (symbol, base_asset, quote_asset) 
               VALUES ($1, $2, $3) 
               ON CONFLICT (symbol) 
               DO UPDATE SET 
                 base_asset = $2, 
                 quote_asset = $3, 
                 is_active = true, 
                 updated_at = CURRENT_TIMESTAMP`,
              [symbol.symbol, symbol.baseAsset, symbol.quoteAsset],
            )
          } catch (symbolError) {
            console.error(`Error updating symbol ${symbol.symbol}:`, symbolError)

            if (symbolError instanceof Error && symbolError.message.includes("Rate limit")) {
              console.log("Rate limit detected, waiting 15 seconds before continuing...")
              await new Promise((resolve) => setTimeout(resolve, 15000))
            }
          }

          // Krátká pauza mezi jednotlivými symboly v dávce
          await new Promise((resolve) => setTimeout(resolve, 500))
        }
      } catch (batchError) {
        console.error(`Error updating symbols batch ${batchNumber}:`, batchError)

        if (batchError instanceof Error && batchError.message.includes("Rate limit")) {
          console.log("Rate limit detected, waiting 15 seconds before continuing...")
          await new Promise((resolve) => setTimeout(resolve, 15000))
        }
      }

      // Delší pauza mezi dávkami
      console.log(`Waiting 5 seconds before processing next symbol batch...`)
      await new Promise((resolve) => setTimeout(resolve, 5000))
    }

    // 3. Zpracování pouze nejpopulárnějších symbolů pro začátek
    const popularSymbols = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "XRPUSDT", "ADAUSDT", "DOGEUSDT", "SOLUSDT", "MATICUSDT"]
    const symbolsToProcess = symbols.filter((s: any) => popularSymbols.includes(s.symbol))

    console.log(`Processing ${symbolsToProcess.length} popular symbols`)

    // Aktuální čas pro načítání dat
    const currentTime = new Date().getTime()

    // Zpracování symbolů jeden po druhém
    for (let i = 0; i < symbolsToProcess.length; i++) {
      const symbol = symbolsToProcess[i]

      console.log(`Processing symbol ${i + 1}/${symbolsToProcess.length}: ${symbol.symbol}`)

      try {
        // Načtení historických dat (poslední 2 roky)
        const startTime = new Date()
        startTime.setFullYear(startTime.getFullYear() - 2)
        const startTimestamp = startTime.getTime()

        console.log(`Fetching historical data for ${symbol.symbol} since ${startTime.toISOString()}`)

        // Použití správného endpointu pro získání svíček
        const klinesUrl = `https://data-api.binance.vision/api/v3/klines?symbol=${symbol.symbol}&interval=1d&startTime=${startTimestamp}&limit=500`

        const data = await fetchWithRetry(klinesUrl, {}, 5, 2000)

        // Transformace dat
        const dailyCandles = data.map((kline: any[]) => ({
          timestamp: kline[0], // Open time
          open: kline[1],
          high: kline[2],
          low: kline[3],
          close: kline[4],
          volume: kline[5],
          closeTime: kline[6],
        }))

        console.log(`Retrieved ${dailyCandles.length} daily candles for ${symbol.symbol}`)

        // Uložení denních svíček do databáze v menších dávkách
        const candleBatchSize = 20
        for (let j = 0; j < dailyCandles.length; j += candleBatchSize) {
          const candleBatch = dailyCandles.slice(j, j + candleBatchSize)

          console.log(
            `Storing candle batch ${Math.floor(j / candleBatchSize) + 1}/${Math.ceil(dailyCandles.length / candleBatchSize)} for ${symbol.symbol}`,
          )

          for (const candle of candleBatch) {
            try {
              await executeQuery(
                `INSERT INTO daily_candles 
                  (symbol, timestamp, open, high, low, close, volume, close_time) 
                 VALUES 
                  ($1, $2, $3, $4, $5, $6, $7, $8)
                 ON CONFLICT (symbol, timestamp) 
                 DO UPDATE SET 
                  open = $3, high = $4, low = $5, close = $6, volume = $7, close_time = $8`,
                [
                  symbol.symbol,
                  candle.timestamp,
                  candle.open,
                  candle.high,
                  candle.low,
                  candle.close,
                  candle.volume,
                  candle.closeTime,
                ],
              )
            } catch (candleError) {
              console.error(`Error storing candle for ${symbol.symbol}:`, candleError)

              if (candleError instanceof Error && candleError.message.includes("Rate limit")) {
                console.log("Rate limit detected, waiting 15 seconds before continuing...")
                await new Promise((resolve) => setTimeout(resolve, 15000))
              }
            }

            // Krátká pauza mezi jednotlivými svíčkami
            await new Promise((resolve) => setTimeout(resolve, 100))
          }

          // Pauza mezi dávkami svíček
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }

        // Aktualizace měsíčních svíček
        console.log(`Processing monthly candles for ${symbol.symbol}`)
        await processMonthlyCandles(symbol.symbol)

        console.log(`Completed processing ${symbol.symbol}`)
      } catch (error) {
        console.error(`Error processing ${symbol.symbol}:`, error)
      }

      // Delší pauza mezi symboly
      if (i < symbolsToProcess.length - 1) {
        console.log(`Waiting 8 seconds before processing next symbol...`)
        await new Promise((resolve) => setTimeout(resolve, 8000))
      }
    }

    console.log("Data update completed successfully!")
  } catch (error) {
    console.error("Error in data update process:", error)
  }
}

// Spuštění hlavní funkce
fetchData()
  .then(() => {
    console.log("Script completed")
    process.exit(0)
  })
  .catch((error) => {
    console.error("Script failed:", error)
    process.exit(1)
  })
