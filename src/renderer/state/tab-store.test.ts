import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock window.quakeshell before importing the module
const mockCreateSplit = vi.fn();
const mockList = vi.fn();

Object.defineProperty(globalThis, 'window', {
  value: {
    quakeshell: {
      tab: {
        createSplit: mockCreateSplit,
        list: mockList,
      },
    },
  },
  writable: true,
});

import {
  linkedTabGroups,
  focusedPaneTabId,
  canLinkTabs,
  createSplit,
  disconnectTabGroupAt,
  getSplitPrimary,
  getTabGroup,
  linkExistingTabs,
  removeTabFromGroups,
  getSplitPartner,
} from './tab-store';

describe('split pane state', () => {
  beforeEach(() => {
    linkedTabGroups.value = [];
    focusedPaneTabId.value = null;
    mockCreateSplit.mockReset();
    mockList.mockReset();
    mockList.mockResolvedValue([]);
  });

  describe('createSplit', () => {
    it('creates a new linked group for a standalone tab', async () => {
      mockCreateSplit.mockResolvedValue({ splitTabId: 'split-99' });

      const result = await createSplit('tab-1');

      expect(result).toBe('split-99');
      expect(linkedTabGroups.value).toEqual([['tab-1', 'split-99']]);
    });

    it('inserts a newly created tab directly after the source tab inside a group', async () => {
      linkedTabGroups.value = [['tab-1', 'tab-2', 'tab-3']];
      mockCreateSplit.mockResolvedValue({ splitTabId: 'split-99' });

      const result = await createSplit('tab-2');

      expect(result).toBe('split-99');
      expect(linkedTabGroups.value).toEqual([['tab-1', 'tab-2', 'split-99', 'tab-3']]);
    });

    it('calls window.quakeshell.tab.createSplit with correct args', async () => {
      mockCreateSplit.mockResolvedValue({ splitTabId: 'split-42' });
      await createSplit('tab-5', '/home/user');
      expect(mockCreateSplit).toHaveBeenCalledWith('tab-5', '/home/user');
    });

  });

  describe('linkExistingTabs', () => {
    it('links two standalone tabs', () => {
      const result = linkExistingTabs('tab-1', 'tab-2');

      expect(result).toBe(true);
      expect(linkedTabGroups.value).toEqual([['tab-1', 'tab-2']]);
    });

    it('extends an existing group with an adjacent standalone tab', () => {
      linkedTabGroups.value = [['tab-1', 'tab-2']];

      const result = linkExistingTabs('tab-2', 'tab-3');

      expect(result).toBe(true);
      expect(linkedTabGroups.value).toEqual([['tab-1', 'tab-2', 'tab-3']]);
    });

    it('merges two adjacent groups into one larger group', () => {
      linkedTabGroups.value = [['tab-1', 'tab-2'], ['tab-3', 'tab-4']];

      const result = linkExistingTabs('tab-2', 'tab-3');

      expect(result).toBe(true);
      expect(linkedTabGroups.value).toEqual([['tab-1', 'tab-2', 'tab-3', 'tab-4']]);
    });

    it('rejects linking a tab to itself or re-linking inside the same group', () => {
      linkedTabGroups.value = [['tab-1', 'tab-2', 'tab-3']];

      expect(linkExistingTabs('tab-1', 'tab-1')).toBe(false);
      expect(linkExistingTabs('tab-1', 'tab-2')).toBe(false);

      expect(linkedTabGroups.value).toEqual([['tab-1', 'tab-2', 'tab-3']]);
    });

    it('rejects linking from the middle of an existing group', () => {
      linkedTabGroups.value = [['tab-1', 'tab-2', 'tab-3']];

      expect(linkExistingTabs('tab-2', 'tab-4')).toBe(false);
      expect(linkedTabGroups.value).toEqual([['tab-1', 'tab-2', 'tab-3']]);
    });
  });

  describe('canLinkTabs', () => {
    it('returns true for two standalone tabs or adjacent group edges', () => {
      expect(canLinkTabs('tab-1', 'tab-2')).toBe(true);

      linkedTabGroups.value = [['tab-1', 'tab-2']];

      expect(canLinkTabs('tab-2', 'tab-3')).toBe(true);
      expect(canLinkTabs('tab-1', 'tab-3')).toBe(false);
      expect(canLinkTabs('tab-3', 'tab-3')).toBe(false);
    });
  });

  describe('disconnectTabGroupAt', () => {
    it('splits a linked group at the clicked divider', () => {
      linkedTabGroups.value = [['tab-1', 'tab-2', 'tab-3']];

      const result = disconnectTabGroupAt('tab-2', 'tab-3');

      expect(result).toEqual({
        leftGroup: ['tab-1', 'tab-2'],
        rightGroup: ['tab-3'],
      });
      expect(linkedTabGroups.value).toEqual([['tab-1', 'tab-2']]);
    });

    it('removes a two-tab group entirely when disconnected', () => {
      linkedTabGroups.value = [['tab-1', 'tab-2']];

      const result = disconnectTabGroupAt('tab-1', 'tab-2');

      expect(result).toEqual({
        leftGroup: ['tab-1'],
        rightGroup: ['tab-2'],
      });
      expect(linkedTabGroups.value).toEqual([]);
    });

    it('rejects disconnecting non-adjacent tabs', () => {
      linkedTabGroups.value = [['tab-1', 'tab-2', 'tab-3']];

      const result = disconnectTabGroupAt('tab-1', 'tab-3');

      expect(result).toBeNull();
      expect(linkedTabGroups.value).toEqual([['tab-1', 'tab-2', 'tab-3']]);
    });
  });

  describe('removeTabFromGroups', () => {
    it('removes a tab and preserves the remaining linked members', () => {
      linkedTabGroups.value = [['tab-1', 'tab-2', 'tab-3']];

      removeTabFromGroups('tab-2');

      expect(linkedTabGroups.value).toEqual([['tab-1', 'tab-3']]);
    });

    it('moves focused pane to the surviving neighbor when its tab is removed', () => {
      linkedTabGroups.value = [['tab-1', 'tab-2', 'tab-3']];
      focusedPaneTabId.value = 'tab-2';

      removeTabFromGroups('tab-2');

      expect(focusedPaneTabId.value).toBe('tab-3');
    });

    it('removes the linked group when only one tab remains', () => {
      linkedTabGroups.value = [['tab-1', 'tab-2']];

      removeTabFromGroups('tab-2');

      expect(linkedTabGroups.value).toEqual([]);
    });
  });

  describe('group helpers', () => {
    it('returns the full group and its lead tab', () => {
      linkedTabGroups.value = [['tab-1', 'tab-2', 'tab-3']];

      expect(getTabGroup('tab-2')).toEqual(['tab-1', 'tab-2', 'tab-3']);
      expect(getSplitPrimary('tab-3')).toBe('tab-1');
    });

    it('returns the next neighbor when available, otherwise the previous one', () => {
      linkedTabGroups.value = [['tab-1', 'tab-2', 'tab-3']];

      expect(getSplitPartner('tab-2')).toBe('tab-3');
      expect(getSplitPartner('tab-3')).toBe('tab-2');
    });

    it('returns undefined for non-split tab', () => {
      expect(getSplitPartner('tab-99')).toBeUndefined();
    });
  });
});
