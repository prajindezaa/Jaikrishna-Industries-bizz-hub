/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Jaikrishna Industries — Local Emulator Seed Script
 * Creates 3 TEST members and 3 TEST customers in the local emulator only.
 * No card or billing needed.
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

const app = initializeApp({ projectId: 'jaikrishna-industries-dev' });
const db = getFirestore(app);
const auth = getAuth(app);

async function seed() {
  console.log('🌱 Seeding local Firebase Emulator with 3 TEST members & 3 TEST customers...');

  // 1. Seed 3 TEST members (Equal privileges, allowlisted)
  const members = [
    { email: 'prajindezaa142@gmail.com', name: 'Prajin (Admin)', role: 'Admin' },
    { email: 'jaikrishnaindustries1@gmail.com', name: 'Sales Manager', role: 'Sales Manager' },
    { email: 'srinisrkp@gmail.com', name: 'Srini (Owner)', role: 'Owner' },
  ];

  for (const m of members) {
    // Create in Auth Emulator
    try {
      await auth.createUser({
        uid: m.email.replace(/[@.]/g, '_'),
        email: m.email,
        displayName: m.name,
        password: 'TestPassword123!',
      });
      console.log(`  ✓ Auth user created: ${m.email}`);
    } catch (e: any) {
      if (e.code === 'auth/uid-already-exists' || e.code === 'auth/email-already-exists') {
        console.log(`  - Auth user ${m.email} already exists`);
      } else {
        console.warn(`  ! Auth user ${m.email}:`, e.message);
      }
    }

    // Add to allowed_emails
    await db.collection('allowed_emails').doc(m.email).set({
      email: m.email,
      name: m.name,
      addedAt: new Date().toISOString(),
      role: m.role,
    });

    // Add to team_members
    await db.collection('team_members').doc(m.email.replace(/[@.]/g, '_')).set({
      email: m.email,
      displayName: m.name,
      role: m.role,
      notificationPreferences: {
        quietHours: { enabled: true, start: '21:00', end: '08:00' },
        morningPlanTime: '08:30',
      },
    });
  }

  // 2. Seed Default Automation Rules (Rule 1 & Rule 7 are OFF by default)
  await db.collection('automation_rules').doc('rule_1_auto_followup').set({
    id: 'rule_1_auto_followup',
    name: 'Auto Follow-up Tasks on Stage Change',
    enabled: false, // OFF by default
    previewOpened: false,
    dailyCap: 30,
    workingDays: [1, 2, 3, 4, 5, 6],
    parameters: {
      globalDailyCap: 60,
      skipOnImport: true,
      stages: {
        'Sample sent': { enabled: true, daysAfter: 2, taskType: 'Call', priority: 'High', titleTemplate: 'Call {customer} for sample feedback' },
        'Negotiation': { enabled: true, daysAfter: 1, taskType: 'Call', priority: 'High', titleTemplate: 'Negotiate pricing with {customer}' },
        'Interested': { enabled: true, daysAfter: 1, taskType: 'Call', priority: 'Medium', titleTemplate: 'Send price list to {customer}' },
      },
    },
    updatedAt: new Date().toISOString(),
  });

  await db.collection('automation_rules').doc('rule_7_morning_plan').set({
    id: 'rule_7_morning_plan',
    name: 'Daily Morning Plan Briefing',
    enabled: false, // OFF by default
    parameters: {
      maxLatenessMinutes: 120,
      memberSettings: {
        'prajindezaa142@gmail.com': { enabled: true, deliveryTime: '08:00', channels: { push: true, inApp: true, email: true }, sendIfEmpty: false },
        'jaikrishnaindustries1@gmail.com': { enabled: true, deliveryTime: '08:00', channels: { push: true, inApp: true, email: true }, sendIfEmpty: false },
        'srinisrkp@gmail.com': { enabled: true, deliveryTime: '08:00', channels: { push: true, inApp: true, email: true }, sendIfEmpty: false },
      },
    },
    updatedAt: new Date().toISOString(),
  });

  // 3. Seed 3 TEST Customers
  const now = new Date().toISOString();
  const testCustomers = [
    {
      id: 'TEST_CUST_1',
      companyName: 'TEST Madurai Cotton Mills',
      contactPerson: 'Karthik Raja',
      phone: '9842100001',
      whatsapp: '9842100001',
      leadStage: 'New',
      status: 'New customer',
      place: { city: 'Madurai', district: 'Madurai', state: 'Tamil Nadu' },
      assignedTo: 'prajindezaa142@gmail.com',
      lastWriteSource: 'manual_create',
      updatedBy: 'prajindezaa142@gmail.com',
      stageHistory: [{ from: 'New', to: 'New', changedBy: 'prajindezaa142@gmail.com', changedAt: now }],
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'TEST_CUST_2',
      companyName: 'TEST Coimbatore Textiles',
      contactPerson: 'Senthil Kumar',
      phone: '9842100002',
      whatsapp: '9842100002',
      leadStage: 'New',
      status: 'New customer',
      place: { city: 'Coimbatore', district: 'Coimbatore', state: 'Tamil Nadu' },
      assignedTo: 'jaikrishnaindustries1@gmail.com',
      lastWriteSource: 'manual_create',
      updatedBy: 'jaikrishnaindustries1@gmail.com',
      stageHistory: [{ from: 'New', to: 'New', changedBy: 'jaikrishnaindustries1@gmail.com', changedAt: now }],
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'TEST_CUST_3',
      companyName: 'TEST Tirupur Garments Hub',
      contactPerson: 'Muruganandam',
      phone: '9842100003',
      whatsapp: '9842100003',
      leadStage: 'Interested',
      status: 'New customer',
      place: { city: 'Tirupur', district: 'Tirupur', state: 'Tamil Nadu' },
      assignedTo: 'srinisrkp@gmail.com',
      lastWriteSource: 'manual_create',
      updatedBy: 'srinisrkp@gmail.com',
      stageHistory: [{ from: 'Interested', to: 'Interested', changedBy: 'srinisrkp@gmail.com', changedAt: now }],
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    },
  ];

  for (const c of testCustomers) {
    await db.collection('customers').doc(c.id).set(c);
    console.log(`  ✓ Customer created: ${c.companyName} (${c.id})`);
  }

  console.log('✅ Seeding complete! 3 TEST members and 3 TEST customers ready in emulator.');
}

seed().catch((err) => {
  console.error('Seeding error:', err);
  process.exit(1);
});
