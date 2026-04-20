"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { AlertCircle, Building2, Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { isFirebaseConfigured } from "@/lib/firebase"

export default function LoginPage() {
  const router = useRouter()
  const { signIn, loading, error } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const firebaseConfigured = isFirebaseConfigured()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    
    setIsSubmitting(true)
    try {
      await signIn(email, password)
      router.push("/dashboard")
    } catch {
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">

      {/* 🔥 Blurred Background */}
      <div
  className="absolute inset-0 bg-cover bg-center"
  style={{ backgroundImage: "url('/bg.jpg')" }}
/>

      {/* 🔥 Overlay */}
      <div className="absolute inset-0 bg-black/40" />

      {/* 🔥 Content */}
      <div className="relative w-full max-w-md">

        <Card className="shadow-xl backdrop-blur-md bg-white/90 border">
          
          {/* ✅ HEADER (dito na lahat) */}
          <CardHeader className="text-center space-y-3">

            {/* Logo */}
            <div className="flex justify-center">
              <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-primary text-primary-foreground">
                <Building2 className="w-7 h-7" />
              </div>
            </div>

            {/* Title + Subtitle */}
            <div>
              <h1 className="text-xl font-bold">Arsenic Pharmacy</h1>
              <p className="text-xs text-muted-foreground">
                Centralized Inventory & POS System
              </p>
            </div>



          </CardHeader>

          <CardContent className="space-y-4">

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {firebaseConfigured ? (
              <form onSubmit={handleSubmit} className="space-y-4">

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting || loading}
                >
                  {isSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Sign In
                </Button>

              </form>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Firebase is not configured. Add your Firebase environment variables.
                </AlertDescription>
              </Alert>
            )}

          </CardContent>
        </Card>

      </div>
    </main>
  )
}