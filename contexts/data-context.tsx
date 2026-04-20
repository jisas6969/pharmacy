"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import {
  collection,
  getDocs,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  Timestamp,
  writeBatch,
  increment,
  getDoc,
} from "firebase/firestore"
import { db, isFirebaseConfigured, ROOT_COLLECTIONS, BRANCH_SUBS, branchCollection } from "@/lib/firebase"
import type {
  Branch,
  Product,
  InventoryItem,
  Sale,
  InventoryWithProduct,
  CartItem,
  SaleItem,
  PaymentMethod,
} from "@/lib/types"
import { useAuth } from "./auth-context"

interface DataContextType {
  // Data
  branches: Branch[]
  products: Product[]
  inventory: InventoryWithProduct[]
  sales: Sale[]
  loading: boolean
  
  // Branch operations
  fetchBranches: () => Promise<void>
  
  // Product operations (branch-scoped)
  fetchProducts: (branchId?: string) => Promise<void>
  addProduct: (product: Omit<Product, "id" | "createdAt" | "updatedAt">) => Promise<string>
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>
  deleteProduct: (id: string) => Promise<void>
  
  // Inventory operations (branch-scoped)
  fetchInventory: (branchId?: string) => Promise<void>
  updateInventoryQuantity: (id: string, quantity: number) => Promise<void>
  addInventoryItem: (item: Omit<InventoryItem, "id" | "updatedAt">) => Promise<string>
  
  // Sales operations (branch-scoped)
  fetchSales: (branchId?: string) => Promise<void>
  createSale: (
    items: CartItem[],
    paymentMethod: PaymentMethod,
    discount?: number,
    customerName?: string,
    prescriptionNumber?: string
  ) => Promise<string>
  
  // Current branch selection
  currentBranchId: string | null
  setCurrentBranchId: (id: string | null) => void
}

