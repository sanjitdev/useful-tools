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
  version: '1.0.0',
  generated: '2026-08-01',
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
  ]),
});