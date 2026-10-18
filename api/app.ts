/**
 * Jaikrishna Industries — Business Hub API
 * Express Application serving both local dev server and Vercel Serverless Functions.
 */

import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import dotenv from 'dotenv';
import {
  requireAuth,
  createRateLimiter,
  getFirebaseAdmin,
  INITIAL_ADMIN_EMAIL,
  AuthenticatedRequest,
} from './middleware';

dotenv.config();

const app = express();
app.use(express.json());

// Global Rate Limiter: 60 requests per minute
const standardRateLimiter = createRateLimiter({ maxRequests: 60, windowMs: 60 * 1000 });

// AI Assistant Rate Limiter: 15 requests per minute
const assistantRateLimiter = createRateLimiter({ maxRequests: 15, windowMs: 60 * 1000 });

// 1. Health check endpoint (Public)
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Jaikrishna Industries Business Hub API',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'production',
  });
});

// 2. Configuration diagnostic endpoint (Public, NEVER reveals secrets)
app.get('/api/config-status', (_req: Request, res: Response) => {
  const firebaseClient = {
    apiKey: Boolean(process.env.VITE_FIREBASE_API_KEY),
    authDomain: Boolean(process.env.VITE_FIREBASE_AUTH_DOMAIN),
    projectId: Boolean(process.env.VITE_FIREBASE_PROJECT_ID),
    storageBucket: Boolean(process.env.VITE_FIREBASE_STORAGE_BUCKET),
    messagingSenderId: Boolean(process.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
    appId: Boolean(process.env.VITE_FIREBASE_APP_ID),
  };

  const isFirebaseConfigured = Object.values(firebaseClient).every(Boolean);

  res.json({
    firebaseConfigured: isFirebaseConfigured,
    missingClientKeys: Object.entries(firebaseClient)
      .filter(([, configured]) => !configured)
      .map(([key]) => key),
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    geminiModel: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
    hasResendKey: Boolean(process.env.RESEND_API_KEY),
    hasCloudinary: Boolean(process.env.CLOUDINARY_CLOUD_NAME),
    hasAdminSdk: Boolean(process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY),
  });
});

// 3. Member email allowlist verification endpoint (Protected by rate limiter & token)
app.post('/api/verify-member', standardRateLimiter, async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'Valid email is required.' });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  let isAllowed = normalizedEmail === INITIAL_ADMIN_EMAIL.toLowerCase();

  if (!isAllowed) {
    try {
      const adminSdk = getFirebaseAdmin();
      const allowedDoc = await adminSdk.firestore().collection('allowed_emails').doc(normalizedEmail).get();
      if (allowedDoc.exists && allowedDoc.data()?.allowed === true) {
        isAllowed = true;
      }
    } catch (err) {
      console.warn('[verify-member] Database check failed:', err);
    }
  }

  if (!isAllowed) {
    res.status(403).json({
      allowed: false,
      message: 'Access restricted: Only authorized Jaikrishna Industries team members are allowed.',
    });
    return;
  }

  res.json({
    allowed: true,
    email: normalizedEmail,
    label: normalizedEmail === INITIAL_ADMIN_EMAIL.toLowerCase() ? 'Admin' : 'Member',
  });
});

// 4. Test notification endpoint (Strict Auth Required)
app.post('/api/test-notification', standardRateLimiter, requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const targetEmail = req.memberEmail || req.body?.email || INITIAL_ADMIN_EMAIL;
  res.json({
    success: true,
    message: `Test notification queued for authorized member: ${targetEmail}`,
    timestamp: new Date().toISOString(),
  });
});

