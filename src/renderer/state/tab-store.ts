import { signal, computed } from '@preact/signals';
import type { TabSessionDTO, TabCreateSplitResponse } from '@shared/ipc-types';

export const tabs = signal<TabSessionDTO[]>([]);
export const activeTabId = signal<string | null>(null);

// Linked terminal groups, ordered left-to-right as rendered in the split view.
export const linkedTabGroups = signal<string[][]>([]);

// Compatibility view for older pair-oriented consumers.
export const splitPairs = computed(() => {
  const pairs = new Map<string, string>();

  for (const group of linkedTabGroups.value) {
    for (let index = 0; index < group.length - 1; index += 1) {
      pairs.set(group[index], group[index + 1]);
    }
  }

  return pairs;
});

// Tracks which pane has focus within a split
export const focusedPaneTabId = signal<string | null>(null);

// Derived: is the given tabId participating in any split?
export const isTabSplit = computed(() => {
  const groups = linkedTabGroups.value;
  return (tabId: string) => groups.some((group) => group.includes(tabId));
});

export const activeTab = computed(() =>
  tabs.value.find((t) => t.id === activeTabId.value) ?? null,
);

const unsubscribers: (() => void)[] = [];

export async function initTabStore(): Promise<void> {
  const list = await window.quakeshell.tab.list();
  tabs.value = list;
  if (list.length > 0) {
    activeTabId.value = list[0].id;
  }

  unsubscribers.push(
    window.quakeshell.tab.onClosed(({ tabId }) => {
      tabs.value = tabs.value.filter((t) => t.id !== tabId);
      removeTabFromGroups(tabId);
      if (activeTabId.value === tabId) {
        activeTabId.value = tabs.value.length > 0 ? tabs.value[0].id : null;
      }
    }),
  );

  unsubscribers.push(
    window.quakeshell.tab.onActiveChanged(({ tabId }) => {
      activeTabId.value = tabId;
    }),
  );

  unsubscribers.push(
    window.quakeshell.tab.onRenamed(({ tabId, name }) => {
      tabs.value = tabs.value.map((t) =>
        t.id === tabId ? { ...t, manualName: name } : t,
      );
    }),
  );

  unsubscribers.push(
    window.quakeshell.tab.onExited(() => {
      // handled per-terminal in TerminalView
    }),
  );
}

export function disposeTabStore(): void {
  for (const unsub of unsubscribers) {
    unsub();
  }
  unsubscribers.length = 0;
}

export function addTab(tab: TabSessionDTO): void {
  tabs.value = [...tabs.value, tab];
  activeTabId.value = tab.id;
}

export function removeTab(tabId: string): void {
  tabs.value = tabs.value.filter((t) => t.id !== tabId);
}

export function reorderTabs(fromIndex: number, toIndex: number): void {
  if (fromIndex === toIndex) return;
  const updated = [...tabs.value];
  const [moved] = updated.splice(fromIndex, 1);
  updated.splice(toIndex, 0, moved);
  tabs.value = updated;
}

// Split pane helpers

function findGroupIndex(tabId: string): number {
  return linkedTabGroups.value.findIndex((group) => group.includes(tabId));
}

function replaceGroups(
  nextGroups: string[][],
  groupIndexesToRemove: number[],
  insertAt: number,
  groupsToInsert: string[][],
): string[][] {
  const sortedIndexes = [...groupIndexesToRemove].sort((left, right) => right - left);

  for (const index of sortedIndexes) {
    nextGroups.splice(index, 1);
  }

  nextGroups.splice(insertAt, 0, ...groupsToInsert);
  return nextGroups;
}

export function getTabGroup(tabId: string): string[] | undefined {
  const groupIndex = findGroupIndex(tabId);
  return groupIndex >= 0 ? linkedTabGroups.value[groupIndex] : undefined;
}

export function getSplitPartner(tabId: string): string | undefined {
  const group = getTabGroup(tabId);
  if (!group || group.length < 2) return undefined;

  const tabIndex = group.indexOf(tabId);
  if (tabIndex === -1) return undefined;

  return group[tabIndex + 1] ?? group[tabIndex - 1];
}

/** Returns the primary tab ID if tabId belongs to any split pair, or undefined. */
export function getSplitPrimary(tabId: string): string | undefined {
  return getTabGroup(tabId)?.[0];
}

export function canLinkTabs(leftTabId: string, rightTabId: string): boolean {
  if (leftTabId === rightTabId) return false;

  const leftGroup = getTabGroup(leftTabId);
  const rightGroup = getTabGroup(rightTabId);

  if (leftGroup && rightGroup && leftGroup === rightGroup) {
    return false;
  }

  if (leftGroup && leftGroup[leftGroup.length - 1] !== leftTabId) {
    return false;
  }

  if (rightGroup && rightGroup[0] !== rightTabId) {
    return false;
  }

  return true;
}

