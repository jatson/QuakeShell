import { useEffect, useState } from 'preact/hooks';

interface ShellOption {
  id: string;
  label: string;
  icon: string;
}

interface ShellPickerProps {
  tabId: string;
  opacity: number;
  onShellSelected: (tabId: string, shellType: string) => void;
}

export function ShellPicker({ tabId, opacity, onShellSelected }: ShellPickerProps) {
  const [shells, setShells] = useState<ShellOption[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.quakeshell.tab.availableShells()
      .then((list: ShellOption[]) => {
        setShells(list);
        setLoading(false);
      })
      .catch((err: unknown) => {
        console.error('[ShellPicker] availableShells() failed:', err);
        // Fallback to common shells
        setShells([
          { id: 'powershell', label: 'Windows PowerShell', icon: '⚡' },
          { id: 'cmd', label: 'Command Prompt', icon: '▪' },
        ]);
        setLoading(false);
      });
  }, []);

  // Keyboard: press number to select shell
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const idx = parseInt(e.key, 10) - 1;
      if (idx >= 0 && idx < shells.length) {
        e.preventDefault();
        onShellSelected(tabId, shells[idx].id);
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [shells, tabId, onShellSelected]);

  if (loading) {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: `rgba(26, 27, 38, ${opacity})`,
        color: '#565f89',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '14px',
      }}>
        Detecting available shells…
      </div>
    );
  }

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: `rgba(26, 27, 38, ${opacity})`,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      userSelect: 'none',
      gap: '16px',
    }}>
      {/* Title */}
      <div style={{
        color: '#c0caf5',
        fontSize: '16px',
        fontWeight: 600,
        marginBottom: '8px',
      }}>
        Choose a shell
      </div>

      {/* Shell options */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        minWidth: '280px',
      }}>
        {shells.map((shell, idx) => {
          const isHovered = hoveredId === shell.id;
          return (
            <div
              key={shell.id}
              role="button"
              onClick={() => onShellSelected(tabId, shell.id)}
              onMouseEnter={() => setHoveredId(shell.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: '8px',
                cursor: 'pointer',
                backgroundColor: isHovered
                  ? 'rgba(122, 162, 247, 0.15)'
                  : 'rgba(42, 43, 61, 0.6)',
                border: isHovered
                  ? '1px solid rgba(122, 162, 247, 0.4)'
                  : '1px solid rgba(86, 95, 137, 0.3)',
                transition: 'background-color 0.15s, border-color 0.15s',
              }}
            >
              {/* Icon */}
              <span style={{
                fontSize: '22px',
                width: '32px',
                textAlign: 'center',
                flexShrink: 0,
              }}>
                {shell.icon}
              </span>

              {/* Label + shortcut */}
              <div style={{ flex: 1 }}>
                <div style={{
                  color: '#c0caf5',
                  fontSize: '14px',
                  fontWeight: 500,
                }}>
                  {shell.label}
                </div>
                <div style={{
                  color: '#565f89',
                  fontSize: '11px',
                  marginTop: '2px',
                }}>
                  {shell.id}
                </div>
              </div>

              {/* Keyboard shortcut badge */}
              <span style={{
                color: '#565f89',
                fontSize: '11px',
                padding: '2px 6px',
                borderRadius: '4px',
                backgroundColor: 'rgba(86, 95, 137, 0.2)',
                border: '1px solid rgba(86, 95, 137, 0.3)',
              }}>
                {idx + 1}
              </span>
            </div>
          );
        })}
      </div>

      {/* Hint */}
      <div style={{
        color: '#565f89',
        fontSize: '11px',
        marginTop: '8px',
      }}>
        Press a number key or click to select
      </div>
    </div>
  );
}
