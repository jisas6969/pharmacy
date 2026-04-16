// lib/firestore.ts

import {
  addDoc,
  collection,
  serverTimestamp,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
} from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"

//
// 🔹 ADD PRODUCT (CATALOG ONLY)
//
export const addProduct = async (productData: any) => {
  if (!db) throw new Error("Firestore not initialized")

  return await addDoc(collection(db, COLLECTIONS.PRODUCTS), {
    ...productData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

//
// 🔹 ADD INVENTORY (STOCK PER BRANCH)
//
export const addInventory = async (data: {
  productId: string
  branchId: string
  quantity: number
  criticalLevel?: number
  batchNumber?: string
  expiryDate?: any
}) => {
  if (!db) throw new Error("Firestore not initialized")

  return await addDoc(collection(db, COLLECTIONS.INVENTORY), {
    productId: data.productId,
    branchId: data.branchId,
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
// 🔹 UPDATE INVENTORY (USED AFTER SALE)
//
export const updateInventoryStock = async (
  inventoryId: string,
  newQuantity: number
) => {
  if (!db) throw new Error("Firestore not initialized")

  return await updateDoc(doc(db, COLLECTIONS.INVENTORY, inventoryId), {
    quantity: newQuantity,
    updatedAt: serverTimestamp(),
  })
}

//
// 🔹 GET INVENTORY PER BRANCH
//
export const getInventoryByBranch = async (branchId: string) => {
  if (!db) throw new Error("Firestore not initialized")

  const snapshot = await getDocs(
    query(
      collection(db, COLLECTIONS.INVENTORY),
      where("branchId", "==", branchId)
    )
  )

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }))
}