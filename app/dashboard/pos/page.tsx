"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useData } from "@/contexts/data-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Search,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Banknote,
  Smartphone,
  ShoppingCart,
  AlertTriangle,
  CheckCircle2,
  FileText,
  X,
} from "lucide-react"
import { toast } from "sonner"
import type { CartItem, InventoryWithProduct, PaymentMethod } from "@/lib/types"
import { cn, formatCurrency } from "@/lib/utils"

export default function POSPage() {
  const { user } = useAuth()
  const { inventory, branches, createSale, fetchInventory, currentBranchId } = useData()
  
  // State
  const [searchQuery, setSearchQuery] = useState("")
  const [cart, setCart] = useState<CartItem[]>([])
  const [discount, setDiscount] = useState(0)
  const [customerName, setCustomerName] = useState("")
  const [prescriptionNumber, setPrescriptionNumber] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [lastSaleTotal, setLastSaleTotal] = useState(0)
  const [showClearCartDialog, setShowClearCartDialog] = useState(false)
  
  const searchInputRef = useRef<HTMLInputElement>(null)
  const isAdmin = user?.role === "admin"

  // Filter inventory based on search (already branch-scoped from context)
  const filteredInventory = useMemo(() => {
    const map = new Map()

    // 🔥 GROUP BY productId
    inventory.forEach((item) => {
      if (item.quantity <= 0) return

      if (!map.has(item.productId)) {
        map.set(item.productId, {
          ...item,
          quantity: item.quantity,
          inventoryIds: [item.id],
        })
      } else {
        const existing = map.get(item.productId)
        existing.quantity += item.quantity
        existing.inventoryIds.push(item.id)
      }
    })

    let items = Array.from(map.values())

    // 🔍 search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      items = items.filter(
        (item) =>
          item.product?.name?.toLowerCase().includes(query) ||
          item.product?.genericName?.toLowerCase().includes(query) ||
          item.product?.barcode?.includes(query) ||
          item.product?.sku?.toLowerCase().includes(query)
      )
    }

    return items
  }, [inventory, searchQuery])

  // Calculate totals
  const totals = useMemo(() => {
    const subtotal = cart.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0
    )
    const discountAmount = discount
    const tax = (subtotal - discountAmount) * 0.05 // 5% tax
    const total = subtotal - discountAmount + tax
    
    return {
      subtotal,
      discount: discountAmount,
      tax,
      total,
      itemCount: cart.reduce((sum, item) => sum + item.quantity, 0),
    }
  }, [cart, discount])

  // Check if cart has prescription items
  const hasPrescriptionItems = useMemo(
    () => cart.some((item) => item.product.requiresPrescription),
    [cart]
  )

  // Add item to cart
  const addToCart = useCallback((invItem: InventoryWithProduct) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.inventoryId === invItem.id)
      
      if (existing) {
        if (existing.quantity >= invItem.quantity) {
          toast.error("Cannot add more - insufficient stock")
          return prev
        }
        
        return prev.map((item) =>
          item.inventoryId === invItem.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      }
      
      return [
        ...prev,
        {
          product: invItem.product,
          quantity: 1,
          inventoryId: invItem.id,
          availableStock: invItem.quantity,
        },
      ]
    })
    
    searchInputRef.current?.focus()
  }, [])

  // Update cart item quantity
  const updateQuantity = useCallback((inventoryId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.inventoryId !== inventoryId) return item
          
          const newQty = item.quantity + delta
          if (newQty <= 0) return null
          if (newQty > item.availableStock) {
            toast.error("Cannot add more - insufficient stock")
            return item
          }
          
          return { ...item, quantity: newQty }
        })
        .filter(Boolean) as CartItem[]
    )
  }, [])

  // Remove item from cart
  const removeFromCart = useCallback((inventoryId: string) => {
    setCart((prev) => prev.filter((item) => item.inventoryId !== inventoryId))
  }, [])

  // Clear cart
  const clearCart = useCallback(() => {
    setCart([])
    setDiscount(0)
    setCustomerName("")
    setPrescriptionNumber("")
    setShowClearCartDialog(false)
  }, [])

  // Process payment — createSale no longer needs branchId (uses context)
  const processPayment = async (method: PaymentMethod) => {
    if (cart.length === 0) {
      toast.error("Cart is empty")
      return
    }
    
    if (hasPrescriptionItems && !prescriptionNumber.trim()) {
      toast.error("Prescription number required for prescription items")
      return
    }
    
    setIsProcessing(true)
    try {
      const finalCustomerName =
  method === "cash"
    ? "Walk-in Customer"
    : customerName.trim() || "Walk-in Customer"

const finalPrescriptionNumber = hasPrescriptionItems
  ? prescriptionNumber.trim()
  : null

await createSale(
  cart,
  method,
  discount,
  finalCustomerName,
  finalPrescriptionNumber
)
      
      setLastSaleTotal(totals.total)
      setShowPaymentDialog(false)
      setShowSuccessDialog(true)
      clearCart()
    } catch (error) {
      toast.error("Failed to process sale")
      console.error(error)
    } finally {
      setIsProcessing(false)
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
      if (e.key === "F2" && cart.length > 0) {
        e.preventDefault()
        setShowPaymentDialog(true)
      }
      if (e.key === "Escape") {
        if (showPaymentDialog) {
          setShowPaymentDialog(false)
        } else if (searchQuery) {
          setSearchQuery("")
        }
      }
    }
    
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [cart.length, showPaymentDialog, searchQuery])

  const currentBranch = branches.find((b) => b.id === currentBranchId)

  // If no branch is selected (admin hasn't picked one), show prompt (AFTER all hooks)
  if (!currentBranchId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertTriangle className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">No Branch Selected</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Select a branch from the sidebar to use the POS system.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-8rem)]">
      {/* Product Search & List */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Search */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Search products by name, barcode, or SKU... (Ctrl+K)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Products Grid */}
        <Card className="flex-1 overflow-hidden">
          <CardHeader className="py-3 border-b">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <span>
                {currentBranch?.name?.replace("Arsenic Pharmacy - ", "")} - Products
              </span>
              <Badge variant="secondary">
                {filteredInventory.length} items
              </Badge>
            </CardTitle>
          </CardHeader>
          <ScrollArea className="h-[calc(100%-3.5rem)]">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 p-4">
              {filteredInventory.map((item) => (
                <button
                  key={item.id}
                  onClick={() => addToCart(item)}
                  className={cn(
                    "text-left p-3 rounded-lg border transition-all hover:border-primary hover:shadow-sm",
                    "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                    item.quantity <= item.criticalLevel && "border-warning/50 bg-warning/5"
                  )}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.product.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {item.product.genericName}
                      </p>
                    </div>
                    {item.product.requiresPrescription && (
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        Rx
                      </Badge>
                    )}
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="font-semibold text-primary">
                      {formatCurrency(item.product.price)}
                    </span>
                    <span className={cn(
                      "text-xs",
                      item.quantity <= item.criticalLevel
                        ? "text-warning font-medium"
                        : "text-muted-foreground"
                    )}>
                      {item.quantity} in stock
                    </span>
                  </div>
                </button>
              ))}
              
              {filteredInventory.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <ShoppingCart className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-sm">
                    {searchQuery ? "No products found" : "No products available"}
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </Card>
      </div>

      {/* Cart */}
      <Card className="w-full lg:w-[400px] flex flex-col">
        <CardHeader className="py-3 border-b">
          <CardTitle className="text-sm font-medium flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Cart
            </span>
            {cart.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-destructive hover:text-destructive"
                onClick={() => setShowClearCartDialog(true)}
              >
                Clear
              </Button>
            )}
          </CardTitle>
        </CardHeader>

        {/* Cart Items */}
        <ScrollArea className="flex-1 p-4">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <ShoppingCart className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">Cart is empty</p>
              <p className="text-xs">Add products to begin</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => (
                <div
                  key={item.inventoryId}
                  className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(item.product.price)} x {item.quantity}
                    </p>
                    {item.product.requiresPrescription && (
                      <Badge variant="outline" className="mt-1 text-[10px]">
                        <FileText className="h-2.5 w-2.5 mr-1" />
                        Requires Rx
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => updateQuantity(item.inventoryId, -1)}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center text-sm font-medium">
                      {item.quantity}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => updateQuantity(item.inventoryId, 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => removeFromCart(item.inventoryId)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Cart Summary & Checkout */}
        <div className="border-t p-4 space-y-4">
          {/* Prescription Notice */}
          {hasPrescriptionItems && (
            <div className="flex items-center gap-2 text-xs text-warning bg-warning/10 p-2 rounded-md">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Cart contains prescription items</span>
            </div>
          )}
          
          {/* Customer Info */}
          <div className="space-y-2">
            <Input
              placeholder="Customer name (optional)"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="h-8 text-sm"
            />
            {hasPrescriptionItems && (
              <Input
                placeholder="Prescription number (required)"
                value={prescriptionNumber}
                onChange={(e) => setPrescriptionNumber(e.target.value)}
                className={cn(
                  "h-8 text-sm",
                  hasPrescriptionItems && !prescriptionNumber.trim() && "border-warning"
                )}
              />
            )}
          </div>

          {/* Totals */}
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal ({totals.itemCount} items)</span>
              <span>{formatCurrency(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Discount</span>
              <Input
                type="number"
                min={0}
                max={totals.subtotal}
                value={discount || ""}
                onChange={(e) => setDiscount(Math.min(parseFloat(e.target.value) || 0, totals.subtotal))}
                className="w-24 h-7 text-right text-sm"
                placeholder="0.00"
              />
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Tax (5%)</span>
              <span>{formatCurrency(totals.tax)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-semibold text-lg">
              <span>Total</span>
              <span className="text-primary">{formatCurrency(totals.total)}</span>
            </div>
          </div>

          {/* Checkout Button */}
          <Button
            className="w-full"
            size="lg"
            disabled={cart.length === 0 || (hasPrescriptionItems && !prescriptionNumber.trim())}
            onClick={() => setShowPaymentDialog(true)}
          >
            Checkout (F2)
          </Button>
        </div>
      </Card>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="sm:max-w-md">
  <DialogHeader>
    <DialogTitle>Select Payment Method</DialogTitle>
    <DialogDescription>
      Choose how the customer will pay. <br />
      Total: <span className="font-semibold text-primary">{formatCurrency(totals.total)}</span>
    </DialogDescription>
  </DialogHeader>
          <div className="grid grid-cols-3 gap-3 py-4">
            <Button
              variant="outline"
              className="h-24 flex flex-col gap-2"
              onClick={() => processPayment("cash")}
              disabled={isProcessing}
            >
              <Banknote className="h-8 w-8" />
              <span>Cash</span>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex flex-col gap-2"
              onClick={() => processPayment("card")}
              disabled={isProcessing}
            >
              <CreditCard className="h-8 w-8" />
              <span>Card</span>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex flex-col gap-2"
              onClick={() => processPayment("mobile")}
              disabled={isProcessing}
            >
              <Smartphone className="h-8 w-8" />
              <span>Mobile</span>
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowPaymentDialog(false)} disabled={isProcessing}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md text-center">
  <DialogHeader>
    <DialogTitle>Payment Successful</DialogTitle>
    <DialogDescription>
      The transaction has been completed successfully.
    </DialogDescription>
  </DialogHeader>

  <div className="flex flex-col items-center gap-4 py-6">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-xl font-semibold">Payment Successful</h3>
              <p className="text-muted-foreground mt-1">
                Transaction completed for {formatCurrency(lastSaleTotal)}
              </p>
            </div>
          </div>
          <DialogFooter className="sm:justify-center">
            <Button onClick={() => setShowSuccessDialog(false)}>
              New Transaction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear Cart Confirmation */}
      <AlertDialog open={showClearCartDialog} onOpenChange={setShowClearCartDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Cart?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all items from the cart. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={clearCart} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Clear Cart
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
