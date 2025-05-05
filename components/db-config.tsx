"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Database, CheckCircle } from "lucide-react"

interface DbConfigProps {
  onConfigured: () => void
}

export function DbConfig({ onConfigured }: DbConfigProps) {
  const [dbUrl, setDbUrl] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleTest = async () => {
    if (!dbUrl || !dbUrl.startsWith("postgres")) {
      setError("Please enter a valid Neon database URL (should start with postgres://)")
      return
    }

    try {
      setTesting(true)
      setError(null)
      setSuccess(false)

      // Store the URL in localStorage
      localStorage.setItem("neon_db_url", dbUrl)

      // Test the connection
      const response = await fetch("/api/test-db-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ dbUrl }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to connect to database")
      }

      setSuccess(true)
      setTimeout(() => {
        onConfigured()
      }, 1500)
    } catch (err) {
      console.error("Error testing database connection:", err)
      setError(err instanceof Error ? err.message : "Failed to connect to database")
      setSuccess(false)
    } finally {
      setTesting(false)
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Database Configuration
        </CardTitle>
        <CardDescription>
          Enter your Neon database URL to connect to your database. You can find this in your Neon dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-4 bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <AlertTitle className="text-green-700">Success</AlertTitle>
            <AlertDescription className="text-green-600">
              Database connection successful! Redirecting...
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="db-url" className="text-sm font-medium">
              Neon Database URL
            </label>
            <Input
              id="db-url"
              placeholder="postgres://user:password@host/database"
              value={dbUrl}
              onChange={(e) => setDbUrl(e.target.value)}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Your database URL should look like: postgres://user:password@host/database
            </p>
          </div>

          <Button onClick={handleTest} disabled={testing || success} className="w-full">
            {testing ? "Testing Connection..." : success ? "Connection Successful" : "Test Connection"}
          </Button>

          <div className="text-xs text-muted-foreground">
            <p className="font-medium mb-1">How to get your Neon database URL:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Sign in to your Neon dashboard</li>
              <li>Select your project</li>
              <li>Go to the "Connection Details" tab</li>
              <li>Copy the "Connection string"</li>
            </ol>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
