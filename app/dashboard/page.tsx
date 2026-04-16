"use client"

import { useMemo } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useData } from "@/contexts/data-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  DollarSign,
  Package,
  ShoppingCart,
  TrendingUp,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts"
import { format, subDays, startOfDay, isSameDay } from "date-fns"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function DashboardPage() {
  const { user } = useAuth()
  const { sales, inventory, branches, products, currentBranchId } = useData()
  const isAdmin = user?.role === "admin"

  // Filter data based on current branch selection
  const filteredSales = useMemo(() => {
    if (!currentBranchId) return sales
    return sales.filter((sale) => sale.branchId === currentBranchId)
  }, [sales, currentBranchId])

  const filteredInventory = useMemo(() => {
    if (!currentBranchId) return inventory
    return inventory.filter((item) => item.branchId === currentBranchId)
  }, [inventory, currentBranchId])

  // Calculate stats
  const stats = useMemo(() => {
    const today = startOfDay(new Date())
    const yesterday = startOfDay(subDays(new Date(), 1))
    
    const todaySales = filteredSales.filter((sale) =>
      isSameDay(sale.createdAt, today)
    )
    const yesterdaySales = filteredSales.filter((sale) =>
      isSameDay(sale.createdAt, yesterday)
    )
    
    const todayRevenue = todaySales.reduce((sum, sale) => sum + sale.total, 0)
    const yesterdayRevenue = yesterdaySales.reduce((sum, sale) => sum + sale.total, 0)
    
    const revenueChange = yesterdayRevenue > 0
      ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100
      : 0
    
    const lowStockItems = filteredInventory.filter(
      (item) => item.quantity <= item.criticalLevel && item.product
    )
    
    const totalProducts = products.length
    const totalTransactions = todaySales.length
    
    return {
      todayRevenue,
      revenueChange,
      totalTransactions,
      transactionsChange: yesterdaySales.length > 0
        ? ((todaySales.length - yesterdaySales.length) / yesterdaySales.length) * 100
        : 0,
      lowStockCount: lowStockItems.length,
      lowStockItems,
      totalProducts,
    }
  }, [filteredSales, filteredInventory, products])

  // Prepare chart data - last 7 days
  const chartData = useMemo(() => {
    const days = []
    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i)
      const dayStart = startOfDay(date)
      
      const daySales = filteredSales.filter((sale) =>
        isSameDay(sale.createdAt, dayStart)
      )
      
      const revenue = daySales.reduce((sum, sale) => sum + sale.total, 0)
      const transactions = daySales.length
      
      days.push({
        date: format(date, "EEE"),
        revenue: Math.round(revenue * 100) / 100,
        transactions,
      })
    }
    return days
  }, [filteredSales])

  // Branch comparison data for admin
  const branchData = useMemo(() => {
    if (!isAdmin) return []
    
    const today = startOfDay(new Date())
    
    return branches.map((branch) => {
      const branchSales = sales.filter(
        (sale) => sale.branchId === branch.id && isSameDay(sale.createdAt, today)
      )
      const revenue = branchSales.reduce((sum, sale) => sum + sale.total, 0)
      
      return {
        name: branch.name.replace("Arsenic Pharmacy - ", ""),
        revenue: Math.round(revenue * 100) / 100,
      }
    })
  }, [isAdmin, branches, sales])

  // Chart colors (computed from CSS variables in JS)
  const chartColor = "#3b82f6" // Primary blue
  const chartColorSecondary = "#60a5fa"

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-foreground">
          {isAdmin ? "Admin Dashboard" : "Staff Dashboard"}
        </h1>
        <p className="text-muted-foreground">
          {currentBranchId
            ? `Viewing: ${branches.find((b) => b.id === currentBranchId)?.name}`
            : isAdmin
            ? "Overview of all branches"
            : "Your branch overview"}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Today&apos;s Revenue
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${stats.todayRevenue.toFixed(2)}
            </div>
            <div className="flex items-center text-xs text-muted-foreground">
              {stats.revenueChange >= 0 ? (
                <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />
              ) : (
                <ArrowDownRight className="h-3 w-3 text-red-500 mr-1" />
              )}
              <span className={stats.revenueChange >= 0 ? "text-green-500" : "text-red-500"}>
                {Math.abs(stats.revenueChange).toFixed(1)}%
              </span>
              <span className="ml-1">from yesterday</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Transactions
            </CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTransactions}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              {stats.transactionsChange >= 0 ? (
                <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />
              ) : (
                <ArrowDownRight className="h-3 w-3 text-red-500 mr-1" />
              )}
              <span className={stats.transactionsChange >= 0 ? "text-green-500" : "text-red-500"}>
                {Math.abs(stats.transactionsChange).toFixed(1)}%
              </span>
              <span className="ml-1">from yesterday</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Products
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProducts}</div>
            <p className="text-xs text-muted-foreground">
              Active in catalog
            </p>
          </CardContent>
        </Card>

        <Card className={stats.lowStockCount > 0 ? "border-destructive/50" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Low Stock Items
            </CardTitle>
            <AlertTriangle className={`h-4 w-4 ${stats.lowStockCount > 0 ? "text-destructive" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.lowStockCount > 0 ? "text-destructive" : ""}`}>
              {stats.lowStockCount}
            </div>
            <Link href="/dashboard/inventory?filter=low-stock">
              <Button variant="link" className="h-auto p-0 text-xs">
                View items
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Revenue Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Revenue Trend
            </CardTitle>
            <CardDescription>Last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number) => [`$${value.toFixed(2)}`, "Revenue"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke={chartColor}
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Branch Comparison (Admin) or Transactions Chart (Staff) */}
        {isAdmin ? (
          <Card>
            <CardHeader>
              <CardTitle>Branch Performance</CardTitle>
              <CardDescription>Today&apos;s revenue by branch</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={branchData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `$${value}`}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      width={80}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number) => [`$${value.toFixed(2)}`, "Revenue"]}
                    />
                    <Bar dataKey="revenue" fill={chartColor} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Transaction Volume</CardTitle>
              <CardDescription>Last 7 days</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="transactions" fill={chartColorSecondary} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Low Stock Alert Table */}
      {stats.lowStockCount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Low Stock Alerts
            </CardTitle>
            <CardDescription>
              Items that need restocking
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.lowStockItems.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">{item.product.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {branches.find((b) => b.id === item.branchId)?.name.replace("Arsenic Pharmacy - ", "")}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={item.quantity === 0 ? "destructive" : "secondary"}>
                      {item.quantity} left
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Critical: {item.criticalLevel}
                    </span>
                  </div>
                </div>
              ))}
              {stats.lowStockItems.length > 5 && (
                <Link href="/dashboard/inventory?filter=low-stock">
                  <Button variant="ghost" className="w-full">
                    View all {stats.lowStockItems.length} items
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