const DataContext = createContext<DataContextType | undefined>(undefined)

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [branches, setBranches] = useState<Branch[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [inventory, setInventory] = useState<InventoryWithProduct[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [currentBranchId, setCurrentBranchId] = useState<string | null>(null)

  /**
   * Resolves the effective branch ID for queries.
   * Staff always uses their assigned branch.
   * Admin uses the selected branch (currentBranchId).
   */
  const getEffectiveBranchId = useCallback((overrideBranchId?: string): string | null => {
    if (overrideBranchId) return overrideBranchId
    if (user?.role === "staff" && user.branchId) return user.branchId
    return currentBranchId
  }, [user, currentBranchId])

  // ─── Initialize ───
  useEffect(() => {
    const initializeData = async () => {
      setLoading(true)
      try {
        // Set current branch for staff
        if (user?.role === "staff" && user.branchId) {
          setCurrentBranchId(user.branchId)
        } else if (user?.role === "admin") {
          // Admin starts with no branch selected
          setCurrentBranchId(null)
        }
        
        // Fetch branch list (always needed for branch selector)
        await fetchBranches()
      } catch (error) {
        console.error("Error initializing data:", error)
      } finally {
        setLoading(false)
      }
    }

    if (user) {
      initializeData()
    }
  }, [user])

  // ─── Auto-fetch data when branch changes ───
  useEffect(() => {
    const branchId = getEffectiveBranchId()
    if (branchId) {
      fetchProducts(branchId)
      fetchInventory(branchId)
      fetchSales(branchId)
    } else {
      // No branch selected (admin hasn't picked one yet)
      setProducts([])
      setInventory([])
      setSales([])
    }
  }, [currentBranchId, user])

  // ═══════════════════════════════════════════
  // BRANCH OPERATIONS (top-level collection)
  // ═══════════════════════════════════════════

  const fetchBranches = useCallback(async () => {
    if (!isFirebaseConfigured() || !db) {
      console.warn("Firebase is not configured.")
      return
    }
    
    try {
      const snapshot = await getDocs(collection(db, ROOT_COLLECTIONS.BRANCHES))
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as Branch[]
      setBranches(data)
    } catch (error) {
      console.error("Error fetching branches:", error)
    }
  }, [])

  // ═══════════════════════════════════════════
  // PRODUCT OPERATIONS (branches/{branchId}/products)
  // ═══════════════════════════════════════════

  const fetchProducts = useCallback(async (branchId?: string) => {
    const targetBranchId = getEffectiveBranchId(branchId)
    if (!targetBranchId || !isFirebaseConfigured() || !db) return
    
    try {
      const snapshot = await getDocs(
        query(branchCollection(targetBranchId, BRANCH_SUBS.PRODUCTS), orderBy("name"))
      )
      const data = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate(),
        updatedAt: d.data().updatedAt?.toDate(),
      })) as Product[]
      setProducts(data)
    } catch (error) {
      console.error("Error fetching products:", error)
    }
  }, [getEffectiveBranchId])

  const addProduct = useCallback(async (
    product: Omit<Product, "id" | "createdAt" | "updatedAt">
  ): Promise<string> => {
    const targetBranchId = getEffectiveBranchId()
    if (!targetBranchId) throw new Error("No branch selected")
    if (!db) throw new Error("Database not configured")
    
    const now = new Date()
    const docRef = await addDoc(branchCollection(targetBranchId, BRANCH_SUBS.PRODUCTS), {
      ...product,
      createdAt: Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now),
    })
    await fetchProducts(targetBranchId)
    return docRef.id
  }, [getEffectiveBranchId, fetchProducts])

  const updateProduct = useCallback(async (id: string, updates: Partial<Product>) => {
    const targetBranchId = getEffectiveBranchId()
    if (!targetBranchId) throw new Error("No branch selected")
    if (!db) throw new Error("Database not configured")
    
    const now = new Date()
    await updateDoc(
      doc(db, ROOT_COLLECTIONS.BRANCHES, targetBranchId, BRANCH_SUBS.PRODUCTS, id),
      {
        ...updates,
        updatedAt: Timestamp.fromDate(now),
      }
    )
    await fetchProducts(targetBranchId)
  }, [getEffectiveBranchId, fetchProducts])

  const deleteProduct = useCallback(async (id: string) => {
    const targetBranchId = getEffectiveBranchId()
    if (!targetBranchId) throw new Error("No branch selected")
    if (!db) throw new Error("Database not configured")
    
    await deleteDoc(
      doc(db, ROOT_COLLECTIONS.BRANCHES, targetBranchId, BRANCH_SUBS.PRODUCTS, id)
    )
    await fetchProducts(targetBranchId)
  }, [getEffectiveBranchId, fetchProducts])

  // ═══════════════════════════════════════════
  // INVENTORY OPERATIONS (branches/{branchId}/inventory)
  // ═══════════════════════════════════════════

  const fetchInventory = useCallback(async (branchId?: string) => {
    const targetBranchId = getEffectiveBranchId(branchId)
    if (!targetBranchId || !isFirebaseConfigured() || !db) return
    
    try {
      // Fetch inventory items from branch subcollection
      const invSnapshot = await getDocs(branchCollection(targetBranchId, BRANCH_SUBS.INVENTORY))
      
      // Fetch products from the same branch to join
      const prodSnapshot = await getDocs(branchCollection(targetBranchId, BRANCH_SUBS.PRODUCTS))
      const productsMap = new Map<string, Product>()
      prodSnapshot.docs.forEach((d) => {
        productsMap.set(d.id, {
          id: d.id,
          ...d.data(),
          createdAt: d.data().createdAt?.toDate(),
          updatedAt: d.data().updatedAt?.toDate(),
        } as Product)
      })

      const data = invSnapshot.docs
        .map((docSnap) => {
          const invData = docSnap.data()
          const product = productsMap.get(invData.productId)
          
          if (!product) return null // skip orphaned inventory

          return {
            id: docSnap.id,
            productId: invData.productId,
            quantity: invData.quantity,
            criticalLevel: invData.criticalLevel,
            batchNumber: invData.batchNumber,
            expiryDate: invData.expiryDate?.toDate(),
            lastRestocked: invData.lastRestocked?.toDate(),
            updatedAt: invData.updatedAt?.toDate(),
            product,
          } as InventoryWithProduct
        })
        .filter(Boolean) as InventoryWithProduct[]
      
      setInventory(data)
    } catch (error) {
      console.error("Error fetching inventory:", error)
    }
  }, [getEffectiveBranchId])

  const updateInventoryQuantity = useCallback(async (id: string, quantity: number) => {
    const targetBranchId = getEffectiveBranchId()
    if (!targetBranchId) throw new Error("No branch selected")
    if (!db) throw new Error("Database not configured")
    
    const now = new Date()
    await updateDoc(
      doc(db, ROOT_COLLECTIONS.BRANCHES, targetBranchId, BRANCH_SUBS.INVENTORY, id),
      {
        quantity,
        updatedAt: Timestamp.fromDate(now),
      }
    )
    await fetchInventory(targetBranchId)
  }, [getEffectiveBranchId, fetchInventory])

  const addInventoryItem = useCallback(async (
    item: Omit<InventoryItem, "id" | "updatedAt">
  ): Promise<string> => {
    const targetBranchId = getEffectiveBranchId()
    if (!targetBranchId) throw new Error("No branch selected")
    if (!db) throw new Error("Database not configured")
    
    const now = new Date()
    const docRef = await addDoc(branchCollection(targetBranchId, BRANCH_SUBS.INVENTORY), {
      ...item,
      expiryDate: Timestamp.fromDate(item.expiryDate),
      lastRestocked: Timestamp.fromDate(item.lastRestocked),
      updatedAt: Timestamp.fromDate(now),
    })
    await fetchInventory(targetBranchId)
    return docRef.id
  }, [getEffectiveBranchId, fetchInventory])

  // ═══════════════════════════════════════════
  // SALES OPERATIONS (branches/{branchId}/sales)
  // ═══════════════════════════════════════════

  const fetchSales = useCallback(async (branchId?: string) => {
    const targetBranchId = getEffectiveBranchId(branchId)
    if (!targetBranchId || !isFirebaseConfigured() || !db) return
    
    try {
      const snapshot = await getDocs(
        query(
          branchCollection(targetBranchId, BRANCH_SUBS.SALES),
          orderBy("createdAt", "desc")
        )
      )
      const data = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate(),
      })) as Sale[]
      
      setSales(data)
    } catch (error) {
      console.error("Error fetching sales:", error)
    }
  }, [getEffectiveBranchId])

  const createSale = useCallback(async (
    items: CartItem[],
    paymentMethod: PaymentMethod,
    discount: number = 0,
    customerName?: string,
    prescriptionNumber?: string
  ): Promise<string> => {
    const targetBranchId = getEffectiveBranchId()
    if (!targetBranchId) throw new Error("No branch selected")
    if (!db) throw new Error("Database not configured")
    
    const now = new Date()
    
    const saleItems: SaleItem[] = items.map((item) => ({
      productId: item.product.id,
      productName: item.product.name,
      quantity: item.quantity,
      unitPrice: item.product.price,
      total: item.product.price * item.quantity,
    }))
    
    const subtotal = saleItems.reduce((sum, item) => sum + item.total, 0)
    const tax = (subtotal - discount) * 0.05 // 5% tax
    const total = subtotal - discount + tax
    
    const saleData = {
      userId: user?.id || "unknown",
      items: saleItems,
      subtotal,
      discount,
      tax,
      total,
      paymentMethod,
      status: "completed" as const,
      customerName,
      prescriptionNumber,
      createdAt: Timestamp.fromDate(now),
    }
    
    const batch = writeBatch(db)
    
    // Create sale document in branch subcollection
    const saleRef = doc(collection(db, ROOT_COLLECTIONS.BRANCHES, targetBranchId, BRANCH_SUBS.SALES))
    batch.set(saleRef, saleData)
    
    // Deduct inventory (from the same branch subcollection)
    for (const item of items) {
      const invRef = doc(
        db,
        ROOT_COLLECTIONS.BRANCHES,
        targetBranchId,
        BRANCH_SUBS.INVENTORY,
        item.inventoryId
      )
      batch.update(invRef, {
        quantity: increment(-item.quantity),
        updatedAt: Timestamp.fromDate(now),
      })
    }
    
    await batch.commit()
    await fetchSales(targetBranchId)
    await fetchInventory(targetBranchId)
    return saleRef.id
  }, [user, getEffectiveBranchId, fetchSales, fetchInventory])

  return (
    <DataContext.Provider
      value={{
        branches,
        products,
        inventory,
        sales,
        loading,
        fetchBranches,
        fetchProducts,
        addProduct,
        updateProduct,
        deleteProduct,
        fetchInventory,
        updateInventoryQuantity,
        addInventoryItem,
        fetchSales,
        createSale,
        currentBranchId,
        setCurrentBranchId,
      }}
    >
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  const context = useContext(DataContext)
  if (context === undefined) {
    throw new Error("useData must be used within a DataProvider")
  }
  return context
}
