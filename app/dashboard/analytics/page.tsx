"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { useData } from "@/contexts/data-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts"
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Package,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
} from "lucide-react"
import {
  format,
  subDays,
  startOfDay,
  endOfDay,
  isSameDay,
  isWithinInterval,
} from "date-fns"
import { cn } from "@/lib/utils"

type DateRange = "7d" | "30d" | "90d"

export default function AnalyticsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { sales, branches, products, inventory, currentBranchId } = useData()
  
  const [dateRange, setDateRange] = useState<DateRange>("30d")
  
  const isAdmin = user?.role === "admin"

  const branchName = branches.find((b) => b.id === currentBranchId)?.name?.replace("Arsenic Pharmacy - ", "")

  // Date range calculations
  const dateRangeConfig = useMemo(() => {
    const now = new Date()
    const daysMap = { "7d": 7, "30d": 30, "90d": 90 }
    const days = daysMap[dateRange]
    
    return {
      startDate: startOfDay(subDays(now, days - 1)),
      endDate: endOfDay(now),
      days,
      label: dateRange === "7d" ? "Last 7 Days" : dateRange === "30d" ? "Last 30 Days" : "Last 90 Days",
    }
  }, [dateRange])

  // Filter sales by date range (already branch-scoped from context)
  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      return isWithinInterval(sale.createdAt, {
        start: dateRangeConfig.startDate,
        end: dateRangeConfig.endDate,
      })
    })
  }, [sales, dateRangeConfig])

  // Previous period for comparison
  const previousPeriodSales = useMemo(() => {
    const prevStart = subDays(dateRangeConfig.startDate, dateRangeConfig.days)
    const prevEnd = subDays(dateRangeConfig.startDate, 1)
    
    return sales.filter((sale) => {
      return isWithinInterval(sale.createdAt, {
        start: prevStart,
        end: prevEnd,
      })
    })
  }, [sales, dateRangeConfig])

  // KPIs
  const kpis = useMemo(() => {
    const totalRevenue = filteredSales.reduce((sum, sale) => sum + sale.total, 0)
    const prevRevenue = previousPeriodSales.reduce((sum, sale) => sum + sale.total, 0)
    const revenueChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0
    
    const totalTransactions = filteredSales.length
    const prevTransactions = previousPeriodSales.length
    const transactionsChange = prevTransactions > 0
      ? ((totalTransactions - prevTransactions) / prevTransactions) * 100
      : 0
    
    const avgTransaction = totalTransactions > 0 ? totalRevenue / totalTransactions : 0
    const prevAvgTransaction = prevTransactions > 0 ? prevRevenue / prevTransactions : 0
    const avgChange = prevAvgTransaction > 0
      ? ((avgTransaction - prevAvgTransaction) / prevAvgTransaction) * 100
      : 0
    
    const itemsSold = filteredSales.reduce(
      (sum, sale) => sum + sale.items.reduce((s, item) => s + item.quantity, 0),
      0
    )
    const prevItemsSold = previousPeriodSales.reduce(
      (sum, sale) => sum + sale.items.reduce((s, item) => s + item.quantity, 0),
      0
    )
    const itemsChange = prevItemsSold > 0 ? ((itemsSold - prevItemsSold) / prevItemsSold) * 100 : 0
    
    return {
      totalRevenue,
      revenueChange,
      totalTransactions,
      transactionsChange,
      avgTransaction,
      avgChange,
      itemsSold,
      itemsChange,
    }
  }, [filteredSales, previousPeriodSales])

  // Daily revenue chart data
  const dailyRevenueData = useMemo(() => {
    const data: { date: string; revenue: number; transactions: number }[] = []
    
    for (let i = 0; i < dateRangeConfig.days; i++) {
      const date = subDays(new Date(), dateRangeConfig.days - 1 - i)
      const dayStart = startOfDay(date)
      
      const daySales = filteredSales.filter((sale) => isSameDay(sale.createdAt, dayStart))
      const revenue = daySales.reduce((sum, sale) => sum + sale.total, 0)
      const transactions = daySales.length
      
      data.push({
        date: format(date, dateRange === "7d" ? "EEE" : "MMM d"),
        revenue: Math.round(revenue * 100) / 100,
        transactions,
      })
    }
    
    return data
  }, [filteredSales, dateRangeConfig.days, dateRange])

  // Top selling products
  const topProducts = useMemo(() => {
    const productSales: Record<string, { name: string; quantity: number; revenue: number }> = {}
    
    filteredSales.forEach((sale) => {
      sale.items.forEach((item) => {
        if (!productSales[item.productId]) {
          productSales[item.productId] = {
            name: item.productName,
            quantity: 0,
            revenue: 0,
          }
        }
        productSales[item.productId].quantity += item.quantity
        productSales[item.productId].revenue += item.total
      })
    })
    
    return Object.entries(productSales)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
  }, [filteredSales])

  // Payment method distribution
  const paymentMethodData = useMemo(() => {
    const methods = { cash: 0, card: 0, mobile: 0 }
    filteredSales.forEach((sale) => {
      methods[sale.paymentMethod] += sale.total
    })
    
    const total = methods.cash + methods.card + methods.mobile
    
    return [
      { name: "Cash", value: methods.cash, percent: total > 0 ? (methods.cash / total) * 100 : 0 },
      { name: "Card", value: methods.card, percent: total > 0 ? (methods.card / total) * 100 : 0 },
      { name: "Mobile", value: methods.mobile, percent: total > 0 ? (methods.mobile / total) * 100 : 0 },
    ]
  }, [filteredSales])

  // Chart colors
  const COLORS = ["#3b82f6", "#60a5fa", "#93c5fd"]
  const primaryColor = "#3b82f6"

  // --- Conditional returns AFTER all hooks ---

  // Redirect non-admin users
  if (!isAdmin) {
    router.push("/dashboard")
    return null
  }

  // Admin must select a branch first
  if (!currentBranchId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertTriangle className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">No Branch Selected</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Select a branch from the sidebar to view its analytics.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            {dateRangeConfig.label} performance for <span className="font-medium">{branchName}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Revenue
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${kpis.totalRevenue.toFixed(2)}</div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              {kpis.revenueChange >= 0 ? (
                <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />
              ) : (
                <ArrowDownRight className="h-3 w-3 text-red-500 mr-1" />
              )}
              <span className={kpis.revenueChange >= 0 ? "text-green-500" : "text-red-500"}>
                {Math.abs(kpis.revenueChange).toFixed(1)}%
              </span>
              <span className="ml-1">vs previous period</span>
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
            <div className="text-2xl font-bold">{kpis.totalTransactions}</div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              {kpis.transactionsChange >= 0 ? (
                <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />
              ) : (
                <ArrowDownRight className="h-3 w-3 text-red-500 mr-1" />
              )}
              <span className={kpis.transactionsChange >= 0 ? "text-green-500" : "text-red-500"}>
                {Math.abs(kpis.transactionsChange).toFixed(1)}%
              </span>
              <span className="ml-1">vs previous period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg. Transaction
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${kpis.avgTransaction.toFixed(2)}</div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              {kpis.avgChange >= 0 ? (
                <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />
              ) : (
                <ArrowDownRight className="h-3 w-3 text-red-500 mr-1" />
              )}
              <span className={kpis.avgChange >= 0 ? "text-green-500" : "text-red-500"}>
                {Math.abs(kpis.avgChange).toFixed(1)}%
              </span>
              <span className="ml-1">vs previous period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Items Sold
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.itemsSold}</div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              {kpis.itemsChange >= 0 ? (
                <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />
              ) : (
                <ArrowDownRight className="h-3 w-3 text-red-500 mr-1" />
              )}
              <span className={kpis.itemsChange >= 0 ? "text-green-500" : "text-red-500"}>
                {Math.abs(kpis.itemsChange).toFixed(1)}%
              </span>
              <span className="ml-1">vs previous period</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Revenue Over Time */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Over Time</CardTitle>
            <CardDescription>Daily revenue for {dateRangeConfig.label.toLowerCase()}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyRevenueData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    interval={dateRange === "90d" ? 6 : dateRange === "30d" ? 4 : 0}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
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
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke={primaryColor}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Transaction Volume */}
        <Card>
          <CardHeader>
            <CardTitle>Transaction Volume</CardTitle>
            <CardDescription>Daily transactions for {dateRangeConfig.label.toLowerCase()}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyRevenueData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    interval={dateRange === "90d" ? 6 : dateRange === "30d" ? 4 : 0}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
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
                  <Bar dataKey="transactions" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Top Products */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Top Selling Products</CardTitle>
            <CardDescription>Best performers by revenue</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">#</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Qty Sold</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topProducts.map((product, index) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium text-muted-foreground">
                        {index + 1}
                      </TableCell>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell className="text-right">{product.quantity}</TableCell>
                      <TableCell className="text-right font-medium">
                        ${product.revenue.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {topProducts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                        No sales data for this period
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Payment Methods */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Methods</CardTitle>
            <CardDescription>Revenue distribution by payment type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentMethodData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {paymentMethodData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number) => [`$${value.toFixed(2)}`, "Revenue"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 mt-4">
              {paymentMethodData.map((method, index) => (
                <div key={method.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[index] }}
                    />
                    <span className="text-sm">{method.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      ${method.value.toFixed(2)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({method.percent.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
