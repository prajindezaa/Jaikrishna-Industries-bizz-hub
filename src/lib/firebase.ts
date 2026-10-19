/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, Firestore, connectFirestoreEmulator } from 'firebase/firestore';

export interface FirebaseClientConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : (process.env as any || {});

export const firebaseConfig: FirebaseClientConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: env.VITE_FIREBASE_APP_ID || '',
};

export function getMissingFirebaseKeys(): string[] {
  // If explicitly connecting to emulators in dev mode, standard dummy project ID is acceptable
  if (env.DEV && env.VITE_USE_EMULATORS === 'true') {
    return [];
  }

  const keys: (keyof FirebaseClientConfig)[] = [
    'apiKey',
    'authDomain',
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId',
  ];
  return keys.filter((k) => !firebaseConfig[k] || firebaseConfig[k]?.trim() === '' || firebaseConfig[k]?.startsWith('AIzaSy_REPLACE'));
}

export function isFirebaseConfigured(): boolean {
  if (env.DEV && env.VITE_USE_EMULATORS === 'true') {
    return true;
  }
  return getMissingFirebaseKeys().length === 0;
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let googleProvider: GoogleAuthProvider | null = null;

if (isFirebaseConfigured()) {
  try {
    const activeConfig = (env.DEV && env.VITE_USE_EMULATORS === 'true')
      ? {
          apiKey: firebaseConfig.apiKey || 'fake-api-key-for-emulator',
          authDomain: 'localhost',
          projectId: env.VITE_FIREBASE_PROJECT_ID || 'jaikrishna-industries-dev',
          storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'jaikrishna-industries-dev.appspot.com',
          messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1234567890',
          appId: env.VITE_FIREBASE_APP_ID || '1:1234567890:web:abcdef',
        }
      : (firebaseConfig as Record<string, string>);

    app = getApps().length === 0 ? initializeApp(activeConfig) : getApps()[0];
    auth = getAuth(app);
    db = getFirestore(app);
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: 'select_account' });

    // ONLY in development mode and ONLY if VITE_USE_EMULATORS === 'true'
    if (env.DEV && env.VITE_USE_EMULATORS === 'true') {
      console.log('⚡ [Firebase Dev] Connecting to local Firebase Emulators (Auth :9099, Firestore :8080)...');
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      connectFirestoreEmulator(db, '127.0.0.1', 8080);
    }
  } catch (error) {
    console.error('Failed to initialize Firebase SDK:', error);
  }
}

export { app, auth, db, googleProvider };
