// lib/firestore.ts
// All Firestore operations are now branch-scoped via subcollections.

import {
  addDoc,
  serverTimestamp,
  getDocs,
  updateDoc,
  doc,
} from "firebase/firestore"
import { db, branchCollection, ROOT_COLLECTIONS, BRANCH_SUBS } from "@/lib/firebase"

//
// 🔹 ADD PRODUCT (to a specific branch)
//
export const addProduct = async (branchId: string, productData: any) => {
  if (!db) throw new Error("Firestore not initialized")

  return await addDoc(branchCollection(branchId, BRANCH_SUBS.PRODUCTS), {
    ...productData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

//
// 🔹 ADD INVENTORY (to a specific branch)
//
export const addInventory = async (branchId: string, data: {
  productId: string
  quantity: number
  criticalLevel?: number
  batchNumber?: string
  expiryDate?: any
}) => {
  if (!db) throw new Error("Firestore not initialized")

  return await addDoc(branchCollection(branchId, BRANCH_SUBS.INVENTORY), {
    productId: data.productId,
    quantity: data.quantity,
    criticalLevel: data.criticalLevel ?? 10,
    batchNumber: data.batchNumber ?? "",
    expiryDate: data.expiryDate ?? null,
    lastRestocked: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

//
// 🔹 UPDATE INVENTORY STOCK (within a specific branch)
//
export const updateInventoryStock = async (
  branchId: string,
  inventoryId: string,
  newQuantity: number
) => {
  if (!db) throw new Error("Firestore not initialized")

  return await updateDoc(
    doc(db, ROOT_COLLECTIONS.BRANCHES, branchId, BRANCH_SUBS.INVENTORY, inventoryId),
    {
      quantity: newQuantity,
      updatedAt: serverTimestamp(),
    }
  )
}

//
// 🔹 GET INVENTORY FOR A BRANCH (reads the entire subcollection)
//
export const getInventoryByBranch = async (branchId: string) => {
  if (!db) throw new Error("Firestore not initialized")

  const snapshot = await getDocs(branchCollection(branchId, BRANCH_SUBS.INVENTORY))

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }))
}