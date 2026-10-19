/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Layers,
  Truck,
  Store,
  Building2,
  Landmark,
  Shield,
  Tag,
} from 'lucide-react';
import { CustomerGroup } from '../../types';

interface CustomerGroupBadgeProps {
  group?: CustomerGroup | null;
  groupId?: string | null;
  groupName?: string | null;
  size?: 'sm' | 'md';
  className?: string;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Truck,
  Store,
  Building2,
  Landmark,
  Shield,
  Tag,
  Layers,
};

export const CustomerGroupBadge: React.FC<CustomerGroupBadgeProps> = ({
  group,
  groupId,
  groupName,
  size = 'sm',
  className = '',
}) => {
  if (!group && !groupId && !groupName) {
    return (
      <span
        className={`inline-flex items-center gap-1 font-semibold text-stone-700 bg-stone-100 rounded-md border border-stone-200 ${
          size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
        } ${className}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
        <span>Ungrouped</span>
      </span>
    );
  }

  const displayName = group?.name || groupName || 'Group';
  const displayColor = group?.color || '#881337';
  const IconComp = group?.icon && ICON_MAP[group.icon] ? ICON_MAP[group.icon] : Layers;

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold rounded-md transition-colors ${
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
      } ${className}`}
      style={{
        backgroundColor: `${displayColor}18`, // 10% opacity tint
        color: displayColor,
        borderColor: `${displayColor}35`,
        borderWidth: '1px',
      }}
      title={`Customer Group: ${displayName}`}
    >
      <IconComp className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      <span>{displayName}</span>
      {!group?.isActive && group && (
        <span className="text-[9px] font-normal opacity-75">(archived)</span>
      )}
    </span>
  );
};
