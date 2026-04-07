import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock node-pty
const mockWrite = vi.fn();
const mockResize = vi.fn();
const mockKill = vi.fn();
const mockOnData = vi.fn();
const mockOnExit = vi.fn();
let mockPid = 1234;

vi.mock('node-pty', () => ({
  spawn: vi.fn(() => ({
    pid: mockPid,
    write: mockWrite,
    resize: mockResize,
    kill: mockKill,
    onData: mockOnData,
    onExit: mockOnExit,
  })),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => true),
}));

vi.mock('electron-log/main', () => {
  const scopedLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
  return {
    default: {
      scope: vi.fn(() => scopedLogger),
    },
  };
});

import * as nodePty from 'node-pty';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawn, spawnPty, write, resize, onData, onExit, onBell, destroy, normalizeWindowsSpawnEnv, resolveShellPath, setDefaultShell, getDefaultShell, _normalizeWindowsPathSegmentForComparison, _reset } from './terminal-manager';

describe('main/terminal-manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPid = 1234;
    _reset();
  });

  afterEach(() => {
    // Clean up PTY state between tests
    try {
      destroy();
    } catch {
      // ignore
    }
  });

  describe('spawn', () => {
    it('spawns a powershell PTY with default 80x24 dimensions', () => {
      spawn('powershell');

      expect(nodePty.spawn).toHaveBeenCalledWith(
        'powershell.exe',
        [],
        expect.objectContaining({
          name: 'xterm-256color',
          cols: 80,
          rows: 24,
          useConpty: true,
        }),
      );
    });

    it('spawns with custom cols and rows when provided', () => {
      spawn('powershell', 200, 50);

      expect(nodePty.spawn).toHaveBeenCalledWith(
        'powershell.exe',
        [],
        expect.objectContaining({
          cols: 200,
          rows: 50,
        }),
      );
    });

    it('spawns allowed shells: pwsh, cmd, bash, wsl', () => {
      const expected: Record<string, string> = { pwsh: 'pwsh.exe', cmd: 'cmd.exe', bash: 'bash.exe', wsl: 'wsl.exe' };
      for (const shell of ['pwsh', 'cmd', 'bash', 'wsl']) {
        vi.clearAllMocks();
        spawn(shell);
        expect(nodePty.spawn).toHaveBeenCalledWith(
          expected[shell],
          [],
          expect.any(Object),
        );
        destroy();
      }
    });

    it('accepts custom absolute paths as shell', () => {
      spawn('/usr/bin/zsh');
      expect(nodePty.spawn).toHaveBeenCalledWith(
        '/usr/bin/zsh',
        [],
        expect.any(Object),
      );
    });

    it('rejects empty shell name', () => {
      expect(() => spawn('')).toThrow('Shell path must not be empty');
    });

    it('registers an onExit listener', () => {
      spawn('powershell');
      expect(mockOnExit).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('write', () => {
    it('writes data to the PTY process', () => {
      spawn('powershell');
      write('ls\r');
      expect(mockWrite).toHaveBeenCalledWith('ls\r');
    });

    it('does nothing when no PTY is running', () => {
      write('test');
      expect(mockWrite).not.toHaveBeenCalled();
    });
  });

  describe('resize', () => {
    it('resizes the PTY to given dimensions', () => {
      spawn('powershell');
      resize(120, 40);
      expect(mockResize).toHaveBeenCalledWith(120, 40);
    });

    it('does nothing when no PTY is running', () => {
      resize(80, 24);
      expect(mockResize).not.toHaveBeenCalled();
    });
  });

  describe('onData', () => {
    it('registers a data callback wrapper on the PTY', () => {
      spawn('powershell');
      const cb = vi.fn();
      onData(cb);
      // onData wraps the callback to inject tabId, so it registers a wrapper function
      expect(mockOnData).toHaveBeenCalledWith(expect.any(Function));
    });

    it('stores callback without error when no PTY is running', () => {
      const cb = vi.fn();
      onData(cb);
      expect(mockOnData).not.toHaveBeenCalled();
    });

    it('auto-wires stored data callback on subsequent spawn', () => {
      const cb = vi.fn();
      onData(cb); // stored, no PTY yet
      expect(mockOnData).not.toHaveBeenCalled();

      spawn('powershell'); // should auto-wire stored callback
      expect(mockOnData).toHaveBeenCalledWith(expect.any(Function));

      // Verify data flows through to the stored callback with tabId
      const registeredHandler = mockOnData.mock.calls[mockOnData.mock.calls.length - 1][0];
      registeredHandler('test data');
      expect(cb).toHaveBeenCalledWith('default', 'test data');
    });
  });

  describe('onExit', () => {
    it('calls exit callback when PTY exits', () => {
      const exitCb = vi.fn();
      onExit(exitCb);
      spawn('powershell');

      // Simulate PTY exit
      const ptyOnExitHandler = mockOnExit.mock.calls[0][0];
      ptyOnExitHandler({ exitCode: 0, signal: 0 });

      expect(exitCb).toHaveBeenCalledWith(0, 0);
    });
  });

  describe('destroy', () => {
    it('kills the PTY process', () => {
      spawn('powershell');
      destroy();
      expect(mockKill).toHaveBeenCalled();
    });

    it('does nothing when no PTY is running', () => {
      destroy();
      expect(mockKill).not.toHaveBeenCalled();
    });

    it('clears state so subsequent writes are no-ops', () => {
      spawn('powershell');
      destroy();
      write('test');
      expect(mockWrite).not.toHaveBeenCalled();
    });
  });

  describe('resolveShellPath', () => {
    it('maps "powershell" to "powershell.exe"', () => {
      expect(resolveShellPath('powershell')).toBe('powershell.exe');
    });

    it('maps "wsl" to "wsl.exe"', () => {
      expect(resolveShellPath('wsl')).toBe('wsl.exe');
    });

    it('maps "pwsh" to "pwsh.exe"', () => {
      expect(resolveShellPath('pwsh')).toBe('pwsh.exe');
    });

    it('maps "cmd" to "cmd.exe"', () => {
      expect(resolveShellPath('cmd')).toBe('cmd.exe');
    });

    it('maps "bash" to "bash.exe"', () => {
      expect(resolveShellPath('bash')).toBe('bash.exe');
    });

    it('passes through custom absolute paths unchanged', () => {
      expect(resolveShellPath('C:\\Git\\bin\\bash.exe')).toBe('C:\\Git\\bin\\bash.exe');
    });

    it('passes through unix-style absolute paths unchanged', () => {
      expect(resolveShellPath('/usr/bin/zsh')).toBe('/usr/bin/zsh');
    });
  });

  describe('spawn with custom shell paths', () => {
    it('spawns with a custom absolute path', () => {
      spawn('C:\\Windows\\System32\\cmd.exe');
      expect(nodePty.spawn).toHaveBeenCalledWith(
        'C:\\Windows\\System32\\cmd.exe',
        [],
        expect.objectContaining({
          name: 'xterm-256color',
          cols: 80,
          rows: 24,
        }),
      );
    });

    it('spawns allowlisted shells by alias', () => {
      spawn('wsl');
      expect(nodePty.spawn).toHaveBeenCalledWith(
        'wsl.exe',
        [],
        expect.any(Object),
      );
    });
  });

  describe('spawnPty', () => {
    it('uses the provided cwd when spawning tab-specific PTYs', () => {
      const onDataCb = vi.fn();
      const onExitCb = vi.fn();

      spawnPty('powershell', 120, 40, onDataCb, onExitCb, 'C:\\Projects\\QuakeShell');

      expect(nodePty.spawn).toHaveBeenCalledWith(
        'powershell.exe',
        [],
        expect.objectContaining({
          cols: 120,
          rows: 40,
          cwd: 'C:\\Projects\\QuakeShell',
        }),
      );
    });
  });

  describe('setDefaultShell / getDefaultShell', () => {
    it('stores new shell preference without killing existing PTY', () => {
      spawn('powershell');
      setDefaultShell('wsl');

      // PTY should NOT have been killed
      expect(mockKill).not.toHaveBeenCalled();
      expect(getDefaultShell()).toBe('wsl');
    });

    it('next spawn uses the updated shell after setDefaultShell', () => {
      spawn('powershell');
      setDefaultShell('wsl');
      vi.clearAllMocks();

      // Simulate PTY exit and respawn
      destroy();
      spawn(getDefaultShell());

      expect(nodePty.spawn).toHaveBeenCalledWith(
        'wsl.exe',
        [],
        expect.any(Object),
      );
    });

    it('setDefaultShell with custom path works', () => {
      setDefaultShell('C:\\Git\\bin\\bash.exe');
      expect(getDefaultShell()).toBe('C:\\Git\\bin\\bash.exe');

      spawn(getDefaultShell());
      expect(nodePty.spawn).toHaveBeenCalledWith(
        'C:\\Git\\bin\\bash.exe',
        [],
        expect.any(Object),
      );
    });
  });

  describe('WSL-specific environment variables', () => {
    it('passes COLORTERM and TERM env vars when spawning WSL', () => {
      spawn('wsl');
      expect(nodePty.spawn).toHaveBeenCalledWith(
        'wsl.exe',
        [],
        expect.objectContaining({
          env: expect.objectContaining({
            COLORTERM: 'truecolor',
            TERM: 'xterm-256color',
          }),
        }),
      );
    });

    it('does NOT add WSL-specific env var overrides for non-WSL shells', () => {
      spawn('powershell');
      const callArgs = (nodePty.spawn as ReturnType<typeof vi.fn>).mock.calls[0][2];
      expect(callArgs.env.COLORTERM).toBe(process.env.COLORTERM);
      expect(callArgs.env.TERM).toBe(process.env.TERM);
    });
  });

  describe('normalizeWindowsSpawnEnv', () => {
    it('preserves drive and UNC roots when normalizing path segments for comparison', () => {
      expect(_normalizeWindowsPathSegmentForComparison('C:\\')).toBe('c:\\');
      expect(_normalizeWindowsPathSegmentForComparison('C:')).toBe('c:.');
      expect(_normalizeWindowsPathSegmentForComparison('\\\\server\\share\\')).toBe('\\\\server\\share\\');
    });

    it('collapses duplicate PATH key variants into a single Path entry and strips Volta tool-image paths', () => {
      const env = normalizeWindowsSpawnEnv({
        PATH: [
          'C:\\Users\\test\\AppData\\Local\\Volta\\tools\\image\\npm\\11.10.0\\bin',
          'C:\\Windows\\System32',
        ].join(path.win32.delimiter),
        Path: [
          'C:\\Users\\test\\AppData\\Local\\Volta\\bin',
          'C:\\Windows\\System32',
        ].join(path.win32.delimiter),
        SystemRoot: 'C:\\Windows',
      });

      const pathSegments = env.Path.split(path.win32.delimiter);
      expect(Object.keys(env).filter((key) => key.toLowerCase() === 'path')).toEqual(['Path']);
      expect(pathSegments[0]).toBe('C:\\Users\\test\\AppData\\Local\\Volta\\bin');
      expect(pathSegments).not.toContain('C:\\Users\\test\\AppData\\Local\\Volta\\tools\\image\\npm\\11.10.0\\bin');
      expect(pathSegments).toContain('C:\\Windows\\System32');
    });

    it('prepends the Volta shim directory and strips tool-image bins', () => {
      const env = normalizeWindowsSpawnEnv({
        Path: [
          'C:\\Users\\test\\AppData\\Local\\Volta\\tools\\image\\npm\\11.10.0\\bin',
          'C:\\Windows\\System32',
        ].join(path.win32.delimiter),
        VOLTA_HOME: 'C:\\Users\\test\\AppData\\Local\\Volta',
        SystemRoot: 'C:\\Windows',
      });

      const pathSegments = env.Path.split(path.win32.delimiter);
      expect(pathSegments[0]).toBe('C:\\Users\\test\\AppData\\Local\\Volta\\bin');
      expect(pathSegments).not.toContain('C:\\Users\\test\\AppData\\Local\\Volta\\tools\\image\\npm\\11.10.0\\bin');
      expect(pathSegments).toContain('C:\\Windows\\System32');
    });

    it('derives the Volta shim directory from tool image bins when VOLTA_HOME is missing and strips tool-image entries', () => {
      const env = normalizeWindowsSpawnEnv({
        Path: [
          'C:\\Users\\test\\AppData\\Local\\Volta\\tools\\image\\npm\\11.10.0\\bin',
          'C:\\Windows\\System32',
        ].join(path.win32.delimiter),
        SystemRoot: 'C:\\Windows',
      });

      const pathSegments = env.Path.split(path.win32.delimiter);
      expect(pathSegments[0]).toBe('C:\\Users\\test\\AppData\\Local\\Volta\\bin');
      expect(pathSegments).not.toContain('C:\\Users\\test\\AppData\\Local\\Volta\\tools\\image\\npm\\11.10.0\\bin');
      expect(pathSegments).toContain('C:\\Windows\\System32');
    });

    it('hydrates SystemRoot from windir when PowerShell prerequisites are missing', () => {
      const env = normalizeWindowsSpawnEnv({
        Path: 'C:\\Windows\\System32',
        windir: 'C:\\Windows',
      });

      expect(env.SystemRoot).toBe('C:\\Windows');
    });

    it('strips npm lifecycle and config vars leaked from the parent process', () => {
      const env = normalizeWindowsSpawnEnv({
        Path: 'C:\\Windows\\System32',
        SystemRoot: 'C:\\Windows',
        npm_lifecycle_event: 'postinstall',
        npm_lifecycle_script: 'node scripts/npm/postinstall.js',
        npm_package_name: 'quakeshell',
        npm_package_version: '1.0.8',
        npm_config_prefix: 'C:\\Users\\test\\AppData\\Roaming\\npm',
        npm_execpath: 'C:\\Users\\test\\AppData\\Local\\Volta\\tools\\image\\npm\\11.10.0\\bin\\npm-cli.js',
        npm_node_execpath: 'C:\\Users\\test\\AppData\\Local\\Volta\\tools\\image\\node\\22.0.0\\node.exe',
        USERPROFILE: 'C:\\Users\\test',
      });

      expect(env).not.toHaveProperty('npm_lifecycle_event');
      expect(env).not.toHaveProperty('npm_lifecycle_script');
      expect(env).not.toHaveProperty('npm_package_name');
      expect(env).not.toHaveProperty('npm_package_version');
      expect(env).not.toHaveProperty('npm_config_prefix');
      expect(env).not.toHaveProperty('npm_execpath');
      expect(env).not.toHaveProperty('npm_node_execpath');
      expect(env.USERPROFILE).toBe('C:\\Users\\test');
    });

    it('strips multiple Volta tool-image paths including node and npm', () => {
      const env = normalizeWindowsSpawnEnv({
        Path: [
          'C:\\Users\\test\\AppData\\Local\\Volta\\tools\\image\\node\\22.0.0',
          'C:\\Users\\test\\AppData\\Local\\Volta\\tools\\image\\npm\\11.10.0\\bin',
          'C:\\Users\\test\\AppData\\Local\\Volta\\bin',
          'C:\\Windows\\System32',
          'C:\\Program Files\\Git\\cmd',
        ].join(path.win32.delimiter),
        VOLTA_HOME: 'C:\\Users\\test\\AppData\\Local\\Volta',
        SystemRoot: 'C:\\Windows',
      });

      const pathSegments = env.Path.split(path.win32.delimiter);
      expect(pathSegments[0]).toBe('C:\\Users\\test\\AppData\\Local\\Volta\\bin');
      expect(pathSegments).not.toContain('C:\\Users\\test\\AppData\\Local\\Volta\\tools\\image\\node\\22.0.0');
      expect(pathSegments).not.toContain('C:\\Users\\test\\AppData\\Local\\Volta\\tools\\image\\npm\\11.10.0\\bin');
      expect(pathSegments).toContain('C:\\Windows\\System32');
      expect(pathSegments).toContain('C:\\Program Files\\Git\\cmd');
    });
  });

  describe('spawn error handling', () => {
    it('displays dimmed WSL error message when wsl.exe spawn fails', () => {
      const dataCb = vi.fn();
      onData(dataCb);

      (nodePty.spawn as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
        throw new Error('spawn ENOENT');
      });

      spawn('wsl');

      expect(dataCb).toHaveBeenCalledWith(
        'default',
        expect.stringContaining('[Failed to start shell: WSL is not installed or not available]'),
      );
      // Should contain dimmed ANSI escape
      expect(dataCb).toHaveBeenCalledWith(
        'default',
        expect.stringContaining('\x1b[38;2;86;95;137m'),
      );
    });

    it('displays generic error message for non-WSL spawn failures', () => {
      const dataCb = vi.fn();
      onData(dataCb);

      (nodePty.spawn as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
        throw new Error('spawn EACCES');
      });

      spawn('powershell');

      expect(dataCb).toHaveBeenCalledWith(
        'default',
        expect.stringContaining('[Failed to start shell: spawn EACCES]'),
      );
    });

    it('does not throw when spawn fails — handles gracefully', () => {
      (nodePty.spawn as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
        throw new Error('spawn ENOENT');
      });

      expect(() => spawn('wsl')).not.toThrow();
    });
  });

  describe('custom shell path validation', () => {
    it('displays error when custom shell path does not exist', () => {
      const dataCb = vi.fn();
      onData(dataCb);

      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValueOnce(false);

      spawn('C:\\nonexistent\\shell.exe');

      expect(dataCb).toHaveBeenCalledWith(
        'default',
        expect.stringContaining('[Failed to start shell: Shell executable not found at C:\\nonexistent\\shell.exe]'),
      );
      // Should NOT attempt to call pty.spawn
      expect(nodePty.spawn).not.toHaveBeenCalled();
    });

    it('spawns normally when custom shell path exists', () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValueOnce(true);

      spawn('C:\\Git\\bin\\bash.exe');

      expect(nodePty.spawn).toHaveBeenCalledWith(
        'C:\\Git\\bin\\bash.exe',
        [],
        expect.any(Object),
      );
    });

    it('does NOT validate path for allowlisted shell aliases', () => {
      spawn('powershell');

      // fs.existsSync should not be called for known shells
      expect(fs.existsSync).not.toHaveBeenCalled();
      expect(nodePty.spawn).toHaveBeenCalled();
    });
  });

  describe('ANSI data pass-through', () => {
    it('forwards data from node-pty unmodified to the data callback with tabId', () => {
      const dataCb = vi.fn();
      onData(dataCb);
      spawn('powershell');

      // The data callback is registered via ptyProcess.onData
      // which is our mockOnData. Simulate data from PTY.
      const registeredCb = mockOnData.mock.calls[mockOnData.mock.calls.length - 1][0];
      const ansiData = '\x1b[31mred text\x1b[0m normal text';
      registeredCb(ansiData);

      expect(dataCb).toHaveBeenCalledWith('default', ansiData);
    });
  });

  describe('onBell', () => {
    it('fires bell callback when \\x07 is detected in PTY data', () => {
      const bellCb = vi.fn();
      onBell(bellCb);
      spawn('powershell');

      const registeredCb = mockOnData.mock.calls[mockOnData.mock.calls.length - 1][0];
      registeredCb('hello\x07world');

      expect(bellCb).toHaveBeenCalledTimes(1);
    });

    it('does not fire bell callback when no \\x07 in data', () => {
      const bellCb = vi.fn();
      onBell(bellCb);
      spawn('powershell');

      const registeredCb = mockOnData.mock.calls[mockOnData.mock.calls.length - 1][0];
      registeredCb('hello world');

      expect(bellCb).not.toHaveBeenCalled();
    });

    it('still forwards data to data callback alongside bell', () => {
      const dataCb = vi.fn();
      const bellCb = vi.fn();
      onData(dataCb);
      onBell(bellCb);
      spawn('powershell');

      const registeredCb = mockOnData.mock.calls[mockOnData.mock.calls.length - 1][0];
      registeredCb('alert\x07');

      expect(bellCb).toHaveBeenCalledTimes(1);
      expect(dataCb).toHaveBeenCalledWith('default', 'alert\x07');
    });
  });

  describe('stale PTY exit guard', () => {
    it('does NOT fire exit callback when a killed PTY exits after a new spawn', () => {
      const exitCb = vi.fn();
      onExit(exitCb);

      // Spawn first PTY
      spawn('powershell');
      const firstExitHandler = mockOnExit.mock.calls[0][0];

      // Spawn second PTY (kills the first)
      spawn('powershell');

      // First PTY's exit fires asynchronously after being killed
      firstExitHandler({ exitCode: 1, signal: 15 });

      // Exit callback should NOT have been called — it was a stale exit
      expect(exitCb).not.toHaveBeenCalled();
    });

    it('fires exit callback for the current PTY', () => {
      const exitCb = vi.fn();
      onExit(exitCb);

      spawn('powershell');
      const exitHandler = mockOnExit.mock.calls[mockOnExit.mock.calls.length - 1][0];

      // Current PTY exits normally
      exitHandler({ exitCode: 0, signal: 0 });

      expect(exitCb).toHaveBeenCalledWith(0, 0);
    });
  });
});
