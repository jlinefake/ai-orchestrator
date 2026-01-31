# Codebase Indexing System

A Cursor-like codebase indexing system that provides intelligent, semantic code search capabilities for AI Orchestrator.

## Overview

The codebase indexing system enables natural language queries to retrieve relevant code across entire codebases. It combines multiple retrieval strategies for optimal search quality:

- **BM25 Full-Text Search** - Fast keyword matching using SQLite FTS5
- **Vector Semantic Search** - Meaning-based similarity using embeddings
- **Hybrid Search with RRF** - Best of both worlds with Reciprocal Rank Fusion
- **HyDE Query Expansion** - Improved retrieval for natural language queries
- **Cross-Encoder Reranking** - Precision reordering of top results

## Quick Start

### 1. Index a Codebase

```typescript
import { getCodebaseIndexingService } from './indexing/indexing-service';

const indexingService = getCodebaseIndexingService();

// Index a directory
const stats = await indexingService.indexCodebase('my-store', '/path/to/codebase', {
  force: false, // Set true to reindex all files
});

console.log(`Indexed ${stats.filesIndexed} files, ${stats.chunksCreated} chunks`);
```

### 2. Search the Index

```typescript
import { getHybridSearchService } from './indexing/hybrid-search';

const searchService = getHybridSearchService(db);

const results = await searchService.search({
  query: 'how does authentication work?',
  storeId: 'my-store',
  topK: 10,
  useHyDE: true,
});

results.forEach((r) => {
  console.log(`${r.filePath}:${r.startLine} (score: ${r.score.toFixed(3)})`);
});
```

### 3. Watch for Changes

```typescript
import { CodebaseFileWatcher } from './indexing/file-watcher';

const watcher = new CodebaseFileWatcher('my-store', '/path/to/codebase', {
  debounceMs: 500,
  autoIndex: true,
});

watcher.on('changes:processed', ({ count }) => {
  console.log(`Processed ${count} file changes`);
});

watcher.start();
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Codebase Indexing System                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐       │
│  │ File Watcher  │───▶│ Change Detect │───▶│ Index Queue   │       │
│  │ (Chokidar)    │    │ (Merkle Tree) │    │ (Background)  │       │
│  └───────────────┘    └───────────────┘    └───────┬───────┘       │
│                                                     │                │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────┴───────┐       │
│  │ AST Chunker   │  │ Symbol        │  │ Metadata          │       │
│  │ (Regex-based) │  │ Extractor     │  │ Extractor         │       │
│  └───────┬───────┘  └───────┬───────┘  └───────┬───────────┘       │
│          │                   │                   │                   │
│          └───────────────────┼───────────────────┘                   │
│                              ▼                                       │
│                    ┌───────────────┐                                 │
│                    │ Embedding     │                                 │
│                    │ Pipeline      │                                 │
│                    └───────┬───────┘                                 │
│                            │                                         │
│  ┌───────────────┐         ▼         ┌───────────────┐              │
│  │ BM25 Index    │◀──┬───────────┬──▶│ Vector Index  │              │
│  │ (SQLite FTS5) │   │ Unified   │   │ (SQLite+Cache)│              │
│  └───────┬───────┘   │ Storage   │   └───────┬───────┘              │
│          │           └───────────┘           │                       │
│          └──────────┬────────────────────────┘                       │
│                     ▼                                                │
│           ┌───────────────┐                                          │
│           │ Hybrid Search │                                          │
│           │ + Reranking   │                                          │
│           └───────────────┘                                          │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Key Components

### MerkleTreeManager

Efficiently detects file changes using content hashing. Only changed files are re-indexed.

```typescript
const tree = await merkleTree.buildTree('/path/to/codebase');
const changes = merkleTree.diffTrees(previousTree, currentTree);
// Returns: [{ path: 'src/foo.ts', type: 'modified' }, ...]
```

### TreeSitterChunker

Splits code into semantic chunks preserving function/class boundaries.

```typescript
const chunks = chunker.chunk(content, 'typescript', 'file.ts');
// Each chunk has: content, type, name, startLine, endLine, tokens
```

### MetadataExtractor

Extracts imports, exports, and symbols for dependency analysis.

```typescript
const metadata = await extractor.extractFileMetadata('/path/to/file.ts', content);
// Returns: { imports, exports, symbols, language, framework, ... }
```

### BM25Search

Fast keyword search using SQLite FTS5 with Porter stemming.

```typescript
const results = bm25.search({
  query: 'handleRequest',
  storeId: 'my-store',
  limit: 50,
  boostSymbols: true,
});
```

### HybridSearchService

Combines BM25 and vector search with Reciprocal Rank Fusion.

```typescript
const results = await hybridSearch.search({
  query: 'how to validate user input',
  storeId: 'my-store',
  topK: 10,
  useHyDE: true, // Enable HyDE query expansion
  bm25Weight: 0.4,
  vectorWeight: 0.6,
});
```

### CrossEncoderReranker

Improves precision by reranking top candidates.

```typescript
const reranked = await reranker.rerank(query, candidates);
```

## Data Flow

### Indexing Flow

```
User triggers indexing
        │
        ▼
