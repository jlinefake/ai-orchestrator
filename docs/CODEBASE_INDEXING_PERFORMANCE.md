# Codebase Indexing Performance Guide

Guide for optimizing and measuring codebase indexing performance.

## Performance Targets

| Metric | Target | Description |
|--------|--------|-------------|
| **Indexing Speed** | ≥1000 files/min | ~16.67 files/second throughput |
| **Search Latency (p95)** | <500ms | 95th percentile response time |
| **Memory Usage** | <500MB | Peak memory during indexing |
| **Incremental Update** | <5s | Single file re-index time |

## Running Benchmarks

### Run All Benchmarks

```bash
npm run bench
```

### Run Specific Benchmarks

```bash
# Indexing benchmarks only
npm run bench:indexing

# Search benchmarks only
npm run bench:search
```

### Run Load Tests

```bash
npm run test:load
```

### Run with Memory Profiling

```bash
# Enable GC exposure for accurate memory tracking
node --expose-gc node_modules/vitest/vitest.mjs bench
```

## Benchmark Files

| File | Purpose |
|------|---------|
| `src/main/indexing/benchmarks/indexing.bench.ts` | Indexing throughput |
| `src/main/indexing/benchmarks/search.bench.ts` | Search latency |
| `src/main/indexing/benchmarks/benchmark-utils.ts` | Test utilities |

## Interpreting Results

### Indexing Benchmark Output

```
✓ File Scanning
  ✓ glob - scan 100 files (23ms)
  ✓ glob - scan 500 files (87ms)

✓ Merkle Tree
  ✓ build tree - 100 files (156ms)
  ✓ diff trees - detect changes (12ms)

✓ Code Chunking
  ✓ chunk small TypeScript file (2ms)
  ✓ chunk large TypeScript file (15ms)

✓ Throughput Targets
  ✓ verify 1000 files/min target
    Processed 100 files in 4523ms
    Rate: 22.11 files/sec ✓
```

### Search Benchmark Output

```
✓ Hybrid Search
  ✓ hybrid search - basic (35ms p50, 48ms p95)
  ✓ hybrid search with RRF fusion (12ms)

✓ Latency Targets
  ✓ verify p95 < 500ms target
    p50: 145ms
    p95: 287ms ✓
    p99: 312ms
```

## Performance Tuning

### Indexing Speed

#### Increase Parallelism

```typescript
const indexingService = getCodebaseIndexingService({
  maxConcurrentFiles: 20,  // Up from default 10
  batchSize: 100,          // Up from default 50
});
```

**Trade-off:** Higher memory usage

#### Reduce Chunk Processing

```typescript
const indexingService = getCodebaseIndexingService({
  maxChunkTokens: 4000,    // Down from 8000
  minChunkTokens: 200,     // Up from 100
});
```

**Trade-off:** Less granular search results

#### Skip Embedding for Speed

```typescript
// For initial testing, skip embedding generation
const stats = await indexingService.indexCodebase(storeId, rootPath, {
  skipEmbeddings: true,  // BM25 only
});
```

### Search Latency

#### Disable HyDE for Speed

```typescript
const results = await searchService.search({
  query: 'specific function name',
  storeId,
  useHyDE: false,  // Skip LLM call (~100ms savings)
});
```

**Trade-off:** Worse results for natural language queries

#### Disable Reranking

```typescript
const results = await searchService.search({
  query,
  storeId,
  rerank: false,  // Skip reranking (~50ms savings)
});
```

**Trade-off:** Less precise result ordering

#### Reduce Result Count

```typescript
const results = await searchService.search({
  query,
  storeId,
  topK: 5,  // Down from 10
});
```

#### Optimize Weights

For code-heavy queries:
```typescript
{ bm25Weight: 0.6, vectorWeight: 0.4 }
```

For natural language queries:
```typescript
{ bm25Weight: 0.3, vectorWeight: 0.7 }
```

### Memory Usage

#### Reduce Batch Size

```typescript
const indexingService = getCodebaseIndexingService({
  batchSize: 25,  // Down from 50
  persistAfterBatch: true,  // Flush to disk after each batch
});
```

#### Limit File Size

```typescript
const indexingService = getCodebaseIndexingService({
  maxFileSize: 512 * 1024,  // 512KB instead of 1MB
});
```

#### Enable Incremental Persistence

```typescript
const indexingService = getCodebaseIndexingService({
  persistAfterBatch: true,
  compactOnCompletion: true,
});
```

### Incremental Updates

#### Optimize File Watching

