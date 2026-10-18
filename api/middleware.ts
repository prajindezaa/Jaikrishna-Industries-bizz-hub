/**
 * Jaikrishna Industries — Serverless API Security Middleware
 * Token verification, 3-member allowlist enforcement, and rate limiting.
 */

import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';

// Strict initial admin email
export const INITIAL_ADMIN_EMAIL = 'prajindezaa142@gmail.com';

/**
 * Normalizes Firebase Private Key to correctly handle Vercel line breaks (\n) and quotes
 */
export function formatPrivateKey(key?: string): string | undefined {
  if (!key) return undefined;
  // Replace literal '\n' characters with real newlines, and trim surrounding quotes
  return key.replace(/\\n/g, '\n').replace(/^["']|["']$/g, '').trim();
}

/**
 * Initializes Firebase Admin SDK singleton with proper private key formatting
 */
export function getFirebaseAdmin(): typeof admin {
  if (admin.apps.length === 0) {
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'jaikrishna-industries';
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = formatPrivateKey(process.env.FIREBASE_PRIVATE_KEY);

    if (clientEmail && privateKey) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      console.log('[Firebase Admin] Initialized with Service Account Credentials.');
    } else {
      // Initialize with Application Default Credentials (ADC) if available
      try {
        admin.initializeApp({ projectId });
        console.log('[Firebase Admin] Initialized with default ADC credentials.');
      } catch (err) {
        console.warn('[Firebase Admin] Notice: Service Account credentials not fully provided.', err);
      }
    }
  }
  return admin;
}

/**
 * In-Memory Sliding Window Rate Limiter
 * Protects serverless endpoints against abusive request volumes
 */
interface RateLimitBucket {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitBucket>();

export function createRateLimiter(options: { maxRequests: number; windowMs: number }) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Derive client IP or fallback
    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown-client';

    const now = Date.now();
    let bucket = rateLimitStore.get(clientIp);

    if (!bucket || now > bucket.resetTime) {
      bucket = { count: 1, resetTime: now + options.windowMs };
      rateLimitStore.set(clientIp, bucket);
      next();
      return;
    }

    bucket.count += 1;
    if (bucket.count > options.maxRequests) {
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please wait a moment before trying again.',
        retryAfterMs: Math.max(0, bucket.resetTime - now),
      });
      return;
    }

    next();
  };
}

export interface AuthenticatedRequest extends Request {
  user?: admin.auth.DecodedIdToken;
  memberEmail?: string;
}

/**
 * Strict Firebase ID Token Authentication Middleware
 * Enforces valid Firebase JWT and membership in the 3-member allowlist
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Valid Firebase Authorization header (Bearer <token>) is required.',
    });
    return;
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    res.status(401).json({ error: 'Unauthorized', message: 'Bearer token string is empty.' });
    return;
  }

  try {
    const adminSdk = getFirebaseAdmin();
    const decodedToken = await adminSdk.auth().verifyIdToken(token);
    const email = decodedToken.email?.trim().toLowerCase();

    if (!email) {
      res.status(403).json({ error: 'Forbidden', message: 'Authenticated user has no verified email address.' });
      return;
    }

    // Verify 3-member allowlist membership
    let isAllowed = email === INITIAL_ADMIN_EMAIL.toLowerCase();

    if (!isAllowed) {
      try {
        const allowedDoc = await adminSdk.firestore().collection('allowed_emails').doc(email).get();
        if (allowedDoc.exists && allowedDoc.data()?.allowed === true) {
          isAllowed = true;
        }
      } catch (err) {
        console.warn('[requireAuth] Could not check allowed_emails collection:', err);
      }
    }

    if (!isAllowed) {
      res.status(403).json({
        error: 'Access Restricted',
        message: `User ${email} is not on the Jaikrishna Industries authorized team allowlist.`,
      });
      return;
    }

    req.user = decodedToken;
    req.memberEmail = email;
    next();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(401).json({
      error: 'Invalid Token',
      message: 'Firebase token verification failed. Please re-authenticate.',
      details: message,
    });
  }
}