┌───────────────────┐
│ 1. Scan Directory │  Glob patterns, size filters
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ 2. Detect Changes │  Merkle tree diff
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ 3. Chunk Files    │  Language-aware splitting
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ 4. Extract Meta   │  Imports, exports, symbols
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ 5. Generate Embed │  Vector embeddings
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ 6. Persist Index  │  SQLite + FTS5 + Vectors
└───────────────────┘
```

### Search Flow

```
User query: "how does authentication work?"
                    │
                    ▼
        ┌───────────────────────┐
        │ 1. Query Preprocessor │
        └───────────┬───────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │ 2. HyDE Expansion     │  Optional
        │    (Generate hypo doc)│
        └───────────┬───────────┘
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
┌─────────────────┐ ┌─────────────────┐
│ 3a. BM25 Search │ │ 3b. Vector      │
│     Top 50      │ │     Search Top50│
└────────┬────────┘ └────────┬────────┘
          │                   │
          └─────────┬─────────┘
                    ▼
        ┌───────────────────────┐
        │ 4. RRF Fusion         │
        │    Merge & Dedupe     │
        └───────────┬───────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │ 5. Cross-Encoder      │  Optional
        │    Reranking          │
        └───────────┬───────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │ 6. Return Top K       │
        └───────────────────────┘
```

## Configuration

### Indexing Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `maxConcurrentFiles` | 10 | Parallel file processing |
| `batchSize` | 50 | Files per batch |
| `minIntervalMs` | 100 | Throttle delay between batches |
| `maxChunkTokens` | 8000 | Maximum tokens per chunk |
| `minChunkTokens` | 100 | Minimum tokens per chunk |
| `overlapTokens` | 50 | Overlap between chunks |
| `maxFileSize` | 1MB | Skip files larger than this |
| `includePatterns` | `['**/*.ts', ...]` | File patterns to index |
| `excludePatterns` | `['**/node_modules/**', ...]` | Patterns to exclude |

### Search Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `bm25Weight` | 0.4 | Weight for BM25 results |
| `vectorWeight` | 0.6 | Weight for vector results |
| `useHyDE` | true | Enable HyDE query expansion |
| `useReranking` | true | Enable cross-encoder reranking |
| `defaultTopK` | 10 | Default results to return |
| `maxTopK` | 50 | Maximum results allowed |
| `minScore` | 0.3 | Minimum relevance score |
| `diversityThreshold` | 0.7 | File diversity threshold |

## Supported Languages

| Language | Extension | Chunking | Metadata |
|----------|-----------|----------|----------|
| TypeScript | .ts, .tsx | ✅ | ✅ |
| JavaScript | .js, .jsx, .mjs | ✅ | ✅ |
| Python | .py | ✅ | ✅ |
| Rust | .rs | ✅ | ✅ |
| Go | .go | ✅ | ✅ |
| Java | .java | ✅ | ✅ |
| C/C++ | .c, .cpp, .h | ✅ | ✅ |
| Ruby | .rb | ✅ | ✅ |
| Markdown | .md | ✅ | ❌ |
| JSON | .json | ❌ | ❌ |
| YAML | .yaml, .yml | ❌ | ❌ |

## Events

The indexing service emits events for progress tracking:

```typescript
indexingService.on('progress', (progress) => {
  console.log(`Status: ${progress.status}`);
  console.log(`Files: ${progress.processedFiles}/${progress.totalFiles}`);
  console.log(`Chunks: ${progress.embeddedChunks}/${progress.totalChunks}`);
});

indexingService.on('file:indexed', ({ storeId, filePath }) => {
  console.log(`Indexed: ${filePath}`);
});

indexingService.on('file:error', ({ storeId, filePath, error }) => {
  console.error(`Error indexing ${filePath}: ${error}`);
});
```

## Database Schema

The system uses SQLite with the following key tables:

- `codebase_trees` - Merkle tree snapshots for change detection
- `file_metadata` - File imports, exports, and symbols
- `context_sections` - Indexed code chunks
- `code_fts` - FTS5 virtual table for keyword search
- `embedding_vectors` - Vector embeddings for semantic search

## Troubleshooting

### Indexing is slow

1. Check if large files are being processed - consider increasing `maxFileSize` exclusion
2. Reduce `batchSize` if memory is constrained
3. Ensure `node_modules` and build directories are excluded

### Search returns poor results

1. Try enabling HyDE (`useHyDE: true`) for natural language queries
2. Adjust `bm25Weight`/`vectorWeight` based on query type
3. Enable reranking for improved precision
4. Check if relevant files are actually indexed

### Memory issues

1. Reduce `batchSize` to process fewer files at once
2. Enable `persistAfterBatch` to flush data incrementally
3. Lower `maxConcurrentFiles` for parallel processing

### Files not being indexed

1. Check `includePatterns` matches your file extensions
2. Verify files aren't in `excludePatterns`
3. Check file size is under `maxFileSize` (default 1MB)

## See Also

- [API Reference](./CODEBASE_INDEXING_API.md)
- [Performance Tuning](./CODEBASE_INDEXING_PERFORMANCE.md)