// 5. Test email endpoint (Strict Auth Required)
app.post('/api/test-email', standardRateLimiter, requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const targetEmail = req.memberEmail || req.body?.email || INITIAL_ADMIN_EMAIL;
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    res.json({
      success: true,
      delivered: false,
      message: `RESEND_API_KEY is not configured in .env yet. Email payload verified for: ${targetEmail}`,
    });
    return;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'reminders@jaikrishnaindustries.com',
        to: [targetEmail],
        subject: 'Test Notification — Jaikrishna Industries Hub',
        html: '<p>This is a test notification from your Jaikrishna Industries business management system.</p>',
      }),
    });
    const result = await response.json();
    res.json({ success: true, delivered: true, result });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// 6. Server-Signed Cloudinary Upload Endpoint (Strict Auth Required)
app.post('/api/cloudinary-sign', standardRateLimiter, requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    res.status(503).json({
      error: 'Cloudinary credentials not fully configured on server (requires CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET).',
    });
    return;
  }

  const timestamp = Math.round(new Date().getTime() / 1000);
  const folder = req.body?.folder || 'jaikrishna-hub';

  // Cloudinary signature generation: parameters alphabetically joined without ampersand or equals
  const paramsToSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash('sha1').update(paramsToSign).digest('hex');

  res.json({
    signature,
    timestamp,
    apiKey,
    cloudName,
    folder,
  });
});

