"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { AlertCircle, RefreshCw, Database, Info } from "lucide-react"
import { ProcessingStatus } from "@/components/processing-status"
import { processSeasonalityData } from "@/lib/data-processing"
// Remove the DbConfig import that's causing issues
// import { DbConfig } from "@/components/db-config"

export default function Home() {
  const [symbols, setSymbols] = useState<string[]>([])
  const [selectedSymbol, setSelectedSymbol] = useState<string>("")
  const [monthlyData, setMonthlyData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState("barchart")
  const [refreshing, setRefreshing] = useState(false)
  const [isInitialSetup, setIsInitialSetup] = useState(false)
  const [rateLimited, setRateLimited] = useState(false)
  const [debugInfo, setDebugInfo] = useState<string | null>(null)
  const [needsDbInit, setNeedsDbInit] = useState(false)
  const [invalidDbUrl, setInvalidDbUrl] = useState(false)

  // Fetch symbols and load initial data
  useEffect(() => {
    async function initData() {
      try {
        setLoading(true)
        setError(null)
        setRateLimited(false)
        setDebugInfo(null)
        setNeedsDbInit(false)
        setInvalidDbUrl(false)

        // Get available symbols from database
        console.log("Fetching symbols from API...")

        try {
          const symbolsResponse = await fetch("/api/symbols")

          // Log response status for debugging
          console.log(`Symbols API response status: ${symbolsResponse.status}`)

          // Parse the response
          const data = await symbolsResponse.json()
          console.log("Symbols API response:", data)

          // Check for invalid database URL
          if (data.invalidDbUrl) {
            console.log("Invalid database URL detected")
            setInvalidDbUrl(true)
            return
          }

          // Handle 404 (no table) specifically
          if (symbolsResponse.status === 404) {
            console.log("404 response data:", data)

            if (data.needsInit) {
              setNeedsDbInit(true)
              setIsInitialSetup(true)
              setError("Database tables need to be initialized")
              return
            }

            // Regular 404 - no symbols in database yet
            setIsInitialSetup(true)
            return
          }

          // Handle other non-200 responses
          if (!symbolsResponse.ok) {
            throw new Error(`Symbols API error: ${symbolsResponse.status} - ${data.error || "Unknown error"}`)
          }

          // Check for error info in the response even if status was 200
          if (data.error) {
            console.warn("Error info in symbols response:", data.error)
            setDebugInfo(data.details || data.error)

            if (data.needsInit) {
              setNeedsDbInit(true)
              setIsInitialSetup(true)
              setError(data.error)
              return
            }
          }

          const availableSymbols = data.symbols || []

          if (availableSymbols.length === 0) {
            console.log("No symbols found, showing initial setup UI")
            setIsInitialSetup(true)
            return
          }

          setSymbols(availableSymbols)
          setIsInitialSetup(false)

          // Load data for default symbol
          const defaultSymbol = availableSymbols.includes("BTCUSDT") ? "BTCUSDT" : availableSymbols[0]
          setSelectedSymbol(defaultSymbol)
          await loadData(defaultSymbol)
        } catch (fetchError) {
          console.error("Error fetching symbols:", fetchError)

          // Try to determine if this is a database initialization issue
          const errorMsg = fetchError instanceof Error ? fetchError.message : String(fetchError)

          if (errorMsg.includes("table") && (errorMsg.includes("not exist") || errorMsg.includes("doesn't exist"))) {
            setNeedsDbInit(true)
            setIsInitialSetup(true)
            setError("Database tables need to be initialized")
          } else {
            setError(`Failed to load symbols: ${errorMsg}`)
          }

          // Check if the error might be related to rate limiting
          if (
            errorMsg.includes("rate limit") ||
            errorMsg.includes("Too Many") ||
            errorMsg.includes("429") ||
            errorMsg.includes("Internal s")
          ) {
            setRateLimited(true)
          }
        }
      } catch (err: any) {
        console.error("Error initializing data:", err)
        setError(err.message || "Failed to load initial data")

        // Check if the error might be related to rate limiting
        if (
          err.message &&
          (err.message.includes("rate limit") ||
            err.message.includes("Too Many") ||
            err.message.includes("429") ||
            err.message.includes("Internal s"))
        ) {
          setRateLimited(true)
        }
      } finally {
        setLoading(false)
      }
    }

    initData()
  }, [])

  // Load data for a symbol
  const loadData = async (symbol: string) => {
    if (!symbol) return

    try {
      setLoading(true)
      setError(null)
      setRateLimited(false)
      setDebugInfo(null)

      // Fetch historical data from database
      console.log(`Fetching historical data for ${symbol}...`)
      const response = await fetch(`/api/historical?symbol=${symbol}`)

      // Log response status for debugging
      console.log(`Historical API response status: ${response.status}`)

      if (!response.ok) {
        // Try to get more detailed error information
        let errorMessage = `Historical API error: ${response.status}`
        try {
          const errorData = await response.json()
          if (errorData && errorData.error) {
            errorMessage = `Historical API error: ${errorData.error}`
            setDebugInfo(errorData.details || null)

            // Check if this is a database initialization issue
            if (
              errorData.error.includes("table") &&
              (errorData.error.includes("not exist") || errorData.error.includes("doesn't exist"))
            ) {
              setNeedsDbInit(true)
              setIsInitialSetup(true)
            }
          }
        } catch (e) {
          try {
            const errorText = await response.text()
            errorMessage += ` - ${errorText.substring(0, 200)}`
            setDebugInfo(errorText)
          } catch (e2) {
            // If we can't get the text, just use the status
          }
        }
        throw new Error(errorMessage)
      }

      const data = await response.json()
      console.log(`Historical data received for ${symbol}:`, data)

      if (data.monthly && Array.isArray(data.monthly) && data.monthly.length > 0) {
        setMonthlyData(data.monthly)
      } else {
        throw new Error("No historical data available for this symbol")
      }
    } catch (err: any) {
      console.error(`Error loading data for ${symbol}:`, err)
      setError(err.message || `Failed to load data for ${symbol}`)
      setMonthlyData([])

      // Check if the error might be related to rate limiting or server issues
      if (
        err.message &&
        (err.message.includes("rate limit") ||
          err.message.includes("Too Many") ||
          err.message.includes("429") ||
          err.message.includes("Internal s"))
      ) {
        setRateLimited(true)
      }
    } finally {
      setLoading(false)
    }
  }

  // Handle symbol selection change
  const handleSymbolChange = (value: string) => {
    setSelectedSymbol(value)
    loadData(value)
  }

  // Handle refresh button click - now triggers the cron job
  const handleRefresh = async () => {
    try {
      setRefreshing(true)
      setError(null)
      setRateLimited(false)
      setDebugInfo(null)

      // Call the cron job endpoint to update data
      console.log("Calling cron job to update data...")
      const response = await fetch("/api/cron")

      // Log response status for debugging
      console.log(`Cron API response status: ${response.status}`)

      if (!response.ok) {
        // Try to get more detailed error information
        let errorMessage = `Cron API error: ${response.status}`
        try {
          const errorData = await response.json()
          if (errorData && errorData.error) {
            errorMessage = `Cron API error: ${errorData.error}`
            setDebugInfo(errorData.details || null)
          }
        } catch (e) {
          try {
            const errorText = await response.text()
            errorMessage += ` - ${errorText.substring(0, 200)}`
            setDebugInfo(errorText)
          } catch (e2) {
            // If we can't get the text, just use the status
          }
        }
        throw new Error(errorMessage)
      }

      const result = await response.json()
      console.log("Cron job result:", result)

      // Reload the page to refresh everything
      window.location.reload()
    } catch (err: any) {
      console.error("Error refreshing data:", err)
      setError(err.message || "Failed to update data")

      // Check if the error might be related to rate limiting or server issues
      if (
        err.message &&
        (err.message.includes("rate limit") ||
          err.message.includes("Rate limit") ||
          err.message.includes("Too Many") ||
          err.message.includes("429") ||
          err.message.includes("Internal s"))
      ) {
        setRateLimited(true)
      }
    } finally {
      setRefreshing(false)
    }
  }

  // Handle database initialization
  const handleInitDb = async () => {
    try {
      setRefreshing(true)
      setError(null)
      setDebugInfo(null)

      // Call the init-db endpoint
      console.log("Initializing database...")
      const response = await fetch("/api/init-db")

      // Log response status for debugging
      console.log(`Init DB API response status: ${response.status}`)

      if (!response.ok) {
        // Try to get more detailed error information
        let errorMessage = `Database initialization error: ${response.status}`
        try {
          const errorData = await response.json()
          if (errorData && errorData.error) {
            errorMessage = `Database initialization error: ${errorData.error}`
            setDebugInfo(errorData.details || null)
          }
        } catch (e) {
          try {
            const errorText = await response.text()
            errorMessage += ` - ${errorText.substring(0, 200)}`
            setDebugInfo(errorText)
          } catch (e2) {
            // If we can't get the text, just use the status
          }
        }
        throw new Error(errorMessage)
      }

      const result = await response.json()
      console.log("Database initialization result:", result)

      // After successful initialization, run the cron job
      await handleRefresh()
    } catch (err: any) {
      console.error("Error initializing database:", err)
      setError(err.message || "Failed to initialize database")
    } finally {
      setRefreshing(false)
    }
  }

  // Handle database configuration
  const handleDbConfigured = () => {
    window.location.reload()
  }

  // Process data for visualization
  const { monthlyReturns, heatmapData, years } = processSeasonalityData(monthlyData)

  // Render database configuration UI
  if (invalidDbUrl) {
    return (
      <main className="container mx-auto py-8 px-4">
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-2xl">Crypto Seasonality Charts</CardTitle>
            <CardDescription>Visualize monthly performance patterns for Binance trading pairs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-4 mb-6">
              <AlertCircle className="h-16 w-16 mx-auto mb-4 text-amber-500" />
              <h2 className="text-xl font-semibold mb-2">Database Configuration Required</h2>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                The application detected an invalid database URL. Please check your environment variables and make sure
                DATABASE_URL is properly set in your Vercel project settings.
              </p>

              <Alert className="mb-6 max-w-md mx-auto">
                <Info className="h-4 w-4" />
                <AlertTitle>Configuration Instructions</AlertTitle>
                <AlertDescription>
                  Go to your Vercel project settings, navigate to the Environment Variables section, and add your Neon
                  PostgreSQL connection string as DATABASE_URL.
                </AlertDescription>
              </Alert>

              <Button onClick={() => window.location.reload()} className="flex items-center gap-2 mx-auto">
                <RefreshCw className="h-4 w-4" />
                Reload Application
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    )
  }

  // Render initial setup UI
  if (isInitialSetup) {
    return (
      <main className="container mx-auto py-8 px-4">
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-2xl">Crypto Seasonality Charts</CardTitle>
            <CardDescription>Visualize monthly performance patterns for Binance trading pairs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <Database className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-semibold mb-2">
                {needsDbInit ? "Database Needs Initialization" : "Database is Empty"}
              </h2>
              <p className="text-muted-foreground mb-6">
                {needsDbInit
                  ? "The database tables don't exist yet. Click the button below to initialize the database structure."
                  : "No cryptocurrency data found in the database. You need to run the data update process to fetch data from Binance."}
              </p>

              {rateLimited && (
                <Alert variant="warning" className="mb-6 max-w-md mx-auto">
                  <Info className="h-4 w-4" />
                  <AlertTitle>Rate Limiting Warning</AlertTitle>
                  <AlertDescription>
                    Binance API may be rate limiting requests. The initial setup will fetch only the most popular
                    symbols and may take longer than expected. Please be patient.
                  </AlertDescription>
                </Alert>
              )}

              {error && (
                <Alert variant="destructive" className="mb-6 max-w-md mx-auto">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {debugInfo && (
                <div className="mb-6 max-w-md mx-auto overflow-auto text-left bg-gray-100 p-4 rounded text-xs">
                  <p className="font-semibold mb-2">Debug Information:</p>
                  <pre>{debugInfo}</pre>
                </div>
              )}

              {needsDbInit ? (
                <Button
                  size="lg"
                  onClick={handleInitDb}
                  disabled={refreshing}
                  className="flex items-center gap-2 mx-auto"
                >
                  <Database className={`h-5 w-5 ${refreshing ? "animate-pulse" : ""}`} />
                  {refreshing ? "Initializing Database..." : "Initialize Database"}
                </Button>
              ) : (
                <Button
                  size="lg"
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="flex items-center gap-2 mx-auto"
                >
                  <RefreshCw className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`} />
                  {refreshing ? "Fetching Data..." : "Fetch Cryptocurrency Data"}
                </Button>
              )}

              {refreshing && (
                <p className="mt-4 text-sm text-muted-foreground">
                  This process may take several minutes due to API rate limits. Please be patient...
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Přidáme komponentu pro zobrazení stavu zpracování dat */}
        <ProcessingStatus />
      </main>
    )
  }

  return (
    <main className="container mx-auto py-8 px-4">
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-2xl">Crypto Seasonality Charts</CardTitle>
          <CardDescription>Visualize monthly performance patterns for Binance trading pairs</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {debugInfo && (
            <div className="mb-6 overflow-auto bg-gray-100 p-4 rounded text-xs">
              <p className="font-semibold mb-2">Debug Information:</p>
              <pre>{debugInfo}</pre>
            </div>
          )}

          {rateLimited && (
            <Alert variant="warning" className="mb-6">
              <Info className="h-4 w-4" />
              <AlertTitle>Server Issue Warning</AlertTitle>
              <AlertDescription>
                The server is experiencing issues or rate limiting. Some operations may fail or take longer than
                expected. Please try again later.
              </AlertDescription>
            </Alert>
          )}

          <div className="text-center py-8">
            <Button size="lg" onClick={handleRefresh} disabled={refreshing} className="flex items-center gap-2 mx-auto">
              <RefreshCw className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Updating Data..." : "Update Cryptocurrency Data"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Přidáme komponentu pro zobrazení stavu zpracování dat */}
      <div className="mb-8">
        <ProcessingStatus />
      </div>
    </main>
  )
}
