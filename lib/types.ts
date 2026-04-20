// User and Authentication Types
export type UserRole = "admin" | "staff"
export type UserStatus = "active" | "inactive"

import { Timestamp } from "firebase/firestore"

// Lightweight mapping stored at users/{uid} for auth lookup
export interface UserMapping {
  uid: string
  role: UserRole
  branchId: string | null // null for admin
  email: string
  name: string
  status: UserStatus
}

// Full user profile stored at branches/{branchId}/users/{uid}
export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  branchId: string | null // null for admin
  status: UserStatus
  createdAt: Timestamp | Date
  updatedAt: Timestamp | Date
}

// Branch Types
export interface Branch {
  id: string
  name: string
  address: string
  phone: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

// Product Types (stored at branches/{branchId}/products/{productId})
export interface Product {
  id: string
  name: string
  genericName: string
  category: ProductCategory
  sku: string
  barcode: string
  unit: string
  price: number
  requiresPrescription: boolean
  description: string
  manufacturer: string
  createdAt: Date
  updatedAt: Date
}

export type ProductCategory = 
  | "pain-relief"
  | "antibiotics"
  | "vitamins"
  | "cold-flu"
  | "digestive"
  | "cardiovascular"
  | "diabetes"
  | "skin-care"
  | "first-aid"
  | "other"

export const PRODUCT_CATEGORIES: { value: ProductCategory; label: string }[] = [
  { value: "pain-relief", label: "Pain Relief" },
  { value: "antibiotics", label: "Antibiotics" },
  { value: "vitamins", label: "Vitamins & Supplements" },
  { value: "cold-flu", label: "Cold & Flu" },
  { value: "digestive", label: "Digestive Health" },
  { value: "cardiovascular", label: "Cardiovascular" },
  { value: "diabetes", label: "Diabetes Care" },
  { value: "skin-care", label: "Skin Care" },
  { value: "first-aid", label: "First Aid" },
  { value: "other", label: "Other" },
]

// Inventory Types (stored at branches/{branchId}/inventory/{itemId})
// branchId is implicit from the subcollection path
export interface InventoryItem {
  id: string
  productId: string
  quantity: number
  criticalLevel: number
  batchNumber: string
  expiryDate: Date
  lastRestocked: Date
  updatedAt: Date
}

// Inventory joined with its product (both from same branch)
export interface InventoryWithProduct extends InventoryItem {
  product: Product
}

// Sale Types (stored at branches/{branchId}/sales/{saleId})
// branchId is implicit from the subcollection path
export interface Sale {
  id: string
  userId: string
  items: SaleItem[]
  subtotal: number
  discount: number
  tax: number
  total: number
  paymentMethod: PaymentMethod
  status: SaleStatus
  customerName?: string
  prescriptionNumber?: string
  createdAt: Date
}

export interface SaleItem {
  productId: string
  productName: string
  quantity: number
  unitPrice: number
  total: number
}

export type PaymentMethod = "cash" | "card" | "mobile"
export type SaleStatus = "completed" | "voided" | "pending"

// Cart Types (for POS)
export interface CartItem {
  product: Product
  quantity: number
  inventoryId: string
  availableStock: number
}

// Stock Transfer Types
export interface StockTransfer {
  id: string
  fromBranchId: string
  toBranchId: string
  productId: string
  quantity: number
  status: TransferStatus
  requestedBy: string
  approvedBy?: string
  createdAt: Date
  completedAt?: Date
}

export type TransferStatus = "pending" | "approved" | "completed" | "rejected"

// Analytics Types
export interface DailySales {
  date: string
  total: number
  transactionCount: number
}

export interface BranchSalesComparison {
  branchId: string
  branchName: string
  totalSales: number
  transactionCount: number
  averageTransaction: number
}

export interface TopProduct {
  productId: string
  productName: string
  totalQuantity: number
  totalRevenue: number
}

// Form Types
export interface LoginCredentials {
  email: string
  password: string
}

export interface ProductFormData {
  name: string
  genericName: string
  category: ProductCategory
  sku: string
  barcode: string
  unit: string
  price: number
  requiresPrescription: boolean
  description: string
  manufacturer: string
}

export interface InventoryFormData {
  productId: string
  quantity: number
  criticalLevel: number
  batchNumber: string
  expiryDate: Date
}