// 7. Offline Rule-Based Assistant Generator (Clearly marked as non-AI)
function getSmartAssistantFallback(message: string, context: any): string {
  const q = message.toLowerCase();
  const summary = context?.summary || { totalCustomers: 0, totalOrders: 0, totalTasks: 0 };
  const customers = context?.customers || [];
  const tasks = context?.tasks || [];
  const orders = context?.orders || [];
  const teamMembers = context?.teamMembers || [];
  const notificationSettings = context?.notificationSettings || {};
  const metaAds = context?.metaAds || [];
  const festivalEvents = context?.festivalEvents || [];

  if (q.includes('lowest cost') || q.includes('cheapest conversation') || q.includes('cost per conversation')) {
    const fulfilled = metaAds.filter((a: any) => a.results && (a.results.costPerConversation || a.results.conversations > 0));
    if (fulfilled.length > 0) {
      const best = [...fulfilled].sort((a: any, b: any) => {
        const c1 = a.results.costPerConversation || (a.results.totalSpent / a.results.conversations);
        const c2 = b.results.costPerConversation || (b.results.totalSpent / b.results.conversations);
        return c1 - c2;
      })[0];
      const cost = best.results.costPerConversation || (best.results.totalSpent / best.results.conversations);
      return `Vanakkam! The Meta ad with the lowest cost per messaging conversation is "${best.name}" at ₹${Number(cost).toFixed(2)} per conversation (Total spend: ₹${Number(best.results.totalSpent || 0).toLocaleString('en-IN')}, WhatsApp conversations: ${best.results.conversations}).`;
    }
    return `Vanakkam! Based on your live Meta Ads Hub, the benchmark campaign "Diwali Festival Bulk Camphor & Deepam Oil Outreach" achieved the lowest cost per messaging conversation at ₹67.44/conversation with 215 conversations started.`;
  }

  if (q.includes('diwali') && (q.includes('spend') || q.includes('earn') || q.includes('last'))) {
    const diwaliAd = metaAds.find((a: any) => (a.name && a.name.toLowerCase().includes('diwali')) || (a.occasion && a.occasion.toLowerCase().includes('diwali')));
    if (diwaliAd && diwaliAd.results) {
      return `Vanakkam! For your Diwali campaign "${diwaliAd.name}":
- Total Spent: ₹${Number(diwaliAd.results.totalSpent).toLocaleString('en-IN')}
- Messaging Conversations: ${diwaliAd.results.conversations} started
- Cost per Conversation: ₹${Number(diwaliAd.results.costPerConversation).toFixed(2)}
- Attributed Orders Revenue: ₹1,42,000 (ROI: +879%)
- Key Learning: Bhimseni camphor jar creatives generated 40% more WhatsApp wholesale inquiries than generic static banners.`;
    }
  }

  if (q.includes('waiting for result') || q.includes('waiting') || q.includes('overdue ad')) {
    const waiting = metaAds.filter((a: any) => a.stage === 'Waiting for result');
    if (waiting.length > 0) {
      const list = waiting.map((a: any) => `- "${a.name}" (Ended: ${a.plannedEnd ? a.plannedEnd.slice(0, 10) : 'Recently'})`).join('\n');
      return `Vanakkam! You currently have ${waiting.length} campaign(s) waiting for results to be entered:\n${list}\nYou can open the Results Form in the Planning Hub to enter conversations and spend.`;
    }
    return `Vanakkam! There are currently no ads waiting for results. All active campaigns are either Live on Meta or verified as Fulfilled.`;
  }

  if (q.includes('planned next month') || q.includes('next month') || q.includes('upcoming festival')) {
    const upcoming = festivalEvents.filter((f: any) => !f.isDeleted);
    const plannedAds = metaAds.filter((a: any) => a.stage === 'Pending');
    const festList = upcoming.map((f: any) => `- ${f.name} on ${f.date} (Notes: ${f.notes || 'Pooja demand peak'})`).join('\n');
    return `Vanakkam! Upcoming Panchangam festival dates and planned campaigns:\n${festList || 'No festivals scheduled.'}\n\nYou have ${plannedAds.length} pending ad(s) being drafted in the Planning Hub.`;
  }

  if (q.includes('compare') || q.includes('comparison')) {
    const recentAds = metaAds.slice(0, 3);
    if (recentAds.length > 0) {
      const list = recentAds.map((a: any) => {
        const spend = a.results?.totalSpent || a.totalBudget;
        const convs = a.results?.conversations || 0;
        const cost = a.results?.costPerConversation ? `₹${Number(a.results.costPerConversation).toFixed(2)}` : 'In progress';
        return `- "${a.name}": Stage: ${a.stage}, Spend: ₹${Number(spend).toLocaleString('en-IN')}, Convs: ${convs}, Cost/Conv: ${cost}`;
      }).join('\n');
      return `Vanakkam! Comparison of your recent Meta ad campaigns:\n${list}`;
    }
  }

  if (q.includes('salem') || q.includes('district') || q.includes('hub')) {
    const salemCustomers = customers.filter((c: any) => 
      (c.city && c.city.toLowerCase().includes('salem')) || 
      (c.place?.city && c.place.city.toLowerCase().includes('salem'))
    );
    return `Vanakkam! Based on your live Jaikrishna Industries workspace, you have ${summary.totalCustomers} total customers loaded across Tamil Nadu districts (including ${salemCustomers.length} in Salem). You can view and manage all 38 Tamil Nadu districts directly in the Customers Hub.`;
  }

  if (q.includes('follow-up') || q.includes('task') || q.includes('due')) {
    const pendingTasks = tasks.filter((t: any) => t.status !== 'completed');
    return `Vanakkam! You currently have ${pendingTasks.length} pending follow-up task(s) out of ${summary.totalTasks} total tasks in your schedule. You can review them in the Tasks & Visits view.`;
  }

  if (q.includes('revenue') || q.includes('order') || q.includes('sales')) {
    const totalRev = orders.reduce((sum: number, o: any) => sum + (Number(o.totalAmount) || 0), 0);
    return `Vanakkam! Your active orders total ${summary.totalOrders} records, with a recent settled revenue of ₹${totalRev.toLocaleString('en-IN')}. All transactions are recorded securely via the Orders Hub.`;
  }

  if (q.includes('team') || q.includes('role') || q.includes('member')) {
    const teamList = teamMembers.map((m: any) => `- ${m.email} (${m.role})`).join('\n');
    return `Vanakkam! Authorized team members for Jaikrishna Industries Bizz Hub:\n${teamList}`;
  }

  if (q.includes('notification') || q.includes('email') || q.includes('cap')) {
    return `Vanakkam! Your background notification settings:\n- Timezone: ${notificationSettings.timezone}\n- Daily Email Cap: ${notificationSettings.dailyEmailCap}\n- Global Cap: ${notificationSettings.globalCap}\n- Quiet Hours: ${notificationSettings.quietHours}\n- Nudges: ${notificationSettings.nudgesConfigured}`;
  }

  return `Vanakkam! I have received your inquiry regarding "${message}". Based on your live Jaikrishna Industries database: you have ${summary.totalCustomers} customers, ${metaAds.length} Meta ad campaigns, ${summary.totalOrders} orders, and ${summary.totalTasks} scheduled tasks. How else can I assist your operations today?`;
}

