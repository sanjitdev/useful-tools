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
  version: '1.4.0',
  generated: '2026-08-10',
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
    Object.freeze({
      name: 'HT.search',
      signature: '(query: string) => Promise<readonly Array<{slug, title, score, matchedField}>> | readonly Array<{slug, title, score, matchedField}>',
      stability: 'stable',
      module: 'assets/js/search.js',
      notes: 'Lazy-built index over tools.json. NFKD-normalized + case-insensitive. Returns up to 10 ranked results, sorted by score desc, search-priority asc, title asc. Returns a Promise<readonly Array<...>> when the engine falls through to fetch (tool pages) or when a sync data source is available. Returns a frozen Array<...> directly when the engine short-circuits on embed mode, non-string query, or empty/whitespace query (no results to compute). Always thenable-safe via `Promise.resolve(HT.search(q)).then(...)`. Returns [] in embed mode, on empty/whitespace query, and on no-match. Embed mode never builds the index.',
    }),
    Object.freeze({
      name: 'HT.siteConfig',
      signature: '{ readonly repoUrl: string, readonly blobBase: string, readonly defaultBranch: string, readonly brand: string, readonly defaultLocale: string }',
      stability: 'stable',
      module: 'assets/js/site-config.js',
      notes: 'Frozen repo/site config consumed by the Shell footer link wiring (Story 1.12, AD-11). The blobBase is the GitHub blob URL prefix for the default branch; the footer "View source" link is "<blobBase>/<entry.path or tools/<slug>/index.html>". Mutation throws in strict mode (Object.freeze). The repo fields (repoOwner, repoName, defaultBranch, brand, defaultLocale) live on HT_SITE_CONFIG (window) for the gate; HT.siteConfig exposes only the derived public surface.',
    }),
    Object.freeze({
      name: 'HT.provide',
      signature: '(slug: string, api: object) => void',
      stability: 'stable',
      module: 'assets/js/shell.js',
      notes: 'Story 1.14 / AD-14. A Tool that exposes an API to other Tools registers it here. Slug must be kebab-case (^[a-z][a-z0-9-]*[a-z0-9]$, 2-64 chars). Throws on duplicate slug, invalid slug, or null/non-object api. The api is frozen by Object.freeze after registration. Tools must NOT call HT.provide on themselves — the registry exists for Tool-to-Tool APIs only.',
    }),
    Object.freeze({
      name: 'HT.use',
      signature: '(slug: string) => any',
      stability: 'stable',
      module: 'assets/js/shell.js',
      notes: 'Story 1.14 / AD-14. Returns the frozen API object registered by HT.provide(slug, ...), or null if absent. Invalid slugs return null silently (defensive). Consumer-side counterpart to HT.provide.',
    }),
    Object.freeze({
      name: 'HT.net.get',
      signature: '(url: string, options?: object) => Promise<Response>',
      stability: 'stable',
      module: 'assets/js/shell.js',
      notes: 'Story 1.14. The only fetch API Tools may use. Wraps fetch with a single-flight abort per (method, url) pair so a superseding superseding call cancels the previous one. The bypass grep flags direct fetch() / XMLHttpRequest calls under tools/<slug>/<slug>.js as violations.',
    }),
    Object.freeze({
      name: 'HT.net.head',
      signature: '(url: string, options?: object) => Promise<Response>',
      stability: 'stable',
      module: 'assets/js/shell.js',
      notes: 'Story 1.14. Convenience wrapper for HEAD requests that routes through the same single-flight layer as HT.net.get.',
    }),
    Object.freeze({
      name: 'HT.net.abort',
      signature: '(key: string) => void',
      stability: 'stable',
      module: 'assets/js/shell.js',
      notes: 'Story 1.14. Cancel an in-flight request by inflight key (e.g. "GET <url>") or by URL string. No-op if nothing matches; idempotent.',
    }),
    Object.freeze({
      name: 'HT.provideRegistry',
      signature: '{ list: () => readonly string[] }',
      stability: 'internal',
      module: 'assets/js/shell.js',
      notes: 'Story 1.14. Internal List of registered slugs for the bypass gate + tests. Tools calling this is undefined behavior.',
    }),
    Object.freeze({
      name: 'HT.useRegistry',
      signature: '{ list: () => readonly string[] }',
      stability: 'internal',
      module: 'assets/js/shell.js',
      notes: 'Story 1.14. Alias for HT.provideRegistry — same keys, same semantics. Tools calling this is undefined behavior.',
    }),
    Object.freeze({
      name: 'HT.netRegistry',
      signature: '{ inflight: () => readonly string[] }',
      stability: 'internal',
      module: 'assets/js/shell.js',
      notes: 'Story 1.14. Internal view of in-flight net requests. Tools calling this is undefined behavior.',
    }),
  ]),
});