```typescript
const watcher = new CodebaseFileWatcher(storeId, rootPath, {
  debounceMs: 1000,         // Wait 1s for batch
  maxPendingChanges: 100,   // Limit queue size
  autoIndex: true,
});
```

#### Pre-warm Merkle Tree

```typescript
// Build tree once at startup
const tree = await merkleTree.buildTree(rootPath);
await merkleTree.saveTree(storeId, tree);
```

## Memory Profiling

### Track Memory Usage

```typescript
import { getMemorySnapshot, formatBytes } from './benchmarks/benchmark-utils';

const before = getMemorySnapshot();

// ... indexing operation ...

const after = getMemorySnapshot();
console.log(`Memory used: ${formatBytes(after.heapUsed - before.heapUsed)}`);
```

### Memory Snapshot Fields

```typescript
interface MemorySnapshot {
  heapUsed: number;    // Actual JS objects
  heapTotal: number;   // Total heap allocated
  external: number;    // Native bindings
  rss: number;         // Resident set size
}
```

### Memory Guidelines

| Codebase Size | Expected Memory |
|---------------|-----------------|
| 100 files | <100MB |
| 500 files | <200MB |
| 1000 files | <400MB |
| 2000 files | <600MB |

## Optimization Strategies

### 1. Batch Processing

Process files in batches to control memory:

```typescript
for (let i = 0; i < files.length; i += batchSize) {
  const batch = files.slice(i, i + batchSize);
  await processBatch(batch);

  // Allow GC between batches
  await new Promise(r => setTimeout(r, 10));
}
```

### 2. Streaming Chunks

Don't hold all chunks in memory:

```typescript
for (const file of files) {
  const chunks = chunker.chunk(content, language, file);
  await persistChunks(chunks);  // Save immediately
  // chunks go out of scope here
}
```

### 3. Index Compression

Compact FTS index after bulk operations:

```typescript
// After indexing many files
bm25.rebuildIndex();  // VACUUM/OPTIMIZE
```

### 4. Connection Pooling

Reuse database connections:

```typescript
// Singleton pattern prevents connection churn
const db = RLMDatabase.getInstance();
```

### 5. Embedding Batching

Batch embedding API calls:

```typescript
// Instead of one-by-one
const embeddings = await embeddingService.embedBatch(
  chunks.map(c => c.content)
);
```

## Load Testing

### Test Large Codebases

```bash
npm run test:load -- --grep "should index 1000"
```

### Test Concurrent Operations

```bash
npm run test:load -- --grep "concurrent"
```

### Test Memory Limits

```bash
npm run test:load -- --grep "memory"
```

## Monitoring in Production

### Track Indexing Metrics

```typescript
indexingService.on('progress', (progress) => {
  const rate = progress.processedFiles /
    ((Date.now() - progress.startedAt!) / 1000 / 60);

  console.log(`Rate: ${rate.toFixed(1)} files/min`);
});
```

### Track Search Latency

```typescript
const startTime = performance.now();
const results = await searchService.search(options);
const latency = performance.now() - startTime;

// Log for monitoring
metricsLogger.log('search_latency', latency);
```

### Memory Monitoring

```typescript
setInterval(() => {
  const mem = process.memoryUsage();
  if (mem.heapUsed > 400 * 1024 * 1024) {
    console.warn('High memory usage:', formatBytes(mem.heapUsed));
  }
}, 60000);
```

## Common Performance Issues

### Issue: Slow Initial Indexing

**Symptoms:** First indexing takes very long

**Solutions:**
1. Exclude large directories (`node_modules`, `dist`)
2. Reduce `maxFileSize` to skip large files
3. Increase `batchSize` and `maxConcurrentFiles`

### Issue: High Search Latency

**Symptoms:** Search >500ms regularly

**Solutions:**
1. Disable HyDE for simple queries
2. Reduce `topK` result count
3. Check if index needs rebuilding

### Issue: Memory Growth

**Symptoms:** Memory increases over time

**Solutions:**
1. Enable `persistAfterBatch`
2. Reduce `batchSize`
3. Check for retained references

### Issue: Slow Incremental Updates

**Symptoms:** File changes take >5s to reflect

**Solutions:**
1. Reduce file watcher debounce
2. Pre-build merkle tree
3. Skip unchanged file verification

## Hardware Recommendations

### Minimum

- 4GB RAM
- 2 CPU cores
- SSD storage

### Recommended

- 8GB RAM
- 4+ CPU cores
- NVMe SSD

### For Large Codebases (5000+ files)

- 16GB RAM
- 8+ CPU cores
- NVMe SSD with high IOPS
