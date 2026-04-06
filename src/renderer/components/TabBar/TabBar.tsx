import { useState, useEffect, useCallback, useMemo } from 'preact/hooks';
import type { TabSessionDTO } from '@shared/ipc-types';
import { splitPairs, focusedPaneTabId, getSplitPrimary } from '../../state/tab-store';
import { TabItem } from './TabItem';

export interface TabBarProps {
  /** Override opacity for the bar background (0–1). Falls back to 0.85. */
  opacity?: number;
}

/**
 * Self-sufficient tab bar that fetches and subscribes to tab data directly
 * via IPC — no parent state propagation needed.
 */
export default function TabBar({ opacity = 0.85 }: TabBarProps) {
  const [tabs, setTabs] = useState<TabSessionDTO[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragSourceIndex, setDragSourceIndex] = useState<number | null>(null);

  // Fetch tabs once on mount, subscribe to lifecycle events
  useEffect(() => {
    let cancelled = false;

    window.quakeshell.tab.list()
      .then((list: TabSessionDTO[]) => {
        if (cancelled) return;
        console.log('[TabBar] tab.list() →', list.length, 'tabs', list);
        setTabs(list);
        if (list.length > 0) setActiveId(list[0].id);
      })
      .catch((err: unknown) => console.error('[TabBar] tab.list() failed:', err));

    const offClosed = window.quakeshell.tab.onClosed(
      ({ tabId }: { tabId: string }) => {
        setTabs((prev) => prev.filter((t) => t.id !== tabId));
        setActiveId((prev) => (prev === tabId ? null : prev));
      },
    );

    const offActive = window.quakeshell.tab.onActiveChanged(
      ({ tabId }: { tabId: string }) => setActiveId(tabId),
    );

    const offRenamed = window.quakeshell.tab.onRenamed(
      ({ tabId, name }: { tabId: string; name: string }) => {
        setTabs((prev) =>
          prev.map((t) => (t.id === tabId ? { ...t, manualName: name } : t)),
        );
      },
    );

    return () => {
      cancelled = true;
      offClosed();
      offActive();
      offRenamed();
    };
  }, []);

  const handleAddTab = useCallback(async () => {
    try {
      const newTab: TabSessionDTO = await window.quakeshell.tab.create();
      setTabs((prev) => [...prev, newTab]);
      setActiveId(newTab.id);
    } catch (err) {
      console.error('Failed to create tab:', err);
    }
  }, []);

  const handleClose = useCallback(async (tabId: string) => {
    try {
      await window.quakeshell.tab.close(tabId);
    } catch (err) {
      console.error('Failed to close tab:', err);
    }
  }, []);

  const handleSelect = useCallback(async (tabId: string) => {
    // If the clicked tab belongs to any split pair, activate the primary
    // and set focus to the clicked pane
    const primaryOfClicked = getSplitPrimary(tabId);
    if (primaryOfClicked) {
      // Already viewing this split pair — just move focus
      if (activeId === primaryOfClicked || activeId === tabId) {
        focusedPaneTabId.value = tabId;
        return;
      }
      // Switching from another tab into a split pair
      focusedPaneTabId.value = tabId;
      await window.quakeshell.tab.switchTo(primaryOfClicked).catch(console.error);
      return;
    }
    await window.quakeshell.tab.switchTo(tabId).catch(console.error);
  }, [activeId]);

  function handleReorder(fromIndex: number, toIndex: number) {
    setTabs((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated;
    });
  }

  // Inline styles as primary — CSS module classes as progressive enhancement
  const barInline: Record<string, string | number> = {
    display: 'flex',
    alignItems: 'center',
    height: '32px',
    minHeight: '32px',
    maxHeight: '32px',
    flexShrink: 0,
    overflow: 'hidden',
    userSelect: 'none',
    backgroundColor: `rgba(19, 20, 28, ${opacity})`,
  };

  const btnInline: Record<string, string | number> = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    flexShrink: 0,
    border: 'none',
    background: 'none',
    color: '#c0caf5',
    cursor: 'pointer',
    borderRadius: '4px',
    fontSize: '18px',
  };

  console.log('[TabBar] render, tabs count:', tabs.length, 'activeId:', activeId);

  // Build render groups: split pairs become a single visual unit
  const renderItems = useMemo(() => {
    const secondaryIds = new Set(splitPairs.value.values());
    const items: Array<
      | { type: 'tab'; tab: TabSessionDTO; index: number }
      | { type: 'split-group'; primary: TabSessionDTO; secondary: TabSessionDTO; primaryIndex: number; secondaryIndex: number }
    > = [];

    for (let i = 0; i < tabs.length; i++) {
      const tab = tabs[i];
      // Skip secondary tabs — they're rendered as part of their group
      if (secondaryIds.has(tab.id)) continue;

      const secondaryId = splitPairs.value.get(tab.id);
      if (secondaryId) {
        const secondary = tabs.find((t) => t.id === secondaryId);
        if (secondary) {
          items.push({
            type: 'split-group',
            primary: tab,
            secondary,
            primaryIndex: i,
            secondaryIndex: tabs.indexOf(secondary),
          });
          continue;
        }
      }

      items.push({ type: 'tab', tab, index: i });
    }
    return items;
  }, [tabs, splitPairs.value]);

  /** Chain-link SVG icon for split pair separator */
  const LinkIcon = ({ active }: { active: boolean }) => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '24px',
      flexShrink: 0,
      borderLeft: `1px solid ${active ? '#3b4261' : '#292e42'}`,
      borderRight: `1px solid ${active ? '#3b4261' : '#292e42'}`,
      height: '100%',
      backgroundColor: active ? 'rgba(122, 162, 247, 0.08)' : 'transparent',
    }}>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke={active ? '#7aa2f7' : '#565f89'}
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    </div>
  );

  return (
    <div style={{
      ...barInline,
      position: 'relative',
      zIndex: 100,
      borderBottom: '1px solid #7aa2f7',
    }}>
      {/* DEBUG: direct text to verify container renders visibly */}
      {tabs.length === 0 && (
        <span style={{ color: '#f7768e', fontSize: '13px', padding: '0 8px' }}>
          No tabs loaded
        </span>
      )}
      {renderItems.map((item) => {
        if (item.type === 'tab') {
          return (
            <TabItem
              key={item.tab.id}
              tab={item.tab}
              isActive={item.tab.id === activeId}
              index={item.index}
              onClose={handleClose}
              onSelect={handleSelect}
              onDragStart={(idx: number) => setDragSourceIndex(idx)}
              onDragOver={(e: DragEvent) => e.preventDefault()}
              onDrop={(_e: DragEvent, toIndex: number) => {
                if (dragSourceIndex !== null) handleReorder(dragSourceIndex, toIndex);
                setDragSourceIndex(null);
              }}
            />
          );
        }

        // Split group: primary + link icon + secondary, wrapped in a visual group
        const groupActive =
          activeId === item.primary.id ||
          activeId === item.secondary.id ||
          splitPairs.value.get(activeId ?? '') === item.primary.id ||
          splitPairs.value.get(activeId ?? '') === item.secondary.id;

        return (
          <div
            key={`split-${item.primary.id}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              height: '28px',
              border: groupActive
                ? '1px solid #7aa2f7'
                : '1px solid #3b4261',
              backgroundColor: groupActive ? '#1a1b26' : 'rgba(26, 27, 38, 0.5)',
              borderRadius: '6px',
              overflow: 'hidden',
              marginLeft: '2px',
              marginRight: '2px',
            }}
          >
            <TabItem
              tab={item.primary}
              isActive={groupActive}
              index={item.primaryIndex}
              groupPosition="left"
              onClose={handleClose}
              onSelect={handleSelect}
              onDragStart={(idx: number) => setDragSourceIndex(idx)}
              onDragOver={(e: DragEvent) => e.preventDefault()}
              onDrop={(_e: DragEvent, toIndex: number) => {
                if (dragSourceIndex !== null) handleReorder(dragSourceIndex, toIndex);
                setDragSourceIndex(null);
              }}
            />
            <LinkIcon active={groupActive} />
            <TabItem
              tab={item.secondary}
              isActive={groupActive}
              index={item.secondaryIndex}
              groupPosition="right"
              onClose={handleClose}
              onSelect={handleSelect}
              onDragStart={(idx: number) => setDragSourceIndex(idx)}
              onDragOver={(e: DragEvent) => e.preventDefault()}
              onDrop={(_e: DragEvent, toIndex: number) => {
                if (dragSourceIndex !== null) handleReorder(dragSourceIndex, toIndex);
                setDragSourceIndex(null);
              }}
            />
          </div>
        );
      })}
      <button
        style={btnInline}
        onClick={handleAddTab}
        title="New tab (Ctrl+T)"
        aria-label="New tab"
      >
        +
      </button>
      <div style={{ flex: 1 }} />
      <button
        style={{ ...btnInline, marginRight: '2px' }}
        onClick={() => {
          window.quakeshell.window.openSettings()
            .catch((err: unknown) => console.error('[TabBar] window.openSettings failed:', err));
        }}
        title="Settings (Ctrl+,)"
        aria-label="Open settings"
      >
        ⚙
      </button>
    </div>
  );
}