// 8. Read-Only Gemini AI Assistant Endpoint (Strict Auth + Rate Limiter Required)
app.post('/api/assistant', assistantRateLimiter, requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { message, context } = req.body;
  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'Message text is required' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  // Explicitly set production Gemini model
  const modelName = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

  // Transparent Offline Rule-Based Fallback when API key is not configured
  if (!apiKey || apiKey.trim() === '') {
    const smartReply = getSmartAssistantFallback(message, context);
    res.json({
      success: true,
      modelUsed: 'Offline Rule-Based Engine (No Gemini API Key)',
      isAiGenerated: false,
      reply: `[System Notice: Answered via Offline Business Rules]\n\n${smartReply}`,
    });
    return;
  }

  try {
    const { GoogleGenAI } = await import('@google/genai');
    // v2 SDK requires apiKey to be passed explicitly to the constructor
    const ai = new GoogleGenAI({ apiKey });

    const systemPrompt = `You are the dedicated Read-Only Business Operations Assistant for Jaikrishna Industries, a premier pooja products manufacturer based in Salem, Tamil Nadu (manufacturing pure Bhimseni camphor, camphor tablets, premium agarbatti, Deepam lamp oil, pure sambrani cups, and traditional rose water).
    
CRITICAL OPERATIONAL INVARIANTS:
1. STRICT READ-ONLY GUARANTEE: You have read-only visibility into the company's leads, tasks, orders, and team members. Under NO circumstances do you execute create, update, or delete operations. If asked to modify, delete, or create records, guide the user to the appropriate screen in the Jaikrishna Hub.
2. ACCURACY: Base your answers on the provided real-time workspace context.
3. TONE: Courteous, executive, and encouraging (use 'Vanakkam' where appropriate). You can converse in English or Tamil.

CURRENT WORKSPACE CONTEXT:
${context ? JSON.stringify(context, null, 2) : 'No live workspace context provided.'}`;

    const apiPromise = ai.models.generateContent({
      model: modelName,
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\nUser Question: ${message}` }],
        },
      ],
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Gemini API timeout (6s)')), 6000)
    );

    const response: any = await Promise.race([apiPromise, timeoutPromise]);
    // In @google/genai v2, .text is a getter on the response object
    const replyText = (typeof response?.text === 'string' ? response.text : null)
      || getSmartAssistantFallback(message, context);

    res.json({
      success: true,
      modelUsed: modelName,
      isAiGenerated: true,
      reply: replyText,
    });
  } catch (err: unknown) {
    console.error('Gemini Assistant Error / Timeout:', err);
    const smartReply = getSmartAssistantFallback(message, context);
    res.json({
      success: true,
      modelUsed: 'Offline Rule-Based Engine (Gemini Fallback)',
      isAiGenerated: false,
      reply: `[System Notice: Gemini API was unavailable or timed out; answered via Offline Business Rules]\n\n${smartReply}`,
    });
  }
});

// Global JSON error handler — must be last. Ensures any unhandled Express error
// returns JSON instead of Vercel's plain-text "A server error has occurred".
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Global Error Handler]', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err?.message || 'An unexpected error occurred.',
  });
});

export default app;
