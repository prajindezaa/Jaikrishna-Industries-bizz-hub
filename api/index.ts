/**
 * Vercel Serverless Function Entrypoint
 * Handles all /api/* requests routed through vercel.json
 */

import app from './app';

export default function handler(req: any, res: any) {
  try {
    return app(req, res);
  } catch (error: any) {
    console.error('[Vercel Serverless Invocation Crash]', error);
    if (!res.headersSent) {
      return res.status(500).json({
        error: 'FUNCTION_INVOCATION_CRASH',
        message: error?.message || String(error),
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
      });
    }
  }
}

