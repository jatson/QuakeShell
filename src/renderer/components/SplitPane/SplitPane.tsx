import { TerminalView } from '../Terminal/TerminalView';
import styles from './SplitPane.module.css';

interface SplitPaneProps {
  tabIds: string[];
  onFocusPane: (tabId: string) => void;
  focusedPaneTabId: string;
  opacity?: number;
  fontSize?: number;
  fontFamily?: string;
  lineHeight?: number;
}

export default function SplitPane({
  tabIds,
  onFocusPane,
  focusedPaneTabId: _focusedPaneTabId,
  opacity,
  fontSize,
  fontFamily,
  lineHeight,
}: SplitPaneProps) {
  const paneWidth = `calc((100% - ${(tabIds.length - 1) * 2}px) / ${tabIds.length})`;

  return (
    <div class={styles.container}>
      {tabIds.flatMap((tabId, index) => {
        const children = [
          <div
            key={`pane-${tabId}`}
            class={styles.pane}
            style={{ flexBasis: paneWidth }}
            onFocusCapture={() => onFocusPane(tabId)}
          >
            <TerminalView
              tabId={tabId}
              opacity={opacity}
              fontSize={fontSize}
              fontFamily={fontFamily}
              lineHeight={lineHeight}
            />
          </div>,
        ];

        if (index < tabIds.length - 1) {
          children.push(
            <div
              key={`divider-${tabId}-${tabIds[index + 1]}`}
              class={styles.divider}
              aria-hidden="true"
            />,
          );
        }

        return children;
      })}
    </div>
  );
}
