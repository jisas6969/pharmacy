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
  where,
  orderBy,
  Timestamp,
  writeBatch,
  increment,
} from "firebase/firestore"
import { db, isFirebaseConfigured, COLLECTIONS } from "@/lib/firebase"
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
  
  // Product operations
  fetchProducts: () => Promise<void>
  addProduct: (product: Omit<Product, "id" | "createdAt" | "updatedAt">) => Promise<string>
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>
  deleteProduct: (id: string) => Promise<void>
  
  // Inventory operations
  fetchInventory: (branchId?: string) => Promise<void>
  updateInventoryQuantity: (id: string, quantity: number) => Promise<void>
  addInventoryItem: (item: Omit<InventoryItem, "id" | "updatedAt">) => Promise<string>
  
  // Sales operations
  fetchSales: (branchId?: string) => Promise<void>
  createSale: (
    branchId: string,
    items: CartItem[],
    paymentMethod: PaymentMethod,
    discount?: number,
    customerName?: string,
    prescriptionNumber?: string
  ) => Promise<string>
  
  // Current branch for staff
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

  // Initialize and fetch data
  useEffect(() => {
    const initializeData = async () => {
      setLoading(true)
      try {
        // Set current branch for staff
        if (user?.role === "staff" && user.branchId) {
          setCurrentBranchId(user.branchId)
        } else if (user?.role === "admin") {
          setCurrentBranchId(null)
        }
        
        // Fetch initial data
        await fetchBranches()
        await fetchProducts()
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

  // Fetch branches
  const fetchBranches = useCallback(async () => {
    if (!isFirebaseConfigured() || !db) {
      console.warn("Firebase is not configured. Please add your Firebase environment variables.")
      return
    }
    
    try {
      const snapshot = await getDocs(collection(db, COLLECTIONS.BRANCHES))
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

  // Fetch products
  const fetchProducts = useCallback(async () => {
    if (!isFirebaseConfigured() || !db) {
      console.warn("Firebase is not configured. Please add your Firebase environment variables.")
      return
    }
    
    try {
      const snapshot = await getDocs(
        query(collection(db, COLLECTIONS.PRODUCTS), orderBy("name"))
      )
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as Product[]
      setProducts(data)
    } catch (error) {
      console.error("Error fetching products:", error)
    }
  }, [])

  // Add product
  const addProduct = useCallback(async (
    product: Omit<Product, "id" | "createdAt" | "updatedAt">
  ): Promise<string> => {
    const now = new Date()
    
    if (!db) throw new Error("Database not configured")
    
    const docRef = await addDoc(collection(db, COLLECTIONS.PRODUCTS), {
      ...product,
      createdAt: Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now),
    })
    await fetchProducts()
    return docRef.id
  }, [fetchProducts])

  // Update product
  const updateProduct = useCallback(async (id: string, updates: Partial<Product>) => {
    const now = new Date()
    
    if (!db) throw new Error("Database not configured")
    
    await updateDoc(doc(db, COLLECTIONS.PRODUCTS, id), {
      ...updates,
      updatedAt: Timestamp.fromDate(now),
    })
    await fetchProducts()
  }, [fetchProducts])

  // Delete product
  const deleteProduct = useCallback(async (id: string) => {
    if (!db) throw new Error("Database not configured")
    
    await deleteDoc(doc(db, COLLECTIONS.PRODUCTS, id))
    await fetchProducts()
  }, [fetchProducts])

  // Fetch inventory
  const fetchInventory = useCallback(async (branchId?: string) => {
    const targetBranchId = branchId || currentBranchId
    
    if (!isFirebaseConfigured() || !db) {
      console.warn("Firebase is not configured. Please add your Firebase environment variables.")
      return
    }
    
    try {
      let q = query(collection(db, COLLECTIONS.INVENTORY))
      if (targetBranchId) {
        q = query(q, where("branchId", "==", targetBranchId))
      }
      
      const snapshot = await getDocs(q)
      const data = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const invData = docSnap.data()
          const productDoc = await getDocs(
            query(collection(db, COLLECTIONS.PRODUCTS), where("__name__", "==", invData.productId))
          )
          const branchDoc = await getDocs(
            query(collection(db, COLLECTIONS.BRANCHES), where("__name__", "==", invData.branchId))
          )
          
          return {
            id: docSnap.id,
            ...invData,
            expiryDate: invData.expiryDate?.toDate(),
            lastRestocked: invData.lastRestocked?.toDate(),
            updatedAt: invData.updatedAt?.toDate(),
            product: productDoc.docs[0]?.data() as Product,
            branch: branchDoc.docs[0]?.data() as Branch,
          } as InventoryWithProduct
        })
      )
      
      setInventory(data)
    } catch (error) {
      console.error("Error fetching inventory:", error)
    }
  }, [currentBranchId])

  // Update inventory quantity
  const updateInventoryQuantity = useCallback(async (id: string, quantity: number) => {
    const now = new Date()
    
    if (!db) throw new Error("Database not configured")
    
    await updateDoc(doc(db, COLLECTIONS.INVENTORY, id), {
      quantity,
      updatedAt: Timestamp.fromDate(now),
    })
    await fetchInventory()
  }, [fetchInventory])

  // Add inventory item
  const addInventoryItem = useCallback(async (
    item: Omit<InventoryItem, "id" | "updatedAt">
  ): Promise<string> => {
    const now = new Date()
    
    if (!db) throw new Error("Database not configured")
    
    const docRef = await addDoc(collection(db, COLLECTIONS.INVENTORY), {
      ...item,
      expiryDate: Timestamp.fromDate(item.expiryDate),
      lastRestocked: Timestamp.fromDate(item.lastRestocked),
      updatedAt: Timestamp.fromDate(now),
    })
    await fetchInventory()
    return docRef.id
  }, [fetchInventory])

  // Fetch sales
  const fetchSales = useCallback(async (branchId?: string) => {
    const targetBranchId = branchId || currentBranchId
    
    if (!isFirebaseConfigured() || !db) {
      console.warn("Firebase is not configured. Please add your Firebase environment variables.")
      return
    }
    
    try {
      let q = query(collection(db, COLLECTIONS.SALES), orderBy("createdAt", "desc"))
      if (targetBranchId) {
        q = query(
          collection(db, COLLECTIONS.SALES),
          where("branchId", "==", targetBranchId),
          orderBy("createdAt", "desc")
        )
      }
      
      const snapshot = await getDocs(q)
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
      })) as Sale[]
      
      setSales(data)
    } catch (error) {
      console.error("Error fetching sales:", error)
    }
  }, [currentBranchId])

  // Create sale
  const createSale = useCallback(async (
    branchId: string,
    items: CartItem[],
    paymentMethod: PaymentMethod,
    discount: number = 0,
    customerName?: string,
    prescriptionNumber?: string
  ): Promise<string> => {
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
      branchId,
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
      createdAt: now,
    }
    
    if (!db) throw new Error("Database not configured")
    
    const batch = writeBatch(db)
    
    // Create sale document
    const saleRef = doc(collection(db, COLLECTIONS.SALES))
    batch.set(saleRef, {
      ...saleData,
      createdAt: Timestamp.fromDate(now),
    })
    
    // Deduct inventory
    for (const item of items) {
      const invRef = doc(db, COLLECTIONS.INVENTORY, item.inventoryId)
      batch.update(invRef, {
        quantity: increment(-item.quantity),
        updatedAt: Timestamp.fromDate(now),
      })
    }
    
    await batch.commit()
    await fetchSales(branchId)
    await fetchInventory(branchId)
    return saleRef.id
  }, [user, fetchSales, fetchInventory])

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
