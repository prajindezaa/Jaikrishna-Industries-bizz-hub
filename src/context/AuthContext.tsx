/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider, isFirebaseConfigured } from '../lib/firebase';
import { TeamMember, UserRoleLabel } from '../types';

// Default initial admin email
export const INITIAL_ADMIN_EMAIL = 'prajindezaa142@gmail.com';

export const INITIAL_ALLOWED_MEMBERS: Record<
  string,
  { role: 'admin' | 'sales_manager' | 'owner'; label: UserRoleLabel; name: string }
> = {
  'prajindezaa142@gmail.com': { role: 'admin', label: 'Admin', name: 'Prajin Dezaa' },
  'prajindezaa142@gamil.com': { role: 'admin', label: 'Admin', name: 'Prajin Dezaa' },
  'jaikrishnaindustries1@gmail.com': { role: 'sales_manager', label: 'Sales Manager', name: 'Sales Manager' },
  'srinisrkp@gmail.com': { role: 'owner', label: 'Owner', name: 'Srinivasan' },
};

interface AuthContextType {
  user: User | null;
  member: TeamMember | null;
  loading: boolean;
  error: string | null;
  isConfigured: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  registerEmailMember: (email: string, pass: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  member: null,
  loading: true,
  error: null,
  isConfigured: false,
  signInWithGoogle: async () => {},
  signInWithEmail: async () => {},
  registerEmailMember: async () => {},
  signOut: async () => {},
  clearError: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [member, setMember] = useState<TeamMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isConfigured = isFirebaseConfigured();

  const verifyAndSyncMember = async (currentUser: User): Promise<boolean> => {
    if (!currentUser.email) return false;
    const email = currentUser.email.trim().toLowerCase();

    // 1. Direct allowlist check or check allowed_emails in Firestore
    const predefinedMember = INITIAL_ALLOWED_MEMBERS[email];
    let isAllowed = Boolean(predefinedMember);

    if (!isAllowed && db) {
      try {
        const allowedDoc = await getDoc(doc(db, 'allowed_emails', email));
        if (allowedDoc.exists() && allowedDoc.data()?.allowed === true) {
          isAllowed = true;
        }
      } catch (err) {
        console.warn('Error checking Firestore allowed_emails, fallback to API:', err);
      }
    }

    // Secondary server check if needed
    if (!isAllowed) {
      try {
        const idToken = await currentUser.getIdToken();
        const res = await fetch('/api/verify-member', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
          },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        if (data.allowed) {
          isAllowed = true;
        }
      } catch {
        // network or server error
      }
    }

    if (!isAllowed) {
      if (auth) await firebaseSignOut(auth);
      setError(`Access Restricted: ${email} is not on the Jaikrishna Industries authorized 3-member allowlist.`);
      setUser(null);
      setMember(null);
      return false;
    }

    // 2. Fetch or initialize member profile
    let memberLabel: UserRoleLabel = predefinedMember ? predefinedMember.label : 'Sales Manager';
    let memberName = currentUser.displayName || (predefinedMember ? predefinedMember.name : email.split('@')[0]);
    let memberPhone = '';

    if (db) {
      try {
        const memberRef = doc(db, 'team_members', email);
        const memberSnap = await getDoc(memberRef);
        if (memberSnap.exists()) {
          const data = memberSnap.data();
          memberLabel = data.label || memberLabel;
          memberName = data.name || memberName;
          memberPhone = data.phone || memberPhone;
        } else {
          // Initialize member record
          await setDoc(memberRef, {
            id: email,
            email,
            name: memberName,
            label: memberLabel,
            phone: memberPhone,
            avatarUrl: currentUser.photoURL || '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        console.warn('Could not sync member doc:', err);
      }
    }

    setMember({
      id: email,
      email,
      name: memberName,
      label: memberLabel,
      phone: memberPhone,
      avatarUrl: currentUser.photoURL || undefined,
    });

    return true;
  };

  useEffect(() => {
    if (!isConfigured || !auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      setError(null);
      if (currentUser) {
        const valid = await verifyAndSyncMember(currentUser);
        if (valid) {
          setUser(currentUser);
        }
      } else {
        setUser(null);
        setMember(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isConfigured]);

  const signInWithGoogle = async () => {
    if (!auth || !googleProvider) {
      setError('Firebase Authentication is not configured yet.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        await verifyAndSyncMember(result.user);
      }
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      const code = err?.code || '';
      const message = err instanceof Error ? err.message : String(err);
      if (code === 'auth/unauthorized-domain' || message.includes('auth/unauthorized-domain')) {
        setError('AUTH_UNAUTHORIZED_DOMAIN');
      } else {
        setError(message || 'Failed to sign in with Google');
      }
    } finally {
      setLoading(false);
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    if (!auth) {
      setError('Firebase Authentication is not configured yet.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await signInWithEmailAndPassword(auth, email.trim(), pass);
      if (result.user) {
        await verifyAndSyncMember(result.user);
      }
    } catch (err: unknown) {
      console.error('Email sign-in error:', err);
      const msg = err instanceof Error ? err.message : 'Invalid email or password';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const registerEmailMember = async (email: string, pass: string) => {
    if (!auth) {
      setError('Firebase Authentication is not configured yet.');
      return;
    }
    const cleanEmail = email.trim().toLowerCase();

    // Verify against 3-member allowlist
    let isAllowed = Boolean(INITIAL_ALLOWED_MEMBERS[cleanEmail]);
    if (!isAllowed && db) {
      try {
        const allowedDoc = await getDoc(doc(db, 'allowed_emails', cleanEmail));
        if (allowedDoc.exists() && allowedDoc.data()?.allowed === true) {
          isAllowed = true;
        }
      } catch (err) {
        console.warn('Error checking allowed_emails:', err);
      }
    }
    if (!isAllowed) {
      setError(`Access Restricted: ${cleanEmail} is not on the Jaikrishna Industries authorized 3-member allowlist.`);
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const result = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
      if (result.user) {
        await verifyAndSyncMember(result.user);
      }
    } catch (err: any) {
      console.error('Register member error:', err);
      const code = err?.code;
      if (code === 'auth/email-already-in-use') {
        // Try sign-in if already registered
        try {
          const signInRes = await signInWithEmailAndPassword(auth, cleanEmail, pass);
          if (signInRes.user) {
            await verifyAndSyncMember(signInRes.user);
            return;
          }
        } catch {
          setError('This account already exists. Please sign in with your password.');
        }
      } else if (code === 'auth/weak-password') {
        setError('Password must be at least 6 characters.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to register account');
      }
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      if (user) {
        const idToken = await user.getIdToken();
        const { unregisterDeviceOnServer } = await import('../lib/fcm');
        await unregisterDeviceOnServer(idToken);
      }
    } catch (e) {
      console.warn('Could not unregister device during sign out:', e);
    }

    if (auth) {
      await firebaseSignOut(auth);
    }
    setUser(null);
    setMember(null);
    setError(null);
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        member,
        loading,
        error,
        isConfigured,
        signInWithGoogle,
        signInWithEmail,
        registerEmailMember,
        signOut,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  return useContext(AuthContext);
}
