"use client"

import { useState, useMemo, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { useData } from "@/contexts/data-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Search,
  Package,
  AlertTriangle,
  Plus,
  Edit2,
  ArrowUpDown,
  Calendar,
  Loader2,
} from "lucide-react"
import { format, differenceInDays } from "date-fns"
import { toast } from "sonner"
import type { InventoryWithProduct, ProductCategory } from "@/lib/types"
import { PRODUCT_CATEGORIES } from "@/lib/types"
import { cn } from "@/lib/utils"

type SortField = "name" | "quantity" | "expiry" | "category"
type SortDirection = "asc" | "desc"
type FilterType = "all" | "low-stock" | "expiring"

export default function InventoryPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const {
    inventory,
    branches,
    products,
    updateInventoryQuantity,
    addInventoryItem,
    fetchInventory,
    currentBranchId,
  } = useData()
  
  // State
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | "all">("all")
  const [filterType, setFilterType] = useState<FilterType>("all")
  const [sortField, setSortField] = useState<SortField>("name")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [editingItem, setEditingItem] = useState<InventoryWithProduct | null>(null)
  const [newQuantity, setNewQuantity] = useState("")
  const [isUpdating, setIsUpdating] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newItem, setNewItem] = useState({
    productId: "",
    quantity: "",
    criticalLevel: "20",
    batchNumber: "",
    expiryDate: "",
  })
  const [isAdding, setIsAdding] = useState(false)
  
  const isAdmin = user?.role === "admin"

  // Handle URL filter params
  useEffect(() => {
    const filter = searchParams.get("filter")
    if (filter === "low-stock") {
      setFilterType("low-stock")
    }
  }, [searchParams])

  // Filter and sort inventory (already branch-scoped from context)
  const filteredInventory = useMemo(() => {
    let items = [...inventory]
    
    // Category filter
    if (selectedCategory !== "all") {
      items = items.filter((item) => item.product?.category === selectedCategory)
    }
    
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      items = items.filter(
        (item) =>
          item.product?.name?.toLowerCase().includes(query) ||
          item.product?.genericName?.toLowerCase().includes(query) ||
          item.product?.sku?.toLowerCase().includes(query) ||
          item.batchNumber?.toLowerCase().includes(query)
      )
    }
    
    // Status filter
    if (filterType === "low-stock") {
      items = items.filter((item) => item.quantity <= item.criticalLevel)
    } else if (filterType === "expiring") {
      items = items.filter((item) => {
        if (!item.expiryDate) return false
        const daysUntilExpiry = differenceInDays(item.expiryDate, new Date())
        return daysUntilExpiry <= 30 && daysUntilExpiry > 0
      })
    }
    
    // Sort
    items.sort((a, b) => {
      let comparison = 0
      switch (sortField) {
        case "name":
          comparison = (a.product?.name || "").localeCompare(b.product?.name || "")
          break
        case "quantity":
          comparison = a.quantity - b.quantity
          break
        case "expiry":
          comparison = (a.expiryDate?.getTime() || 0) - (b.expiryDate?.getTime() || 0)
          break
        case "category":
          comparison = (a.product?.category || "").localeCompare(b.product?.category || "")
          break
      }
      return sortDirection === "asc" ? comparison : -comparison
    })
    
    return items
  }, [inventory, selectedCategory, searchQuery, filterType, sortField, sortDirection])

  // Stats
  const stats = useMemo(() => {
    const lowStock = inventory.filter((item) => item.quantity <= item.criticalLevel).length
    const expiringSoon = inventory.filter((item) => {
      if (!item.expiryDate) return false
      const daysUntilExpiry = differenceInDays(item.expiryDate, new Date())
      return daysUntilExpiry <= 30 && daysUntilExpiry > 0
    }).length
    const outOfStock = inventory.filter((item) => item.quantity === 0).length
    
    return { lowStock, expiringSoon, outOfStock, total: inventory.length }
  }, [inventory])

  // Derive branch name (safe even when currentBranchId is null)
  const branchName = branches.find((b) => b.id === currentBranchId)?.name?.replace("Arsenic Pharmacy - ", "")

  // If no branch is selected, show prompt (AFTER all hooks)
  if (!currentBranchId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertTriangle className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">No Branch Selected</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Select a branch from the sidebar to manage its inventory.
        </p>
      </div>
    )
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const handleUpdateQuantity = async () => {
    if (!editingItem || !newQuantity) return
    
    const qty = parseInt(newQuantity)
    if (isNaN(qty) || qty < 0) {
      toast.error("Invalid quantity")
      return
    }
    
    setIsUpdating(true)
    try {
      await updateInventoryQuantity(editingItem.id, qty)
      toast.success("Inventory updated")
      setEditingItem(null)
      setNewQuantity("")
    } catch (error) {
      toast.error("Failed to update inventory")
      console.error(error)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleAddItem = async () => {
    if (!newItem.productId || !newItem.quantity || !newItem.batchNumber || !newItem.expiryDate) {
      toast.error("Please fill all required fields")
      return
    }

    setIsAdding(true)
    try {
      const qtyToAdd = parseInt(newItem.quantity)

      // Check if existing item with same product + batch
      const existingItem = inventory.find(
        (item) =>
          item.productId === newItem.productId &&
          item.batchNumber === newItem.batchNumber
      )

      if (existingItem) {
        await updateInventoryQuantity(
          existingItem.id,
          existingItem.quantity + qtyToAdd
        )
        toast.success("Stock updated (added to existing)")
      } else {
        await addInventoryItem({
          productId: newItem.productId,
          quantity: qtyToAdd,
          criticalLevel: parseInt(newItem.criticalLevel) || 20,
          batchNumber: newItem.batchNumber,
          expiryDate: new Date(newItem.expiryDate),
          lastRestocked: new Date(),
        })
        toast.success("New inventory item added")
      }

      setShowAddDialog(false)
      setNewItem({
        productId: "",
        quantity: "",
        criticalLevel: "20",
        batchNumber: "",
        expiryDate: "",
      })
    } catch (error) {
      toast.error("Failed to add inventory item")
      console.error(error)
    } finally {
      setIsAdding(false)
    }
  }

  const getExpiryStatus = (expiryDate: Date) => {
    if (!expiryDate) return { label: "N/A", variant: "outline" as const }
    const days = differenceInDays(expiryDate, new Date())
    if (days < 0) return { label: "Expired", variant: "destructive" as const }
    if (days <= 30) return { label: `${days}d left`, variant: "secondary" as const }
    if (days <= 90) return { label: `${days}d`, variant: "outline" as const }
    return { label: format(expiryDate, "MMM yyyy"), variant: "outline" as const }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Inventory Management</h1>
          <p className="text-muted-foreground text-sm">
            Managing stock for <span className="font-medium">{branchName}</span>
          </p>
        </div>
        {isAdmin && (
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Stock
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add Inventory Stock</DialogTitle>
                <DialogDescription>
                  Add new stock to {branchName}&apos;s inventory
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Product</Label>
                  <Select
                    value={newItem.productId}
                    onValueChange={(value) => setNewItem((prev) => ({ ...prev, productId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      min={1}
                      value={newItem.quantity}
                      onChange={(e) => setNewItem((prev) => ({ ...prev, quantity: e.target.value }))}
                      placeholder="100"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Critical Level</Label>
                    <Input
                      type="number"
                      min={1}
                      value={newItem.criticalLevel}
                      onChange={(e) => setNewItem((prev) => ({ ...prev, criticalLevel: e.target.value }))}
                      placeholder="20"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Batch Number</Label>
                  <Input
                    value={newItem.batchNumber}
                    onChange={(e) => setNewItem((prev) => ({ ...prev, batchNumber: e.target.value }))}
                    placeholder="BATCH-001"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Expiry Date</Label>
                  <Input
                    type="date"
                    value={newItem.expiryDate}
                    onChange={(e) => setNewItem((prev) => ({ ...prev, expiryDate: e.target.value }))}
                    min={format(new Date(), "yyyy-MM-dd")}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddItem} disabled={isAdding}>
                  {isAdding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Add Stock
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card className={stats.lowStock > 0 ? "border-warning/50" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className={cn("h-4 w-4", stats.lowStock > 0 && "text-warning")} />
              Low Stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", stats.lowStock > 0 && "text-warning")}>
              {stats.lowStock}
            </div>
          </CardContent>
        </Card>
        <Card className={stats.outOfStock > 0 ? "border-destructive/50" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Out of Stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", stats.outOfStock > 0 && "text-destructive")}>
              {stats.outOfStock}
            </div>
          </CardContent>
        </Card>
        <Card className={stats.expiringSoon > 0 ? "border-warning/50" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className={cn("h-4 w-4", stats.expiringSoon > 0 && "text-warning")} />
              Expiring Soon
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", stats.expiringSoon > 0 && "text-warning")}>
              {stats.expiringSoon}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by product name, SKU, or batch..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            
            {/* Category filter */}
            <div className="flex flex-wrap gap-2">
              <Select value={selectedCategory} onValueChange={(v) => setSelectedCategory(v as ProductCategory | "all")}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {PRODUCT_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Quick Filters */}
          <Tabs value={filterType} onValueChange={(v) => setFilterType(v as FilterType)} className="mt-4">
            <TabsList>
              <TabsTrigger value="all" className="gap-2">
                <Package className="h-4 w-4" />
                All
              </TabsTrigger>
              <TabsTrigger value="low-stock" className="gap-2">
                <AlertTriangle className="h-4 w-4" />
                Low Stock
                {stats.lowStock > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1">
                    {stats.lowStock}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="expiring" className="gap-2">
                <Calendar className="h-4 w-4" />
                Expiring Soon
                {stats.expiringSoon > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1">
                    {stats.expiringSoon}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        
        <CardContent>
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button
                      variant="ghost"
                      className="h-8 px-2 -ml-2"
                      onClick={() => handleSort("name")}
                    >
                      Product
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      className="h-8 px-2 -ml-2"
                      onClick={() => handleSort("category")}
                    >
                      Category
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      className="h-8 px-2 -ml-2"
                      onClick={() => handleSort("quantity")}
                    >
                      Stock
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      className="h-8 px-2 -ml-2"
                      onClick={() => handleSort("expiry")}
                    >
                      Expiry
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInventory.map((item) => {
                  const expiryStatus = getExpiryStatus(item.expiryDate)
                  const isLowStock = item.quantity <= item.criticalLevel
                  
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.product?.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.product?.genericName} | SKU: {item.product?.sku}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {PRODUCT_CATEGORIES.find((c) => c.value === item.product?.category)?.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.batchNumber}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={cn("font-medium", isLowStock && "text-warning")}>
                            {item.quantity}
                          </span>
                          {isLowStock && (
                            <AlertTriangle className="h-4 w-4 text-warning" />
                          )}
                          <span className="text-xs text-muted-foreground">
                            / {item.criticalLevel}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={expiryStatus.variant}>
                          {expiryStatus.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                setEditingItem(item)
                                setNewQuantity(item.quantity.toString())
                              }}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[350px]">
                            <DialogHeader>
                              <DialogTitle>Update Stock</DialogTitle>
                              <DialogDescription>
                                {item.product?.name}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                              <div className="grid gap-2">
                                <Label>Current Quantity</Label>
                                <p className="text-2xl font-bold">{item.quantity}</p>
                              </div>
                              <div className="grid gap-2">
                                <Label htmlFor="new-qty">New Quantity</Label>
                                <Input
                                  id="new-qty"
                                  type="number"
                                  min={0}
                                  value={newQuantity}
                                  onChange={(e) => setNewQuantity(e.target.value)}
                                />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button onClick={handleUpdateQuantity} disabled={isUpdating}>
                                {isUpdating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                Update
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {filteredInventory.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      No inventory items found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
