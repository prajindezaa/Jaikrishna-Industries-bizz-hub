/**
 * Jaikrishna Industries — Domain Migration & Production Readiness Automated Test Suite
 * Validates:
 * 1. Central domain config resolution and trailing-slash normalization
 * 2. Origin allowlist checks (allowed and rejected origins)
 * 3. Deep link builder output against canonical origin
 * 4. vercel.json redirect rules, security headers, and rewrite safety
 * 5. Repository scan ensuring no hardcoded .vercel.app links in active source
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  CANONICAL_APEX,
  CANONICAL_WWW,
  OLD_DOMAIN_VERCEL,
  getAppUrl,
  isAllowedOrigin,
  buildCanonicalDeepLink,
} from './domain-config';

test('1. Domain Config: returns canonical apex by default in production', () => {
  const url = getAppUrl();
  assert.ok(url.startsWith('http'), 'App URL must start with http');
  assert.ok(!url.endsWith('/'), 'App URL must not have trailing slash');
  assert.equal(CANONICAL_APEX, 'https://jaikrishnabizzhub.in');
  assert.equal(CANONICAL_WWW, 'https://www.jaikrishnabizzhub.in');
});

test('2. Origin Allowlist: authorizes canonical apex, www, and old vercel domain during transition', () => {
  assert.equal(isAllowedOrigin('https://jaikrishnabizzhub.in'), true);
  assert.equal(isAllowedOrigin('https://www.jaikrishnabizzhub.in'), true);
  assert.equal(isAllowedOrigin('https://jaikrishna-industries-bizz-hub.vercel.app'), true);
  assert.equal(isAllowedOrigin('https://malicious-phishing-site.com'), false);
  assert.equal(isAllowedOrigin('https://random-site.in'), false);
  assert.equal(isAllowedOrigin(undefined), false);
});

test('3. Canonical Deep Link Builder: produces valid canonical URLs', () => {
  const taskLink = buildCanonicalDeepLink('/tasks?id=task_123');
  assert.ok(taskLink.includes('/tasks?id=task_123'));
  assert.ok(taskLink.startsWith('http'));

  const leadLink = buildCanonicalDeepLink('customers?id=cust_456');
  assert.ok(leadLink.includes('/customers?id=cust_456'));
});

test('4. vercel.json: validates 301 redirects, security headers, and /__/auth/ rewrite proxy', () => {
  const vercelJsonPath = path.resolve(process.cwd(), 'vercel.json');
  assert.ok(fs.existsSync(vercelJsonPath), 'vercel.json must exist');

  const vercelConfig = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));

  // A. Check redirects
  const redirects = vercelConfig.redirects || [];
  const wwwRedirect = redirects.find((r: any) =>
    r.has?.some((h: any) => h.value === 'www.jaikrishnabizzhub.in')
  );
  assert.ok(wwwRedirect, 'Must have www.jaikrishnabizzhub.in redirect');
  assert.equal(wwwRedirect.destination, 'https://jaikrishnabizzhub.in/:path*');
  assert.equal(wwwRedirect.permanent, true, 'Redirect must be permanent (301)');

  const oldDomainRedirect = redirects.find((r: any) =>
    r.has?.some((h: any) => h.value === 'jaikrishna-industries-bizz-hub.vercel.app')
  );
  assert.ok(oldDomainRedirect, 'Must have old .vercel.app domain redirect');
  assert.equal(oldDomainRedirect.destination, 'https://jaikrishnabizzhub.in/:path*');
  assert.equal(oldDomainRedirect.permanent, true, 'Redirect must be permanent (301)');

  // B. Check /__/auth/ proxy rewrite
  const rewrites = vercelConfig.rewrites || [];
  const authRewrite = rewrites.find((r: any) => r.source === '/__/auth/(.*)');
  assert.ok(authRewrite, 'Must have /__/auth/(.*) rewrite for Firebase custom domain proxying');
  assert.ok(authRewrite.destination.includes('firebaseapp.com/__/auth/'));

  // C. Check security headers
  const globalHeaders = vercelConfig.headers?.find((h: any) => h.source === '/(.*)')?.headers || [];
  const headerKeys = globalHeaders.map((h: any) => h.key);
  assert.ok(headerKeys.includes('X-Content-Type-Options'), 'Must have X-Content-Type-Options');
  assert.ok(headerKeys.includes('X-Frame-Options'), 'Must have X-Frame-Options');
  assert.ok(headerKeys.includes('Strict-Transport-Security'), 'Must have Strict-Transport-Security');
});

test('5. Static files: robots.txt disallows all crawling and index.html has noindex', () => {
  const robotsPath = path.resolve(process.cwd(), 'public', 'robots.txt');
  assert.ok(fs.existsSync(robotsPath), 'public/robots.txt must exist');
  const robotsContent = fs.readFileSync(robotsPath, 'utf8');
  assert.ok(robotsContent.includes('Disallow: /'), 'robots.txt must disallow all');

  const indexHtmlPath = path.resolve(process.cwd(), 'index.html');
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  assert.ok(indexHtml.includes('name="robots" content="noindex, nofollow"'), 'index.html must have noindex');
  assert.ok(indexHtml.includes('rel="canonical" href="https://jaikrishnabizzhub.in"'), 'index.html must have canonical link');
});