export function linkExistingTabs(leftTabId: string, rightTabId: string): boolean {
  if (!canLinkTabs(leftTabId, rightTabId)) return false;

  const leftGroupIndex = findGroupIndex(leftTabId);
  const rightGroupIndex = findGroupIndex(rightTabId);
  const leftGroup = leftGroupIndex >= 0 ? linkedTabGroups.value[leftGroupIndex] : [leftTabId];
  const rightGroup = rightGroupIndex >= 0 ? linkedTabGroups.value[rightGroupIndex] : [rightTabId];
  const nextGroups = [...linkedTabGroups.value];

  const insertAt = Math.min(
    leftGroupIndex >= 0 ? leftGroupIndex : Number.POSITIVE_INFINITY,
    rightGroupIndex >= 0 ? rightGroupIndex : Number.POSITIVE_INFINITY,
  );
  const mergedGroup = [...leftGroup, ...rightGroup];

  linkedTabGroups.value = replaceGroups(
    nextGroups,
    [leftGroupIndex, rightGroupIndex].filter((index) => index >= 0),
    Number.isFinite(insertAt) ? insertAt : nextGroups.length,
    [mergedGroup],
  );

  return true;
}

function insertLinkedTabAfter(sourceTabId: string, newTabId: string): void {
  const sourceGroupIndex = findGroupIndex(sourceTabId);

  if (sourceGroupIndex < 0) {
    linkedTabGroups.value = [...linkedTabGroups.value, [sourceTabId, newTabId]];
    return;
  }

  const nextGroups = [...linkedTabGroups.value];
  const sourceGroup = nextGroups[sourceGroupIndex];
  const sourceIndex = sourceGroup.indexOf(sourceTabId);

  nextGroups[sourceGroupIndex] = [
    ...sourceGroup.slice(0, sourceIndex + 1),
    newTabId,
    ...sourceGroup.slice(sourceIndex + 1),
  ];

  linkedTabGroups.value = nextGroups;
}

export async function createSplit(sourceTabId: string, cwd?: string): Promise<string | null> {
  const response: TabCreateSplitResponse = await window.quakeshell.tab.createSplit(sourceTabId, cwd);
  insertLinkedTabAfter(sourceTabId, response.splitTabId);

  // Add the new tab to the tabs list
  const list = await window.quakeshell.tab.list();
  tabs.value = list;

  return response.splitTabId;
}

export function disconnectTabGroupAt(
  leftTabId: string,
  rightTabId: string,
): { leftGroup: string[]; rightGroup: string[] } | null {
  const groupIndex = findGroupIndex(leftTabId);
  if (groupIndex < 0) return null;

  const group = linkedTabGroups.value[groupIndex];
  if (!group.includes(rightTabId)) return null;

  const leftIndex = group.indexOf(leftTabId);
  const rightIndex = group.indexOf(rightTabId);

  if (rightIndex !== leftIndex + 1) return null;

  const leftGroup = group.slice(0, rightIndex);
  const rightGroup = group.slice(rightIndex);
  const nextGroups = [...linkedTabGroups.value];

  linkedTabGroups.value = replaceGroups(
    nextGroups,
    [groupIndex],
    groupIndex,
    [leftGroup, rightGroup].filter((candidate) => candidate.length > 1),
  );

  if (focusedPaneTabId.value && !leftGroup.includes(focusedPaneTabId.value) && !rightGroup.includes(focusedPaneTabId.value)) {
    focusedPaneTabId.value = null;
  }

  return { leftGroup, rightGroup };
}

export function removeSplitPair(tabId: string): void {
  const group = getTabGroup(tabId);
  if (!group) return;

  linkedTabGroups.value = linkedTabGroups.value.filter((candidate) => candidate !== group);

  if (focusedPaneTabId.value && group.includes(focusedPaneTabId.value)) {
    focusedPaneTabId.value = null;
  }
}

export function removeTabFromGroups(tabId: string): void {
  const groupIndex = findGroupIndex(tabId);
  if (groupIndex < 0) return;

  const group = linkedTabGroups.value[groupIndex];
  const tabIndex = group.indexOf(tabId);
  const nextGroup = group.filter((candidate) => candidate !== tabId);
  const nextGroups = [...linkedTabGroups.value];

  if (nextGroup.length > 1) {
    nextGroups[groupIndex] = nextGroup;
  } else {
    nextGroups.splice(groupIndex, 1);
  }

  linkedTabGroups.value = nextGroups;

  if (focusedPaneTabId.value === tabId) {
    focusedPaneTabId.value = nextGroup.length > 1
      ? nextGroup[Math.min(tabIndex, nextGroup.length - 1)]
      : null;
  }
}
