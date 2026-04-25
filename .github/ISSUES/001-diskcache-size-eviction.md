Title: DiskCache: add size-based eviction + metrics

Problem:
- `src/cache.js` only evicts by entry count (`maxEntries`). Large items may cause unbounded disk usage.

Proposal:
- Implement size-based LRU eviction (max total bytes) and expose simple metrics (currentEntries, totalBytes, hits, misses).
- Add tests for eviction behavior.

Files: `src/cache.js`, `tests`
