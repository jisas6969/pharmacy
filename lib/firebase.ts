import { initializeApp, getApps, FirebaseApp } from "firebase/app"
import { getAuth, Auth } from "firebase/auth"
import { getFirestore, Firestore, collection, CollectionReference } from "firebase/firestore"

// Firebase configuration - you'll need to add these environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

// Initialize Firebase
let app: FirebaseApp
let auth: Auth
let db: Firestore

// Check if Firebase is configured
export const isFirebaseConfigured = (): boolean => {
  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  )
}

if (typeof window !== "undefined" && isFirebaseConfigured()) {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig)
  } else {
    app = getApps()[0]
  }
  auth = getAuth(app)
  db = getFirestore(app)
}

export { app, auth, db }

// ─── Top-level collection names ───
export const ROOT_COLLECTIONS = {
  USERS: "users",       // auth mapping: users/{uid}
  BRANCHES: "branches", // branch docs: branches/{branchId}
} as const

// ─── Branch subcollection names ───
export const BRANCH_SUBS = {
  USERS: "users",
  PRODUCTS: "products",
  INVENTORY: "inventory",
  SALES: "sales",
} as const

/**
 * Get a reference to a branch subcollection.
 * Usage: branchCollection("branchXYZ", "products")
 *        → collection(db, "branches", "branchXYZ", "products")
 */
export function branchCollection(branchId: string, subcollection: string): CollectionReference {
  if (!db) throw new Error("Firestore not initialized")
  return collection(db, ROOT_COLLECTIONS.BRANCHES, branchId, subcollection)
}
