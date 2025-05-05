"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CustomProgress } from "@/components/ui/custom-progress"
import { Button } from "@/components/ui/button"
import { RefreshCw, Clock, CheckCircle, AlertCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function ProcessingStatus() {
  const [status, setStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  // Formátování času
  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds} sekund`
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minut ${seconds % 60} sekund`
    return `${Math.floor(seconds / 3600)} hodin ${Math.floor((seconds % 3600) / 60)} minut`
  }

  // Načtení stavu zpracování
  const fetchStatus = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch("/api/processing-status")

      if (!response.ok) {
        throw new Error(`Status API error: ${response.status}`)
      }

      const data = await response.json()
      setStatus(data)
    } catch (err) {
      console.error("Error fetching processing status:", err)
      setError(err instanceof Error ? err.message : "Failed to load processing status")
    } finally {
      setLoading(false)
    }
  }

  // Spuštění zpracování dat
  const handleStartProcessing = async () => {
    try {
      setRefreshing(true)
      setError(null)

      const response = await fetch("/api/cron")

      if (!response.ok) {
        throw new Error(`Cron API error: ${response.status}`)
      }

      await fetchStatus()
    } catch (err) {
      console.error("Error starting processing:", err)
      setError(err instanceof Error ? err.message : "Failed to start processing")
    } finally {
      setRefreshing(false)
    }
  }

  // Načtení stavu při prvním renderu
  useEffect(() => {
    fetchStatus()
  }, [])

  // Automatické obnovení stavu každých 10 sekund, pokud probíhá zpracování
  useEffect(() => {
    if (status?.isProcessing) {
      const interval = setInterval(() => {
        fetchStatus()
      }, 10000)

      return () => clearInterval(interval)
    }
  }, [status?.isProcessing])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Stav zpracování dat</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-3">Načítání stavu...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Stav zpracování dat</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Chyba</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={fetchStatus} className="mt-4">
            Zkusit znovu
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!status?.exists) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Stav zpracování dat</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Informace</AlertTitle>
            <AlertDescription>
              Zpracování dat ještě nebylo zahájeno. Klikněte na tlačítko níže pro zahájení stahování dat.
            </AlertDescription>
          </Alert>
          <Button onClick={handleStartProcessing} disabled={refreshing} className="mt-4 flex items-center gap-2">
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Zahajování..." : "Zahájit zpracování dat"}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Stav zpracování dat</span>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchStatus}
            disabled={loading}
            className="flex items-center gap-1"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            <span className="text-xs">Obnovit</span>
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {status.isProcessing ? (
          <Alert className="mb-4 bg-blue-50 border-blue-200">
            <Clock className="h-4 w-4 text-blue-500" />
            <AlertTitle className="text-blue-700">Zpracování probíhá</AlertTitle>
            <AlertDescription className="text-blue-600">
              Zpracování dat je aktivní. Tato operace může trvat delší dobu v závislosti na množství dat.
            </AlertDescription>
          </Alert>
        ) : status.percentComplete === 100 ? (
          <Alert className="mb-4 bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <AlertTitle className="text-green-700">Zpracování dokončeno</AlertTitle>
            <AlertDescription className="text-green-600">
              Všechna data byla úspěšně zpracována.
              {status.lastUpdated && (
                <span className="block mt-1">Poslední aktualizace: před {formatDuration(status.lastUpdated)}</span>
              )}
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Zpracování pozastaveno</AlertTitle>
            <AlertDescription>
              Zpracování dat bylo pozastaveno nebo přerušeno. Klikněte na tlačítko níže pro pokračování.
              {status.lastUpdated && (
                <span className="block mt-1">Poslední aktualizace: před {formatDuration(status.lastUpdated)}</span>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-1 text-sm">
              <span>Celkový průběh</span>
              <span>{status?.percentComplete || 0}%</span>
            </div>
            <CustomProgress value={status?.percentComplete || 0} className="h-2" />
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Zpracováno symbolů</p>
              <p className="font-medium">
                {status.lastProcessedIndex + 1} z {status.totalSymbols}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Zbývá symbolů</p>
              <p className="font-medium">{status.remainingSymbols}</p>
            </div>
            {status.duration && (
              <div>
                <p className="text-muted-foreground">Doba zpracování</p>
                <p className="font-medium">{formatDuration(status.duration)}</p>
              </div>
            )}
            {status.lastProcessedSymbol && (
              <div>
                <p className="text-muted-foreground">Poslední symbol</p>
                <p className="font-medium">{status.lastProcessedSymbol}</p>
              </div>
            )}
          </div>

          {!status.isProcessing && (
            <Button
              onClick={handleStartProcessing}
              disabled={refreshing}
              className="w-full mt-2 flex items-center justify-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing
                ? "Zahajování..."
                : status.percentComplete > 0
                  ? "Pokračovat ve zpracování"
                  : "Zahájit zpracování"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
