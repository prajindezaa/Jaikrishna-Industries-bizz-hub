import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

import { getFirebaseAdmin } from './api/middleware';

async function main() {
  console.log('Connecting to Firebase Admin SDK...');
  const adminSdk = getFirebaseAdmin();
  const db = adminSdk.firestore();

  const members = [
    {
      email: 'prajindezaa142@gmail.com',
      name: 'Prajin Dezaa',
      label: 'Admin' as const,
      role: 'admin',
    },
    {
      email: 'prajindezaa142@gamil.com', // support typo entry
      name: 'Prajin Dezaa',
      label: 'Admin' as const,
      role: 'admin',
    },
    {
      email: 'jaikrishnaindustries1@gmail.com',
      name: 'Sales Manager',
      label: 'Sales Manager' as const,
      role: 'sales_manager',
    },
    {
      email: 'srinisrkp@gmail.com',
      name: 'Srinivasan',
      label: 'Owner' as const,
      role: 'owner',
    },
  ];

  console.log('\n--- 1. Syncing allowed_emails collection ---');
  for (const m of members) {
    const docRef = db.collection('allowed_emails').doc(m.email.toLowerCase());
    await docRef.set(
      {
        email: m.email.toLowerCase(),
        name: m.name,
        role: m.role,
        label: m.label,
        allowed: true,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    console.log(`✓ allowed_emails/${m.email} synced`);
  }

  console.log('\n--- 2. Syncing team_members collection ---');
  for (const m of members) {
    const docRef = db.collection('team_members').doc(m.email.toLowerCase());
    await docRef.set(
      {
        id: m.email.toLowerCase(),
        email: m.email.toLowerCase(),
        name: m.name,
        label: m.label,
        role: m.role,
        phone: '',
        notificationPreferences: {
          channels: {
            inApp: true,
            push: true,
            email: true,
          },
          types: {
            perTask: true,
            taskUncompleted: true,
            taskNotCreated: true,
            planningNotDone: true,
            followUpDue: true,
            missedTaskAlert: true,
          },
          quietHours: {
            enabled: false,
            start: '21:00',
            end: '08:00',
          },
          dailyEmailCap: 5,
        },
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    console.log(`✓ team_members/${m.email} synced`);
  }

  console.log('\n--- 3. Updating Rule 7 Morning Plan memberSettings in Firestore ---');
  const rule7Ref = db.collection('automation_rules').doc('rule_7_morning_plan');
  const rule7Snap = await rule7Ref.get();
  const currentParams = rule7Snap.exists ? rule7Snap.data()?.parameters || {} : {};

  const updatedMemberSettings = {
    'prajindezaa142@gmail.com': {
      enabled: true,
      deliveryTime: '08:00',
      channels: { push: true, inApp: true, email: true },
      sendIfEmpty: true,
    },
    'jaikrishnaindustries1@gmail.com': {
      enabled: true,
      deliveryTime: '08:00',
      channels: { push: true, inApp: true, email: true },
      sendIfEmpty: true,
    },
    'srinisrkp@gmail.com': {
      enabled: true,
      deliveryTime: '08:00',
      channels: { push: true, inApp: true, email: true },
      sendIfEmpty: true,
    },
  };

  await rule7Ref.set(
    {
      parameters: {
        ...currentParams,
        maxLatenessMinutes: 120,
        lookaheadFestivalDays: 7,
        memberSettings: updatedMemberSettings,
      },
      updatedAt: new Date().toISOString(),
      updatedBy: 'system-sync',
    },
    { merge: true }
  );
  console.log('✓ rule_7_morning_plan parameters updated with all 3 team members!');

  console.log('\n--- 4. Verification Check ---');
  const allAllowed = await db.collection('allowed_emails').get();
  console.log(`Total allowed_emails: ${allAllowed.size}`);
  allAllowed.forEach((d) => console.log(` - ${d.id}:`, d.data().role, `(${d.data().label})`));

  const allTeam = await db.collection('team_members').get();
  console.log(`Total team_members: ${allTeam.size}`);
  allTeam.forEach((d) => console.log(` - ${d.id}:`, d.data().name, `(${d.data().label})`));

  console.log('\nALL 3 TEAM MEMBERS SUCCESSFULLY REGISTERED IN FIRESTORE!');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error during sync:', err);
    process.exit(1);
  });
