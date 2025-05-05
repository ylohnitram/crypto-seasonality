"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Clock, Database, AlertTriangle } from "lucide-react"

// Helper function to safely handle response
async function handleResponse(response: Response) {
  // First, clone the response so we can read it multiple times if needed
  const clonedResponse = response.clone()

  if (!response.ok) {
    // Try to get error details from JSON
    try {
      const errorData = await response.json()
      if (errorData && errorData.error) {
        throw new Error(errorData.error)
      }
    } catch (jsonError) {
      // If JSON parsing fails, try to get error as text
      try {
        const errorText = await clonedResponse.text()
        throw new Error(`${response.status}: ${errorText.substring(0, 100)}`)
      } catch (textError) {
        // If all else fails, use status code
        throw new Error(`Request failed with status ${response.status}`)
      }
    }
  }

  // If response is OK, return the JSON
  try {
    return await response.json()
  } catch (error) {
    console.error("Error parsing JSON response:", error)
    const text = await clonedResponse.text()
    throw new Error(`Failed to parse JSON response: ${text.substring(0, 100)}`)
  }
}

interface DataStatusProps {
  symbol: string
}

export function DataStatus({ symbol }: DataStatusProps) {
  const [lastUpdate, setLastUpdate] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchDataStatus() {
      if (!symbol) return

      try {
        setLoading(true)
        setError(null)

        console.log(`Fetching data status for ${symbol}...`)
        const response = await fetch(`/api/data-status?symbol=${symbol}`)
        console.log(`Data status API response status: ${response.status}`)

        if (!response.ok) {
          // Try to get more detailed error information
          let errorMessage = `Data status API error: ${response.status}`
          try {
            const errorText = await response.text()
            errorMessage += ` - ${errorText.substring(0, 200)}`
          } catch (e) {
            // If we can't get the text, just use the status
          }
          throw new Error(errorMessage)
        }

        const data = await response.json()
        console.log(`Data status received for ${symbol}:`, data)

        setLastUpdate(data.lastUpdate)
      } catch (err: any) {
        console.error("Error fetching data status:", err)
        setError(err.message || "Failed to load data status")
      } finally {
        setLoading(false)
      }
    }

    fetchDataStatus()
  }, [symbol])

  if (loading) {
    return (
      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span>Načítání informací o datech...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center space-x-2 text-sm text-red-500">
        <AlertTriangle className="h-4 w-4" />
        <span title={error}>Chyba při načítání informací o datech</span>
      </div>
    )
  }

  if (!lastUpdate) {
    return (
      <div className="flex items-center space-x-2 text-sm text-amber-500">
        <Database className="h-4 w-4" />
        <span>Žádná data nejsou k dispozici</span>
      </div>
    )
  }

  // Calculate how old the data is
  const lastUpdateDate = new Date(lastUpdate)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - lastUpdateDate.getTime()) / (1000 * 60 * 60 * 24))

  let statusColor = "bg-green-500"
  if (diffDays > 7) {
    statusColor = "bg-red-500"
  } else if (diffDays > 2) {
    statusColor = "bg-amber-500"
  }

  return (
    <div className="flex items-center space-x-3 text-sm">
      <div className="flex items-center space-x-2">
        <div className={`h-2 w-2 rounded-full ${statusColor}`} />
        <span>Poslední aktualizace:</span>
      </div>
      <Badge variant="outline" className="font-mono">
        {lastUpdateDate.toLocaleDateString()} {lastUpdateDate.toLocaleTimeString()}
      </Badge>
      <span className="text-muted-foreground">
        ({diffDays === 0 ? "dnes" : diffDays === 1 ? "včera" : `před ${diffDays} dny`})
      </span>
    </div>
  )
}
