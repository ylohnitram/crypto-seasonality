import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function NotFound() {
  return (
    <div className="container flex items-center justify-center min-h-screen py-8 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">404 - Stránka nenalezena</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center">
          <p className="text-center text-muted-foreground mb-6">
            Požadovaná stránka nebyla nalezena. Je možné, že byla přesunuta nebo odstraněna.
          </p>
          <Link href="/" passHref>
            <Button>Zpět na hlavní stránku</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
