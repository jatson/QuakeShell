import { useRef, useCallback, useState } from 'preact/hooks';

const DOUBLE_CLICK_MS = 250;

export interface ResizeHandleProps {
  opacity?: number;
}

export default function ResizeHandle({ opacity = 0.85 }: ResizeHandleProps) {
  const [hovered, setHovered] = useState(false);
  const draggingRef = useRef(false);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clickCountRef = useRef(0);

  const stopDrag = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    document.body.style.userSelect = '';
    window.quakeshell.window.resizeEnd(true);
  }, []);

  const startDrag = useCallback(() => {
    draggingRef.current = true;
    document.body.style.userSelect = 'none';
    window.quakeshell.window.resizeStart();

    const cleanup = () => {
      stopDrag();
      document.removeEventListener('mouseup', cleanup);
      document.removeEventListener('contextmenu', cleanup);
      window.removeEventListener('blur', cleanup);
    };

    document.addEventListener('mouseup', cleanup);
    document.addEventListener('contextmenu', cleanup);
    window.addEventListener('blur', cleanup);
  }, [stopDrag]);

  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (e.button !== 0) return; // left-click only
    e.preventDefault();
    clickCountRef.current += 1;

    if (clickCountRef.current === 2) {
      // Second click arrived — it's a double-click
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }
      clickCountRef.current = 0;
      window.quakeshell.window.resetHeight();
      return;
    }

    // First click — wait to see if a second one arrives
    clickTimerRef.current = setTimeout(() => {
      clickCountRef.current = 0;
      clickTimerRef.current = null;
      startDrag();
    }, DOUBLE_CLICK_MS);
  }, [startDrag]);

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        height: '6px',
        width: '100%',
        background: hovered
          ? `rgba(122, 162, 247, ${opacity})`
          : `rgba(42, 43, 61, ${opacity})`,
        cursor: 'ns-resize',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      <div
        style={{
          width: '32px',
          height: '2px',
          background: `rgba(86, 95, 137, ${Math.min(1, opacity + 0.15)})`,
          borderRadius: '1px',
        }}
      />
    </div>
  );
}
