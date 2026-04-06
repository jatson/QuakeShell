import { useState } from 'preact/hooks';
import type { TabSessionDTO } from '@shared/ipc-types';
import { focusedPaneTabId } from '../../state/tab-store';

export interface TabItemProps {
  tab: TabSessionDTO;
  isActive: boolean;
  index: number;
  /** Position inside a linked split group — controls border removal on connected side. */
  groupPosition?: 'left' | 'right';
  onClose: (tabId: string) => void;
  onSelect: (tabId: string) => void;
  onDragStart: (index: number) => void;
  onDragOver: (e: DragEvent, index: number) => void;
  onDrop: (e: DragEvent, index: number) => void;
}

export function TabItem({
  tab,
  isActive,
  index,
  groupPosition,
  onClose,
  onSelect,
  onDragStart,
  onDragOver,
  onDrop,
}: TabItemProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [hovered, setHovered] = useState(false);
  const displayName = tab.manualName ?? tab.shellType ?? 'Terminal';

  const inGroup = !!groupPosition;
  const isFocusedPane = inGroup && focusedPaneTabId.value === tab.id;

  const itemStyle: Record<string, string | number> = {
    display: 'flex',
    alignItems: 'center',
    height: '100%',
    padding: '0 8px 0 6px',
    gap: '4px',
    flexShrink: 0,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    // Inside a group, the wrapper handles border + background
    borderLeft: inGroup ? 'none' : isActive ? '2px solid #7aa2f7' : '2px solid transparent',
    color: inGroup
      ? (isActive ? '#c0caf5' : '#a9b1d6')
      : (isActive || hovered ? '#c0caf5' : '#565f89'),
    backgroundColor: inGroup
      ? (isFocusedPane ? 'rgba(122, 162, 247, 0.12)' : (hovered ? 'rgba(122, 162, 247, 0.06)' : 'transparent'))
      : isActive
        ? '#1a1b26'
        : hovered
          ? 'rgba(26, 27, 38, 0.4)'
          : 'transparent',
    opacity: isDragging ? 0.7 : 1,
  };

  return (
    <div
      style={itemStyle}
      onClick={() => onSelect(tab.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      draggable
      onDragStart={() => {
        setIsDragging(true);
        onDragStart(index);
      }}
      onDragEnd={() => setIsDragging(false)}
      onDragOver={(e: DragEvent) => {
        e.preventDefault();
        onDragOver(e, index);
      }}
      onDrop={(e: DragEvent) => {
        e.preventDefault();
        onDrop(e, index);
      }}
    >
      <span
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          flexShrink: 0,
          backgroundColor: tab.color,
        }}
      />
      <span
        style={{
          fontSize: '12px',
          maxWidth: '120px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          lineHeight: 1,
        }}
      >
        {displayName}
      </span>
      <button
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '16px',
          height: '16px',
          border: 'none',
          background: 'none',
          color: 'inherit',
          cursor: 'pointer',
          borderRadius: '3px',
          padding: 0,
          fontSize: '14px',
          lineHeight: 1,
        }}
        onClick={(e: MouseEvent) => {
          e.stopPropagation();
          onClose(tab.id);
        }}
        title="Close tab"
        aria-label={`Close ${displayName}`}
      >
        ×
      </button>
    </div>
  );
}
