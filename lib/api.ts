// Simplified API functions with static data
export async function fetchSymbols(): Promise<string[]> {
  // Return static data
  return ["BTCUSDT", "ETHUSDT", "BNBUSDT", "XRPUSDT", "ADAUSDT"]
}

// Fetch historical data for a specific symbol
export async function fetchHistoricalData(symbol: string): Promise<any[]> {
  // Return static mock data
  return generateMockData(symbol)
}

// Generate mock historical data for a symbol
function generateMockData(symbol: string) {
  const klines = []
  const startDate = new Date("2019-01-01").getTime()
  const endDate = new Date().getTime()
  const dayMs = 1000 * 60 * 60 * 24

  // Generate mock data points with a slightly random walk
  let currentPrice = symbol.includes("BTC") ? 10000 : symbol.includes("ETH") ? 300 : symbol.includes("BNB") ? 20 : 1

  for (let timestamp = startDate; timestamp < endDate; timestamp += dayMs) {
    // Create a random walk with some bias based on the symbol
    const dailyChange = (Math.random() - 0.48) * (currentPrice * 0.05)
    currentPrice += dailyChange

    // Ensure price doesn't go negative
    currentPrice = Math.max(0.001, currentPrice)

    klines.push({
      timestamp,
      open: currentPrice * (1 - Math.random() * 0.01),
      high: currentPrice * (1 + Math.random() * 0.02),
      low: currentPrice * (1 - Math.random() * 0.02),
      close: currentPrice,
      volume: Math.random() * 1000000,
      closeTime: timestamp + dayMs - 1,
    })
  }

  return klines
}
