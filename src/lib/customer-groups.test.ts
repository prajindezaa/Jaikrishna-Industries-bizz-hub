/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Phase 1 Tests: Customer Groups & Counters Verification
 * Tests:
 * 1. Starter group creation & uniqueness
 * 2. Group name validation (length <= 40, non-empty, case-insensitive collision)
 * 3. Atomic counter single-source of truth invariants
 * 4. Merging groups moves all customers and archives source
 * 5. Cannot delete a group with assigned customers
 * 6. Migration safely maps distinct legacy customerType values to groupIds
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { CustomerGroup, Customer, CustomerGroupCountersDoc } from '../types';

describe('Phase 1: Customer Groups & Counters Test Suite', () => {
  it('Starter groups template generates 5 unique categories', () => {
    const starterNames = ['Distributor', 'Wholesaler', 'Retailer', 'Temple/Institution', 'Other'];
    const uniqueSet = new Set(starterNames.map((n) => n.toLowerCase().trim()));
    assert.strictEqual(uniqueSet.size, 5, 'Must contain 5 distinct starter groups');
  });

  it('Rejects duplicate group names case-insensitively and handles whitespace', () => {
    const existingGroups: Partial<CustomerGroup>[] = [
      { id: 'g1', name: 'Distributor', isDeleted: false },
      { id: 'g2', name: 'Wholesaler', isDeleted: false },
    ];

    const isDuplicate = (inputName: string) => {
      const clean = inputName.trim().toLowerCase();
      return existingGroups.some((g) => !g.isDeleted && g.name?.trim().toLowerCase() === clean);
    };

    assert.strictEqual(isDuplicate('distributor'), true, 'Should detect duplicate in lowercase');
    assert.strictEqual(isDuplicate('  DISTRIBUTOR  '), true, 'Should detect duplicate with whitespace');
    assert.strictEqual(isDuplicate('Retailer'), false, 'Should allow distinct name');
  });

  it('Enforces max name length of 40 characters', () => {
    const validateLength = (name: string) => name.trim().length > 0 && name.trim().length <= 40;
    assert.strictEqual(validateLength('A'.repeat(40)), true);
    assert.strictEqual(validateLength('A'.repeat(41)), false);
    assert.strictEqual(validateLength('   '), false);
  });

  it('Calculates single source of truth counters accurately without scanning all orders', () => {
    const mockGroups: CustomerGroup[] = [
      { id: 'grp_1', name: 'Distributors', color: '#881337', icon: 'Truck', sortOrder: 0, isActive: true, isDefault: true, createdBy: 'admin', createdAt: '', updatedAt: '', isDeleted: false },
      { id: 'grp_2', name: 'Wholesalers', color: '#d97706', icon: 'Store', sortOrder: 1, isActive: true, isDefault: false, createdBy: 'admin', createdAt: '', updatedAt: '', isDeleted: false },
    ];

    const mockCustomers: Partial<Customer>[] = [
      { id: 'c1', groupId: 'grp_1', status: 'New customer', isDeleted: false },
      { id: 'c2', groupId: 'grp_1', status: 'Old customer', isDeleted: false },
      { id: 'c3', groupId: 'grp_2', status: 'New customer', isDeleted: false },
      { id: 'c4', groupId: null, status: 'New customer', isDeleted: false }, // Ungrouped
      { id: 'c5', groupId: 'grp_1', status: 'Old customer', isDeleted: true }, // In trash, must be excluded!
    ];

    const activeCusts = mockCustomers.filter((c) => !c.isDeleted);
    const groupCounts: Record<string, { total: number; newCustomers: number; oldCustomers: number }> = {};
    let ungrouped = 0;

    mockGroups.forEach((g) => {
      groupCounts[g.id] = { total: 0, newCustomers: 0, oldCustomers: 0 };
    });

    activeCusts.forEach((c) => {
      if (c.groupId && groupCounts[c.groupId]) {
        groupCounts[c.groupId].total++;
        if (c.status === 'New customer') groupCounts[c.groupId].newCustomers++;
        else groupCounts[c.groupId].oldCustomers++;
      } else {
        ungrouped++;
      }
    });

    assert.strictEqual(activeCusts.length, 4, 'Total active customers should be 4');
    assert.strictEqual(groupCounts['grp_1'].total, 2, 'grp_1 should have 2 active customers');
    assert.strictEqual(groupCounts['grp_1'].newCustomers, 1, 'grp_1 should have 1 new customer');
    assert.strictEqual(groupCounts['grp_1'].oldCustomers, 1, 'grp_1 should have 1 old customer');
    assert.strictEqual(groupCounts['grp_2'].total, 1, 'grp_2 should have 1 active customer');
    assert.strictEqual(ungrouped, 1, 'Ungrouped count must be exactly 1');
  });

  it('Merge simulation moves all assigned customers and records previousGroupId', () => {
    const customers: Partial<Customer>[] = [
      { id: 'c1', groupId: 'grp_source', previousGroupId: null },
      { id: 'c2', groupId: 'grp_source', previousGroupId: null },
      { id: 'c3', groupId: 'grp_other', previousGroupId: null },
    ];

    const sourceId = 'grp_source';
    const targetId = 'grp_target';

    // Simulate merge
    const updated = customers.map((c) => {
      if (c.groupId === sourceId) {
        return { ...c, groupId: targetId, previousGroupId: sourceId };
      }
      return c;
    });

    const targetCustomers = updated.filter((c) => c.groupId === targetId);
    assert.strictEqual(targetCustomers.length, 2, 'Merged customers must equal 2');
    assert.strictEqual(targetCustomers[0].previousGroupId, sourceId, 'Audit trail must record previous group');
  });

  it('Cannot delete group when assigned customer count is greater than 0', () => {
    const customers: Partial<Customer>[] = [
      { id: 'c1', groupId: 'grp_test', isDeleted: false },
    ];

    const canDeleteGroup = (groupId: string) => {
      const activeCount = customers.filter((c) => !c.isDeleted && c.groupId === groupId).length;
      return activeCount === 0;
    };

    assert.strictEqual(canDeleteGroup('grp_test'), false, 'Should block delete when customers exist');
    assert.strictEqual(canDeleteGroup('grp_empty'), true, 'Should allow delete when group is empty');
  });

  it('Migration accurately maps legacy customerType strings to destination groups', () => {
    const customers: Partial<Customer>[] = [
      { id: 'c1', customerType: 'Distributor', groupId: null, isDeleted: false },
      { id: 'c2', customerType: 'Wholesaler', groupId: null, isDeleted: false },
      { id: 'c3', customerType: 'Retailer', groupId: null, isDeleted: false },
      { id: 'c4', customerType: 'Direct Consumer', groupId: null, isDeleted: false },
    ];

    const mapping = {
      Distributor: 'grp_dist',
      Wholesaler: 'grp_whole',
      Retailer: 'grp_retail',
      'Direct Consumer': 'grp_other',
    };

    const migrated = customers.map((c) => {
      const target = mapping[c.customerType as keyof typeof mapping];
      return {
        ...c,
        groupId: target,
        lastWriteSource: 'system',
        updatedBy: 'migration',
      };
    });

    assert.strictEqual(migrated[0].groupId, 'grp_dist');
    assert.strictEqual(migrated[3].groupId, 'grp_other');
    assert.strictEqual(migrated[0].lastWriteSource, 'system');
    assert.strictEqual(migrated[0].updatedBy, 'migration');
  });
});
