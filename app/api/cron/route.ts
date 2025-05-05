import { NextResponse } from "next/server"
import { executeQuery } from "@/lib/db"

// Přidám tuto funkci na začátek souboru pro lepší zpracování odpovědí
async function safelyParseResponse(response: Response) {
  try {
    // Nejprve zkontrolujeme, zda je odpověď ve formátu JSON
    const contentType = response.headers.get("content-type")
    if (contentType && contentType.includes("application/json")) {
      return await response.json()
    } else {
      // Pokud není JSON, získáme text odpovědi
      const text = await response.text()
      console.error(`Non-JSON response: ${text.substring(0, 200)}...`)
      throw new Error(`Server returned non-JSON response: ${text.substring(0, 100)}...`)
    }
  } catch (error) {
    // Pokud dojde k chybě při parsování JSON, vrátíme text odpovědi
    const text = await response.text()
    console.error(`Error parsing response: ${text.substring(0, 200)}...`)
    throw new Error(`Failed to parse response: ${text.substring(0, 100)}...`)
  }
}

// Upravím funkci fetchWithRetry, aby používala safelyParseResponse
async function fetchWithRetry(url: string, options = {}, retries = 3, initialBackoff = 1000) {
  let backoff = initialBackoff

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options)

      // Handle rate limiting specifically
      if (response.status === 429) {
        // Get retry-after header if available
        const retryAfter = response.headers.get("retry-after")
        const waitTime = retryAfter ? Number.parseInt(retryAfter) * 1000 : backoff

        console.log(`Rate limited. Waiting ${waitTime}ms before retry. Attempt ${attempt + 1}/${retries + 1}`)

        if (attempt === retries) {
          throw new Error(`Rate limit exceeded after ${retries} retries`)
        }

        // Wait for the specified time
        await new Promise((resolve) => setTimeout(resolve, waitTime))

        // Increase backoff for next attempt
        backoff = backoff * 2
        continue
      }

      // Handle other server errors
      if (response.status >= 500) {
        console.log(`Server error ${response.status}. Retrying in ${backoff}ms. Attempt ${attempt + 1}/${retries + 1}`)

        if (attempt === retries) {
          throw new Error(`Server error ${response.status} after ${retries} retries`)
        }

        await new Promise((resolve) => setTimeout(resolve, backoff))
        backoff = backoff * 2
        continue
      }

      // Handle other non-success responses
      if (!response.ok) {
        // Pokusíme se získat text chybové zprávy
        const errorText = await response.text()
        throw new Error(`HTTP error ${response.status}: ${errorText.substring(0, 100)}`)
      }

      // Bezpečně parsujeme odpověď
      return await safelyParseResponse(response)
    } catch (error) {
      // If this was the last retry, throw the error
      if (attempt === retries) {
        throw error
      }

      console.log(`Fetch error: ${error}. Retrying in ${backoff}ms. Attempt ${attempt + 1}/${retries + 1}`)
      await new Promise((resolve) => setTimeout(resolve, backoff))
      backoff = backoff * 2
    }
  }

  // This should never be reached due to the throw in the last iteration
  throw new Error(`Failed after ${retries} retries`)
}

