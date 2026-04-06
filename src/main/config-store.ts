import Store from 'electron-store';
import log from 'electron-log/main';
import { configSchema, configDefaults, type Config } from '@shared/config-schema';

const logger = log.scope('config-store');

/** Minimal interface matching electron-store / conf API we use */
interface ElectronStoreInstance {
  store: Record<string, unknown>;
  path: string;
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  set(object: Record<string, unknown>): void;
  onDidAnyChange(
    callback: (newValue: Record<string, unknown>, oldValue: Record<string, unknown>) => void,
  ): () => void;
}

export type ConfigChangeCallback = (key: keyof Config, value: unknown, oldValue: unknown) => void;

export interface ConfigStore {
  get<K extends keyof Config>(key: K): Config[K];
  set<K extends keyof Config>(key: K, value: Config[K]): void;
  getAll(): Config;
  getConfigPath(): string;
  onDidChange(callback: ConfigChangeCallback): () => void;
}

export function createConfigStore(): ConfigStore {
  // Safe deserializer: if the user writes invalid JSON (e.g. comments),
  // return an empty object instead of crashing the process.
  let lastGoodStore: Record<string, unknown> = {};
  const safeDeserialize = (text: string): Record<string, unknown> => {
    try {
      const parsed = JSON.parse(text);
      lastGoodStore = parsed;
      return parsed;
    } catch (err) {
      logger.warn('Config file contains invalid JSON — ignoring external edit until fixed.', (err as Error).message);
      return lastGoodStore;
    }
  };

  const store = new Store<Record<string, unknown>>({ watch: true, deserialize: safeDeserialize as never }) as unknown as ElectronStoreInstance;

  // Load and validate existing config
  const raw = store.store;
  const result = configSchema.safeParse(raw);

  let config: Config;

  if (result.success) {
    config = result.data;
  } else {
    logger.warn(
      'Config validation failed, correcting invalid fields:',
      result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    );

    // Merge valid fields with defaults: for each field, try to keep the raw
    // value if it individually validates, otherwise fall back to the default.
    const corrected: Record<string, unknown> = {};
    for (const key of Object.keys(configDefaults) as (keyof Config)[]) {
      const fieldSchema = configSchema.shape[key];
      const fieldResult = fieldSchema.safeParse(raw[key]);
      corrected[key] = fieldResult.success
        ? fieldResult.data
        : configDefaults[key];
    }
    config = corrected as Config;
  }

  // Persist corrected/default config back to disk
  store.set(config as Record<string, unknown>);

  // Change listener management
  const changeListeners = new Set<ConfigChangeCallback>();

  // Watch for external file changes via electron-store's built-in watcher
  store.onDidAnyChange((newStore, _oldStore) => {
    if (!newStore) return;
    const configKeys = Object.keys(configDefaults) as (keyof Config)[];
    for (const key of configKeys) {
      const newVal = newStore[key];
      const oldVal = config[key];
      // Skip if value hasn't changed
      if (JSON.stringify(newVal) === JSON.stringify(oldVal)) continue;

      // Validate the changed field
      const fieldSchema = configSchema.shape[key];
      const fieldResult = fieldSchema.safeParse(newVal);

      if (!fieldResult.success) {
        logger.warn(
          `External config change rejected for "${key}": ${fieldResult.error.issues.map((i) => i.message).join(', ')}. Keeping last-known-good value.`,
        );
        continue;
      }

      // Apply validated value
      const previousValue = config[key];
      config = { ...config, [key]: fieldResult.data };
      logger.info(`Config hot-reload: "${key}" changed`);

      // Notify listeners
      for (const listener of changeListeners) {
        listener(key, fieldResult.data, previousValue);
      }
    }
  });

  return {
    get<K extends keyof Config>(key: K): Config[K] {
      return config[key];
    },

    set<K extends keyof Config>(key: K, value: Config[K]): void {
      const fieldSchema = configSchema.shape[key];
      const fieldResult = fieldSchema.safeParse(value);
      if (!fieldResult.success) {
        const msg = `Invalid value for "${key}": ${fieldResult.error.issues.map((i) => i.message).join(', ')}`;
        logger.error(msg);
        throw new Error(msg);
      }
      config = { ...config, [key]: fieldResult.data };
      store.set(key, fieldResult.data);
    },

    getAll(): Config {
      return { ...config };
    },

    getConfigPath(): string {
      return store.path;
    },

    onDidChange(callback: ConfigChangeCallback): () => void {
      changeListeners.add(callback);
      return () => {
        changeListeners.delete(callback);
      };
    },
  };
}
