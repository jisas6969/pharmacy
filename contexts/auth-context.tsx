"use client"

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react"
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"
import { auth, db, isFirebaseConfigured, ROOT_COLLECTIONS, BRANCH_SUBS } from "@/lib/firebase"
import type { User } from "@/lib/types"

interface AuthContextType {
  user: User | null
  firebaseUser: FirebaseUser | null
  loading: boolean
  error: string | null
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /**
   * 🔥 Two-step user profile fetch:
   *
   * 1. Read users/{uid} → get role, branchId, basic info
   * 2. If STAFF → read branches/{branchId}/users/{uid} → get full profile
   *    If ADMIN → use the mapping doc directly (no branch)
   */
  const fetchUserProfile = useCallback(async (uid: string): Promise<User | null> => {
    if (!db) return null

    try {
      // Step 1: Read lightweight mapping from users/{uid}
      const mappingDoc = await getDoc(doc(db, ROOT_COLLECTIONS.USERS, uid))

      if (!mappingDoc.exists()) {
        throw new Error("User record not found in Firestore")
      }

      const mapping = mappingDoc.data()
      const role = mapping.role
      const branchId = mapping.branchId || null

      // Step 2: Branch-specific profile for staff
      if (role === "staff" && branchId) {
        const profileDoc = await getDoc(
          doc(db, ROOT_COLLECTIONS.BRANCHES, branchId, BRANCH_SUBS.USERS, uid)
        )

        if (!profileDoc.exists()) {
          throw new Error("Staff profile not found in branch")
        }

        const profile = profileDoc.data()

        return {
          id: uid,
          email: profile.email || mapping.email,
          name: profile.name || mapping.name,
          role: profile.role || role,
          branchId,
          status: profile.status || mapping.status || "active",
          createdAt: profile.createdAt?.toDate ? profile.createdAt.toDate() : profile.createdAt,
          updatedAt: profile.updatedAt?.toDate ? profile.updatedAt.toDate() : profile.updatedAt,
        }
      }

      // Admin: use mapping doc directly (no branch assignment)
      return {
        id: uid,
        email: mapping.email,
        name: mapping.name,
        role: mapping.role,
        branchId: null,
        status: mapping.status || "active",
        createdAt: mapping.createdAt?.toDate ? mapping.createdAt.toDate() : mapping.createdAt,
        updatedAt: mapping.updatedAt?.toDate ? mapping.updatedAt.toDate() : mapping.updatedAt,
      }
    } catch (err) {
      console.error("Error fetching user profile:", err)
      return null
    }
  }, [])

  // 🔥 Auth listener
  useEffect(() => {
    if (!isFirebaseConfigured() || !auth) {
      setLoading(false)
      return
    }

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser)

      if (fbUser) {
        const profile = await fetchUserProfile(fbUser.uid)

        if (!profile) {
          setError("User profile missing in database")
          setUser(null)
        } else {
          setUser(profile)
        }
      } else {
        setUser(null)
      }

      setLoading(false)
    })

    return () => unsubscribe()
  }, [fetchUserProfile])

  // 🔐 Login
  const signIn = async (email: string, password: string) => {
    if (!auth) {
      setError("Firebase not configured")
      return
    }

    setError(null)
    setLoading(true)

    try {
      const result = await signInWithEmailAndPassword(auth, email, password)

      const profile = await fetchUserProfile(result.user.uid)

      if (!profile) {
        throw new Error("No user data found in Firestore")
      }

      setUser(profile)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed"
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // 🚪 Logout
  const signOut = async () => {
    if (!auth) return

    setError(null)

    try {
      await firebaseSignOut(auth)
      setUser(null)
      setFirebaseUser(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Logout failed"
      setError(message)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        loading,
        error,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return context
}