// Process daily candles into monthly candles
async function processMonthlyCandles(symbol: string) {
  try {
    // Get all daily candles for this symbol
    const dailyCandles = await executeQuery(`SELECT * FROM daily_candles WHERE symbol = $1 ORDER BY timestamp ASC`, [
      symbol,
    ])

    if (!dailyCandles || dailyCandles.length === 0) {
      return
    }

    // Group candles by year and month
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

    // Process each month
    for (const key of Object.keys(monthlyGroups)) {
      const [yearStr, monthStr] = key.split("-")
      const year = Number.parseInt(yearStr)
      const month = Number.parseInt(monthStr)
      const candles = monthlyGroups[key]

      if (candles.length === 0) continue

      // First candle of the month
      const firstCandle = candles[0]

      // Last candle of the month
      const lastCandle = candles[candles.length - 1]

      // Calculate monthly high and low
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

      // Calculate monthly return
      let returnPct = null

      try {
        // Get previous month's close
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

        // Pokud dojde k chybě rate limitingu, počkáme delší dobu
        if (error instanceof Error && error.message.includes("Rate limit")) {
          console.log("Rate limit detected, waiting 10 seconds before continuing...")
          await new Promise((resolve) => setTimeout(resolve, 10000))
        }

        // Pokračujeme s null hodnotou pro return
        returnPct = null
      }

      // Store monthly candle
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

        // Pokud dojde k chybě rate limitingu, počkáme delší dobu
        if (error instanceof Error && error.message.includes("Rate limit")) {
          console.log("Rate limit detected, waiting 10 seconds before continuing...")
          await new Promise((resolve) => setTimeout(resolve, 10000))

          // Zkusíme to znovu po čekání
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
            // Pokračujeme dál i při chybě
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error processing monthly candles for ${symbol}:`, error)
    throw error
  }
}

// Get the last timestamp for a symbol from the database
async function getLastTimestamp(symbol: string) {
  try {
    const result = await executeQuery(`SELECT MAX(timestamp) as last_timestamp FROM daily_candles WHERE symbol = $1`, [
      symbol,
    ])

    if (result && result.length > 0 && result[0].last_timestamp) {
      return Number(result[0].last_timestamp)
    }

    return null
  } catch (error) {
    console.error(`Error getting last timestamp for ${symbol}:`, error)
    return null
  }
}

// Check for gaps in data
async function findDataGaps(symbol: string, startTimestamp: number, endTimestamp: number) {
  try {
    // Get all timestamps for this symbol within the range
    const timestamps = await executeQuery(
      `SELECT timestamp FROM daily_candles 
       WHERE symbol = $1 AND timestamp >= $2 AND timestamp <= $3 
       ORDER BY timestamp ASC`,
      [symbol, startTimestamp, endTimestamp],
    )

    if (!timestamps || timestamps.length === 0) {
      // No data in this range, so the entire range is a gap
      return [
        {
          start: startTimestamp,
          end: endTimestamp,
        },
      ]
    }

    const gaps = []
    let prevTimestamp = Number(timestamps[0].timestamp)
    const oneDayMs = 24 * 60 * 60 * 1000

    // Check for gaps between timestamps
    for (let i = 1; i < timestamps.length; i++) {
      const currentTimestamp = Number(timestamps[i].timestamp)
      const diff = currentTimestamp - prevTimestamp

      // If the difference is more than one day (plus a small buffer), we have a gap
      if (diff > oneDayMs * 1.5) {
        gaps.push({
          start: prevTimestamp + oneDayMs,
          end: currentTimestamp - oneDayMs,
        })
      }

      prevTimestamp = currentTimestamp
    }

    // Check if there's a gap at the end
    const lastTimestamp = Number(timestamps[timestamps.length - 1].timestamp)
    if (endTimestamp - lastTimestamp > oneDayMs * 1.5) {
      gaps.push({
        start: lastTimestamp + oneDayMs,
        end: endTimestamp,
      })
    }

    return gaps
  } catch (error) {
    console.error(`Error finding data gaps for ${symbol}:`, error)

    // Pokud dojde k chybě rate limitingu, počkáme a zkusíme to znovu
    if (error instanceof Error && error.message.includes("Rate limit")) {
      console.log("Rate limit detected in findDataGaps, waiting 10 seconds before retrying...")
      await new Promise((resolve) => setTimeout(resolve, 10000))

      // Zkusíme to znovu po čekání
      try {
        return findDataGaps(symbol, startTimestamp, endTimestamp)
      } catch (retryError) {
        console.error(`Error retrying to find data gaps for ${symbol}:`, retryError)
        // Pro ostatní chyby vrátíme prázdný seznam mezer
        return []
      }
    }

    // Pro ostatní chyby vrátíme prázdný seznam mezer
    return []
  }
}

// Main cron job function
export async function GET() {
  try {
    console.log("Starting data update process to fetch crypto data")

    // 1. Fetch all available perpetual futures from Binance
    console.log("Fetching available symbols from Binance...")

    // Změna: Použití správného endpointu pro získání informací o symbolech
    const exchangeInfoUrl = "https://data-api.binance.vision/api/v3/exchangeInfo"

    let exchangeInfo
    try {
      exchangeInfo = await fetchWithRetry(exchangeInfoUrl, {}, 5, 2000)
    } catch (error) {
      console.error("Failed to fetch exchange info:", error)
      return NextResponse.json(
        {
          success: false,
          error: "Failed to fetch exchange info from Binance. The API may be rate limiting requests.",
        },
        { status: 500 },
      )
    }

    // Filter for USDT-margined pairs only (spot market)
    const symbols = exchangeInfo.symbols.filter(
      (symbol: any) => symbol.status === "TRADING" && symbol.quoteAsset === "USDT",
    )

    console.log(`Found ${symbols.length} trading pairs to update`)

    // 2. Update symbols in database
    console.log("Updating symbols in database...")

    // Zpracovávám symboly v menších dávkách, abych snížil riziko rate limitingu
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

            // Pokud dojde k chybě rate limitingu, počkáme delší dobu
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

        // Pokud dojde k chybě rate limitingu, počkáme delší dobu
        if (batchError instanceof Error && batchError.message.includes("Rate limit")) {
          console.log("Rate limit detected, waiting 15 seconds before continuing...")
          await new Promise((resolve) => setTimeout(resolve, 15000))
        }
      }

      // Delší pauza mezi dávkami
      console.log(`Waiting 5 seconds before processing next symbol batch...`)
      await new Promise((resolve) => setTimeout(resolve, 5000))
    }

    // 3. Check if we need to do initial setup (no daily candles in database)
    let existingCandles
    try {
      existingCandles = await executeQuery("SELECT COUNT(*) as count FROM daily_candles")
    } catch (error) {
      console.error("Error checking existing candles:", error)

      // Pokud dojde k chybě rate limitingu, počkáme delší dobu a zkusíme to znovu
      if (error instanceof Error && error.message.includes("Rate limit")) {
        console.log("Rate limit detected, waiting 15 seconds before retrying...")
        await new Promise((resolve) => setTimeout(resolve, 15000))

        try {
          existingCandles = await executeQuery("SELECT COUNT(*) as count FROM daily_candles")
        } catch (retryError) {
          console.error("Error retrying to check existing candles:", retryError)
          return NextResponse.json(
            {
              success: false,
              error: "Failed to check existing data. The database may be experiencing issues.",
            },
            { status: 500 },
          )
        }
      } else {
        return NextResponse.json(
          {
            success: false,
            error: "Failed to check existing data. The database may be experiencing issues.",
          },
          { status: 500 },
        )
      }
    }

    const isInitialSetup = existingCandles[0].count === 0

    let successCount = 0
    let errorCount = 0
    let skippedCount = 0

    // For initial setup, only process a limited number of symbols to avoid rate limiting
    // We'll focus on the most popular ones first
    const popularSymbols = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "XRPUSDT", "ADAUSDT", "DOGEUSDT", "SOLUSDT", "MATICUSDT"]

    // Determine which symbols to process
    let symbolsToProcess = symbols

    if (isInitialSetup) {
      // For initial setup, only process popular symbols first
      symbolsToProcess = symbols.filter((s) => popularSymbols.includes(s.symbol))
      console.log(`Initial setup: Processing ${symbolsToProcess.length} popular symbols first`)
    }

    // Get current time for data fetching
    const currentTime = new Date().getTime()

    // Process symbols in smaller batches with longer delays to avoid rate limiting
    const batchSize = 1 // Snížím velikost dávky na 1 pro maximální spolehlivost
    const batches = Math.ceil(symbolsToProcess.length / batchSize)

    for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
      const batchStart = batchIndex * batchSize
      const batchEnd = Math.min(batchStart + batchSize, symbolsToProcess.length)
      const batchSymbols = symbolsToProcess.slice(batchStart, batchEnd)

      console.log(
        `Processing batch ${batchIndex + 1}/${batches} (${batchStart + 1}-${batchEnd} of ${symbolsToProcess.length})`,
      )

      // Process symbols in this batch sequentially to avoid rate limiting
      for (const symbol of batchSymbols) {
        try {
          console.log(`Checking data for ${symbol.symbol}`)

          // Get the last timestamp for this symbol
          let lastTimestamp
          try {
            const result = await executeQuery(
              `SELECT MAX(timestamp) as last_timestamp FROM daily_candles WHERE symbol = $1`,
              [symbol.symbol],
            )

            if (result && result.length > 0 && result[0].last_timestamp) {
              lastTimestamp = Number(result[0].last_timestamp)
            } else {
              lastTimestamp = null
            }
          } catch (error) {
            console.error(`Error getting last timestamp for ${symbol.symbol}:`, error)
            lastTimestamp = null

            // Pokud dojde k chybě rate limitingu, počkáme delší dobu
            if (error instanceof Error && error.message.includes("Rate limit")) {
              console.log("Rate limit detected, waiting 15 seconds before continuing...")
              await new Promise((resolve) => setTimeout(resolve, 15000))
            }
          }

          if (isInitialSetup || lastTimestamp === null) {
            // For initial setup or if no data exists, fetch historical data (last 2 years)
            const startTime = new Date()
            startTime.setFullYear(startTime.getFullYear() - 2)
            const startTimestamp = startTime.getTime()

            console.log(`Fetching historical data for ${symbol.symbol} since ${startTime.toISOString()}`)

            // Změna: Použití správného endpointu pro získání svíček
            const klinesUrl = `https://data-api.binance.vision/api/v3/klines?symbol=${symbol.symbol}&interval=1d&startTime=${startTimestamp}&limit=500`

            try {
              const data = await fetchWithRetry(klinesUrl, {}, 5, 2000)

              // Transform the data
              const dailyCandles = data.map((kline: any[]) => ({
                timestamp: kline[0], // Open time
                open: kline[1],
                high: kline[2],
                low: kline[3],
                close: kline[4],
                volume: kline[5],
                closeTime: kline[6],
              }))

              // Store daily candles in database - zpracovávám v menších dávkách
              const candleBatchSize = 20 // Snížím velikost dávky na 20
              for (let i = 0; i < dailyCandles.length; i += candleBatchSize) {
                const candleBatch = dailyCandles.slice(i, i + candleBatchSize)

                try {
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

                      // Pokud dojde k chybě rate limitingu, počkáme delší dobu
                      if (candleError instanceof Error && candleError.message.includes("Rate limit")) {
                        console.log("Rate limit detected, waiting 15 seconds before continuing...")
                        await new Promise((resolve) => setTimeout(resolve, 15000))
                      }
                    }

                    // Krátká pauza mezi jednotlivými svíčkami
                    await new Promise((resolve) => setTimeout(resolve, 100))
                  }
                } catch (batchError) {
                  console.error(`Error storing candle batch for ${symbol.symbol}:`, batchError)

                  // Pokud dojde k chybě rate limitingu, počkáme delší dobu
                  if (batchError instanceof Error && batchError.message.includes("Rate limit")) {
                    console.log("Rate limit detected, waiting 15 seconds before continuing...")
                    await new Promise((resolve) => setTimeout(resolve, 15000))
                  }
                }

                // Krátká pauza mezi dávkami svíček
                await new Promise((resolve) => setTimeout(resolve, 1000))
              }

              // Update monthly candles
              try {
                await processMonthlyCandles(symbol.symbol)
              } catch (error) {
                console.error(`Error processing monthly candles for ${symbol.symbol}:`, error)

                // Pokud dojde k chybě rate limitingu, počkáme delší dobu
                if (error instanceof Error && error.message.includes("Rate limit")) {
                  console.log("Rate limit detected, waiting 15 seconds before continuing...")
                  await new Promise((resolve) => setTimeout(resolve, 15000))
                }
              }

              successCount++
            } catch (fetchError) {
              console.error(`Error fetching data for ${symbol.symbol}:`, fetchError)
              errorCount++
            }
          } else {
            // Check if the last data is recent (within the last 2 days)
            const twoDaysAgo = currentTime - 2 * 24 * 60 * 60 * 1000

            if (lastTimestamp >= twoDaysAgo) {
              console.log(
                `Data for ${symbol.symbol} is up to date (last update: ${new Date(lastTimestamp).toISOString()})`,
              )
              skippedCount++
              continue
            }

            // Check for gaps in the data
            const twoYearsAgo = new Date()
            twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)
            const twoYearsAgoTimestamp = twoYearsAgo.getTime()

            // Only look for gaps in the last 2 years
            const startTimestamp = Math.max(twoYearsAgoTimestamp, lastTimestamp)

            let gaps = []
            try {
              gaps = await findDataGaps(symbol.symbol, startTimestamp, currentTime)
            } catch (error) {
              console.error(`Error finding data gaps for ${symbol.symbol}:`, error)

              // Pokud dojde k chybě rate limitingu, počkáme delší dobu
              if (error instanceof Error && error.message.includes("Rate limit")) {
                console.log("Rate limit detected, waiting 15 seconds before continuing...")
                await new Promise((resolve) => setTimeout(resolve, 15000))
              }

              // Pokračujeme s prázdným seznamem mezer
              gaps = []
            }

            if (gaps.length === 0) {
              // No gaps, just fetch the latest data
              console.log(`Fetching latest data for ${symbol.symbol} since ${new Date(lastTimestamp).toISOString()}`)

              // Změna: Použití správného endpointu pro získání svíček
              const klinesUrl = `https://data-api.binance.vision/api/v3/klines?symbol=${symbol.symbol}&interval=1d&startTime=${lastTimestamp + 1}&limit=10`

              try {
                const data = await fetchWithRetry(klinesUrl, {}, 5, 2000)

                // Transform the data
                const dailyCandles = data.map((kline: any[]) => ({
                  timestamp: kline[0], // Open time
                  open: kline[1],
                  high: kline[2],
                  low: kline[3],
                  close: kline[4],
                  volume: kline[5],
                  closeTime: kline[6],
                }))

                // Store daily candles in database
                for (const candle of dailyCandles) {
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
                  } catch (error) {
                    console.error(`Error storing candle for ${symbol.symbol}:`, error)

                    // Pokud dojde k chybě rate limitingu, počkáme delší dobu
                    if (error instanceof Error && error.message.includes("Rate limit")) {
                      console.log("Rate limit detected, waiting 15 seconds before continuing...")
                      await new Promise((resolve) => setTimeout(resolve, 15000))
                    }
                  }

                  // Krátká pauza mezi jednotlivými svíčkami
                  await new Promise((resolve) => setTimeout(resolve, 100))
                }

                // Update monthly candles
                try {
                  await processMonthlyCandles(symbol.symbol)
                } catch (error) {
                  console.error(`Error processing monthly candles for ${symbol.symbol}:`, error)

                  // Pokud dojde k chybě rate limitingu, počkáme delší dobu
                  if (error instanceof Error && error.message.includes("Rate limit")) {
                    console.log("Rate limit detected, waiting 15 seconds before continuing...")
                    await new Promise((resolve) => setTimeout(resolve, 15000))
                  }
                }

                successCount++
              } catch (fetchError) {
                console.error(`Error fetching latest data for ${symbol.symbol}:`, fetchError)
                errorCount++
              }
            } else {
              // Fill in the gaps
              console.log(`Found ${gaps.length} gaps in data for ${symbol.symbol}`)

              for (const gap of gaps) {
                console.log(
                  `Filling gap from ${new Date(gap.start).toISOString()} to ${new Date(gap.end).toISOString()}`,
                )

                // Změna: Použití správného endpointu pro získání svíček
                const klinesUrl = `https://data-api.binance.vision/api/v3/klines?symbol=${symbol.symbol}&interval=1d&startTime=${gap.start}&endTime=${gap.end}&limit=1000`

                try {
                  const data = await fetchWithRetry(klinesUrl, {}, 5, 2000)

                  // Transform the data
                  const dailyCandles = data.map((kline: any[]) => ({
                    timestamp: kline[0], // Open time
                    open: kline[1],
                    high: kline[2],
                    low: kline[3],
                    close: kline[4],
                    volume: kline[5],
                    closeTime: kline[6],
                  }))

                  // Store daily candles in database - zpracovávám v menších dávkách
                  const candleBatchSize = 20 // Snížím velikost dávky na 20
                  for (let i = 0; i < dailyCandles.length; i += candleBatchSize) {
                    const candleBatch = dailyCandles.slice(i, i + candleBatchSize)

                    try {
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

                          // Pokud dojde k chybě rate limitingu, počkáme delší dobu
                          if (candleError instanceof Error && candleError.message.includes("Rate limit")) {
                            console.log("Rate limit detected, waiting 15 seconds before continuing...")
                            await new Promise((resolve) => setTimeout(resolve, 15000))
                          }
                        }

                        // Krátká pauza mezi jednotlivými svíčkami
                        await new Promise((resolve) => setTimeout(resolve, 100))
                      }
                    } catch (batchError) {
                      console.error(`Error storing candle batch for ${symbol.symbol}:`, batchError)

                      // Pokud dojde k chybě rate limitingu, počkáme delší dobu
                      if (batchError instanceof Error && batchError.message.includes("Rate limit")) {
                        console.log("Rate limit detected, waiting 15 seconds before continuing...")
                        await new Promise((resolve) => setTimeout(resolve, 15000))
                      }
                    }

                    // Krátká pauza mezi dávkami svíček
                    await new Promise((resolve) => setTimeout(resolve, 1000))
                  }
                } catch (fetchError) {
                  console.error(`Error filling gap for ${symbol.symbol}:`, fetchError)
                  errorCount++
                }
              }

              // Update monthly candles after filling all gaps
              try {
                await processMonthlyCandles(symbol.symbol)
              } catch (error) {
                console.error(`Error processing monthly candles for ${symbol.symbol}:`, error)

                // Pokud dojde k chybě rate limitingu, počkáme delší dobu
                if (error instanceof Error && error.message.includes("Rate limit")) {
                  console.log("Rate limit detected, waiting 15 seconds before continuing...")
                  await new Promise((resolve) => setTimeout(resolve, 15000))
                }
              }

              successCount++
            }
          }
        } catch (error) {
          console.error(`Error processing ${symbol.symbol}:`, error)
          errorCount++
        }

        // Add a longer delay between symbols to avoid rate limiting
        console.log(`Waiting 8 seconds before processing next symbol...`) // Zvýšil jsem čekání na 8 sekund
        await new Promise((resolve) => setTimeout(resolve, 8000))
      }

      // Add a longer delay between batches to avoid rate limiting
      if (batchIndex < batches - 1) {
        console.log(`Waiting 15 seconds before processing next batch...`) // Zvýšil jsem čekání na 15 sekund
        await new Promise((resolve) => setTimeout(resolve, 15000))
      }
    }

    return NextResponse.json({
      success: true,
      message: `Data update completed. Updated ${successCount} symbols successfully. ${errorCount} symbols failed. ${skippedCount} symbols skipped (already up to date).`,
      initialSetup: isInitialSetup,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error in data update process:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Data update failed. The Binance API may be rate limiting requests.",
      },
      { status: 500 },
    )
  }
}
