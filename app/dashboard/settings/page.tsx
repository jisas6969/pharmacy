"use client"

import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { useData } from "@/contexts/data-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Building2,
  Settings,
  Store,
  Phone,
  MapPin,
  Info,
  Database,
  Shield,
  Bell,
} from "lucide-react"
import { isFirebaseConfigured } from "@/lib/firebase"

export default function SettingsPage() {
  const router = useRouter()
  const { user, isDemo } = useAuth()
  const { branches } = useData()
  
  const isAdmin = user?.role === "admin"
  const firebaseConfigured = isFirebaseConfigured()

  // Redirect non-admin users
  if (!isAdmin) {
    router.push("/dashboard")
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm">
          Configure your pharmacy system
        </p>
      </div>

      {/* Demo Mode Notice */}
      {isDemo && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Demo Mode</AlertTitle>
          <AlertDescription>
            Settings are view-only in demo mode. Connect Firebase to enable configuration changes.
          </AlertDescription>
        </Alert>
      )}

      {/* Firebase Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Database Connection
          </CardTitle>
          <CardDescription>
            Firebase Firestore connection status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="font-medium">Firebase Status</p>
              <p className="text-sm text-muted-foreground">
                {firebaseConfigured
                  ? "Connected to Firebase Firestore"
                  : "Not configured - using demo mode"}
              </p>
            </div>
            <Badge variant={firebaseConfigured ? "default" : "secondary"}>
              {firebaseConfigured ? "Connected" : "Demo Mode"}
            </Badge>
          </div>
          
          {!firebaseConfigured && (
            <div className="mt-4 p-4 rounded-lg bg-muted space-y-3">
              <p className="text-sm font-medium">Required Environment Variables:</p>
              <div className="grid gap-2 text-xs font-mono">
                <code className="p-2 bg-background rounded">NEXT_PUBLIC_FIREBASE_API_KEY</code>
                <code className="p-2 bg-background rounded">NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN</code>
                <code className="p-2 bg-background rounded">NEXT_PUBLIC_FIREBASE_PROJECT_ID</code>
                <code className="p-2 bg-background rounded">NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET</code>
                <code className="p-2 bg-background rounded">NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID</code>
                <code className="p-2 bg-background rounded">NEXT_PUBLIC_FIREBASE_APP_ID</code>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Company Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Company Information
          </CardTitle>
          <CardDescription>
            Your pharmacy chain details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input value="Arsenic Pharmacy" disabled={isDemo} readOnly />
            </div>
            <div className="space-y-2">
              <Label>Tax Rate</Label>
              <Input value="5%" disabled={isDemo} readOnly />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Business Registration</Label>
            <Input value="BRN-2024-001234" disabled={isDemo} readOnly />
          </div>
        </CardContent>
      </Card>

      {/* Branches */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            Branch Locations
          </CardTitle>
          <CardDescription>
            Manage your {branches.length} pharmacy branches
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Branch Name</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branches.map((branch) => (
                  <TableRow key={branch.id}>
                    <TableCell className="font-medium">
                      {branch.name.replace("Arsenic Pharmacy - ", "")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {branch.address}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {branch.phone}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={branch.isActive ? "default" : "secondary"}>
                        {branch.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Settings
          </CardTitle>
          <CardDescription>
            Configure alerts and notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Low Stock Alerts</Label>
              <p className="text-sm text-muted-foreground">
                Notify when inventory falls below critical level
              </p>
            </div>
            <Switch checked disabled={isDemo} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Expiry Alerts</Label>
              <p className="text-sm text-muted-foreground">
                Notify when products are expiring within 30 days
              </p>
            </div>
            <Switch checked disabled={isDemo} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Daily Sales Summary</Label>
              <p className="text-sm text-muted-foreground">
                Send daily sales report via email
              </p>
            </div>
            <Switch disabled={isDemo} />
          </div>
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Settings
          </CardTitle>
          <CardDescription>
            Configure security and access controls
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Two-Factor Authentication</Label>
              <p className="text-sm text-muted-foreground">
                Require 2FA for admin accounts
              </p>
            </div>
            <Switch disabled={isDemo} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Session Timeout</Label>
              <p className="text-sm text-muted-foreground">
                Auto logout after inactivity
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value="30"
                className="w-20"
                disabled={isDemo}
              />
              <span className="text-sm text-muted-foreground">minutes</span>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Audit Logging</Label>
              <p className="text-sm text-muted-foreground">
                Track all user actions in the system
              </p>
            </div>
            <Switch checked disabled={isDemo} />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button disabled={isDemo}>Save Settings</Button>
      </div>
    </div>
  )
}
