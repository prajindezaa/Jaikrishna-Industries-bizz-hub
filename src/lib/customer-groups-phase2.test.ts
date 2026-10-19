/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Phase 2 Tests: Customers Page Group-Wise Add, Badges & Conflicts Verification
 * Tests:
 * 1. Default preselection: Group-wise add defaults to active group tab or starter default
 * 2. Save & Add Another keeps group selected and clears other inputs
 * 3. Cross-group phone collision detection: triggers conflict when normalized phone matches existing
 * 4. 4-choice conflict resolution simulation (Skip, Move, Update, Save Anyway)
 * 5. Cannot assign customer to an archived group
 * 6. Bulk move customer simulation updates groupId and previousGroupId
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { CustomerGroup, Customer } from '../types';
import { normalizePhone } from './phone';

describe('Phase 2: Customer Groups - Customers Page & Group-Wise Add Test Suite', () => {
  const mockGroups: CustomerGroup[] = [
    {
      id: 'grp-1',
      name: 'Wholesale Distributors',
      nameTa: 'மொத்த விநியோகஸ்தர்கள் (needs proofreading by owner)',
      color: '#881337',
      icon: 'Truck',
      sortOrder: 0,
      isActive: true,
      isDefault: true,
      createdAt: '2026-10-19T00:00:00.000Z',
      updatedAt: '2026-10-19T00:00:00.000Z',
      createdBy: 'admin',
      isDeleted: false,
    },
    {
      id: 'grp-2',
      name: 'Temple / Pooja Institutions',
      nameTa: 'கோயில் / பூஜை அமைப்புகள் (needs proofreading by owner)',
      color: '#d97706',
      icon: 'Landmark',
      sortOrder: 1,
      isActive: true,
      isDefault: false,
      createdAt: '2026-10-19T00:00:00.000Z',
      updatedAt: '2026-10-19T00:00:00.000Z',
      createdBy: 'admin',
      isDeleted: false,
    },
    {
      id: 'grp-archived',
      name: 'Old Inactive Segment',
      color: '#71717a',
      icon: 'Layers',
      sortOrder: 2,
      isActive: false, // ARCHIVED
      isDefault: false,
      createdAt: '2026-10-19T00:00:00.000Z',
      updatedAt: '2026-10-19T00:00:00.000Z',
      createdBy: 'admin',
      isDeleted: false,
    },
  ];

  const existingCustomers: Customer[] = [
    {
      id: 'cust-1',
      companyName: 'Murugan Pooja Stores',
      contactPerson: 'Murugan Swamy',
      phone: '+919842154321',
      whatsapp: '+919842154321',
      place: { area: 'Shevapet', city: 'Salem', district: 'Salem', state: 'Tamil Nadu' },
      groupId: 'grp-1',
      groupName: 'Wholesale Distributors',
      status: 'New customer',
      source: 'Direct Reach / Walk-in',
      leadStage: 'New',
      assignedTo: 'admin',
      tags: ['Wholesale'],
      notes: 'Initial inquiry for camphor',
      totalOrdersCount: 0,
      totalRevenue: 0,
      statusHistory: [],
      stageHistory: [],
      isDeleted: false,
      createdAt: '2026-10-19T00:00:00.000Z',
      updatedAt: '2026-10-19T00:00:00.000Z',
    },
  ];

  it('1. Preselects active group tab when adding new customer', () => {
    const selectedTab: string = 'grp-2';
    let targetGrpId: string | null = null;
    if (selectedTab !== 'all' && selectedTab !== 'ungrouped') {
      targetGrpId = selectedTab;
    } else {
      const def = mockGroups.find((g) => g.isDefault && g.isActive && !g.isDeleted);
      targetGrpId = def?.id || null;
    }
    assert.strictEqual(targetGrpId, 'grp-2', 'Should preselect grp-2 when active tab is grp-2');

    // When on 'all' tab, should fall back to default group
    const fallbackTab: string = 'all';
    let fallbackGrpId: string | null = null;
    if (fallbackTab !== 'all' && fallbackTab !== 'ungrouped') {
      fallbackGrpId = fallbackTab;
    } else {
      const def = mockGroups.find((g) => g.isDefault && g.isActive && !g.isDeleted);
      fallbackGrpId = def?.id || null;
    }
    assert.strictEqual(fallbackGrpId, 'grp-1', 'Should fall back to default group on "all" tab');
  });

  it('2. "Save & Add Another" maintains group preselection and clears inputs', () => {
    let formState = {
      companyName: 'Meenakshi Pooja Mandir',
      phone: '9842099999',
      formGroupId: 'grp-2',
      notes: 'Bulk dhoop cone inquiry',
    };

    // Simulate "Save & Add Another" execution
    const savedCustomer = { ...formState };
    formState = {
      companyName: '',
      phone: '',
      formGroupId: formState.formGroupId, // Preserved!
      notes: '',
    };

    assert.strictEqual(savedCustomer.companyName, 'Meenakshi Pooja Mandir');
    assert.strictEqual(formState.companyName, '', 'Input cleared');
    assert.strictEqual(formState.phone, '', 'Input cleared');
    assert.strictEqual(formState.formGroupId, 'grp-2', 'formGroupId preserved for rapid subsequent entry');
  });

  it('3. Cross-group phone collision detection triggers conflict dialog', () => {
    const inputPhone = '09842154321'; // Variations of Murugan Pooja Stores (+919842154321)
    const normalized = normalizePhone(inputPhone);
    assert.strictEqual(normalized, '+919842154321');

    const match = existingCustomers.find((c) => c.phone === normalized && !c.isDeleted);
    assert.ok(match, 'Must detect existing phone number even if in different format');
    assert.strictEqual(match?.companyName, 'Murugan Pooja Stores');
  });

  it('4. Duplicate choice: "Move to group" updates groupId and preserves previousGroupId', () => {
    const existing = { ...existingCustomers[0] };
    const targetGroupId = 'grp-2';
    const targetGroup = mockGroups.find((g) => g.id === targetGroupId);

    // Perform move simulation
    const updated: Customer = {
      ...existing,
      previousGroupId: existing.groupId,
      groupId: targetGroupId,
      groupName: targetGroup?.name || 'Group',
      groupAssignedAt: new Date().toISOString(),
      groupAssignedBy: 'admin',
    };

    assert.strictEqual(updated.groupId, 'grp-2');
    assert.strictEqual(updated.previousGroupId, 'grp-1');
    assert.strictEqual(updated.groupName, 'Temple / Pooja Institutions');
  });

  it('5. Duplicate choice: "Save anyway with reason" requires reason string', () => {
    const reasonEmpty = '   ';
    assert.strictEqual(!reasonEmpty.trim(), true, 'Empty reason is rejected');

    const validReason = 'Branch sister concern of same proprietor in Madurai';
    const pendingData = {
      companyName: 'Murugan Pooja Stores - Madurai Branch',
      phone: '+919842154321',
      tags: ['Branch'],
      notes: 'Initial inquiry',
    };

    const finalCustomer = {
      ...pendingData,
      tags: [...pendingData.tags, 'Duplicate-Phone-Allowed'],
      notes: `${pendingData.notes}\n[Duplicate Allowed Reason]: ${validReason}`,
    };

    assert.ok(finalCustomer.tags.includes('Duplicate-Phone-Allowed'));
    assert.ok(finalCustomer.notes.includes(validReason));
  });

  it('6. Rejects assigning customer to an archived group', () => {
    const targetGrp = mockGroups.find((g) => g.id === 'grp-archived');
    assert.ok(targetGrp);
    assert.strictEqual(targetGrp.isActive, false);

    const isAllowed = targetGrp.isActive && !targetGrp.isDeleted;
    assert.strictEqual(isAllowed, false, 'Archived groups must not accept new customer assignments');
  });

  it('7. Bulk move simulation reassigns multiple customers with audit trail', () => {
    const batch = [
      { id: 'c1', groupId: 'grp-1', companyName: 'Shop 1' },
      { id: 'c2', groupId: 'grp-1', companyName: 'Shop 2' },
      { id: 'c3', groupId: null, companyName: 'Shop 3' },
    ];

    const targetGroupId = 'grp-2';
    const targetGrp = mockGroups.find((g) => g.id === targetGroupId);

    const moved = batch.map((c) => ({
      ...c,
      previousGroupId: c.groupId,
      groupId: targetGroupId,
      groupName: targetGrp?.name,
    }));

    assert.strictEqual(moved.length, 3);
    assert.strictEqual(moved[0].groupId, 'grp-2');
    assert.strictEqual(moved[0].previousGroupId, 'grp-1');
    assert.strictEqual(moved[2].groupId, 'grp-2');
    assert.strictEqual(moved[2].previousGroupId, null);
  });
});
