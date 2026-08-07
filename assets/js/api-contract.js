/* ============================================
   Handy Tools — api-contract.js (AD-14)
   Public API surface for the Shell. Every entry
   below is contractually committed; breaking
   changes require a major version bump.
   Stability: stable (consumed by Tool pages
   and other Shell modules).
   ============================================ */

window.HT = window.HT || {};

window.HT.__apiContract = Object.freeze({
  version: '1.1.0',
  generated: '2026-08-07',
  entries: Object.freeze([
    Object.freeze({
      name: 'HT.boot',
      signature: '() => void',
      stability: 'stable',
      module: 'assets/js/shell.js',
      notes: 'Idempotent. Safe to call twice — second call is a no-op.',
    }),
    Object.freeze({
      name: 'HT.shell.version',
      signature: 'string',
      stability: 'stable',
      module: 'assets/js/shell.js',
      notes: 'Shell module version. Bumped per AD-14 breaking-change rule.',
    }),
    Object.freeze({
      name: 'HT.shell.loadedAt',
      signature: 'number',
      stability: 'stable',
      module: 'assets/js/shell.js',
      notes: 'performance.now() value captured at boot. Used by Story X.3 bundle-size gating.',
    }),
    Object.freeze({
      name: 'HT.shell.theme',
      signature: '() => string | null',
      stability: 'stable',
      module: 'assets/js/shell.js',
      notes: 'Returns the live data-theme attribute value. Mutated externally by Story 1.6.',
    }),
    Object.freeze({
      name: 'HT.palette.open',
      signature: '() => void',
      stability: 'stable',
      module: 'assets/js/shell.js',
      notes: 'Open the command palette. No-op in embed mode or if already open.',
    }),
    Object.freeze({
      name: 'HT.palette.close',
      signature: '() => void',
      stability: 'stable',
      module: 'assets/js/shell.js',
      notes: 'Close the command palette. No-op if already closed. Restores focus to the calling element.',
    }),
    Object.freeze({
      name: 'HT.palette.toggle',
      signature: '() => void',
      stability: 'stable',
      module: 'assets/js/shell.js',
      notes: 'Toggle the command palette. Equivalent to close() when open, open() when closed.',
    }),
    Object.freeze({
      name: 'HT.palette.isOpen',
      signature: '() => boolean',
      stability: 'stable',
      module: 'assets/js/shell.js',
      notes: 'Returns true if the palette overlay is currently open.',
    }),
    Object.freeze({
      name: 'HT.storage.get',
      signature: '(key: string, fallback?: any) => any',
      stability: 'stable',
      module: 'assets/js/storage-registry.js',
      notes: 'Reads a registered key. Throws (CI mode) or warns (dev) for unregistered keys. ht.* keys return plain strings; handy-tools.* keys are JSON-decoded. Implements the legacy-key migration fallback (Story 1.10 / Task 9).',
    }),
    Object.freeze({
      name: 'HT.storage.set',
      signature: '(key: string, value: any) => boolean',
      stability: 'stable',
      module: 'assets/js/storage-registry.js',
      notes: 'Writes a registered key. ht.* keys must be plain strings (FOUC IIFE compatibility); handy-tools.* keys must be JSON-serializable. Throws for malformed values.',
    }),
    Object.freeze({
      name: 'HT.storage.remove',
      signature: '(key: string) => boolean',
      stability: 'stable',
      module: 'assets/js/storage-registry.js',
      notes: 'Removes a registered key. Returns true if the key existed before removal.',
    }),
    Object.freeze({
      name: 'HT.storage.list',
      signature: '() => readonly Array<{key, purpose, lifetime, schema, owner}>',
      stability: 'stable',
      module: 'assets/js/storage-registry.js',
      notes: 'Returns every registered entry, sorted lexicographically by key. Consumed by /privacy (Story 5.6).',
    }),
    Object.freeze({
      name: 'HT.storage.clear',
      signature: '() => void',
      stability: 'stable',
      module: 'assets/js/storage-registry.js',
      notes: 'Removes every registered key. Idempotent. Used by Settings → Clear all local data.',
    }),
    Object.freeze({
      name: 'HT.storage.keys',
      signature: '() => readonly string[]',
      stability: 'stable',
      module: 'assets/js/storage-registry.js',
      notes: 'Returns just the key strings from the registry, sorted.',
    }),
    Object.freeze({
      name: 'HT.storage.register',
      signature: '(key: string, meta: {purpose, lifetime, schema, owner}) => void',
      stability: 'internal',
      module: 'assets/js/storage-registry.js',
      notes: 'Registers a new key. Shell modules call this at boot; Tools must use get/set/remove against keys they own. Throws on duplicate keys or invalid namespace.',
    }),
    Object.freeze({
      name: 'HT.storage.registerHistoryKeys',
      signature: '(tools: Array<{slug, "history-keys": string[]}>) => number',
      stability: 'internal',
      module: 'assets/js/storage-registry.js',
      notes: 'Bulk-registers handy-tools.history.<slug> for every tool with non-empty history-keys. Called by shell.js boot after HT.homeGrid.entries is available.',
    }),
  ]),
});