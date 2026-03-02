/**
 * AST-Based Content Chunker
 *
 * Provides intelligent code chunking that respects syntactical boundaries.
 * Uses bracket-counting heuristics for common languages without requiring
 * external tree-sitter binaries.
 *
 * Features:
 * - Language-aware chunking (TypeScript, Python, etc.)
 * - Respects function, class, and block boundaries
 * - Falls back to semantic splitting for unknown languages
 * - Maintains code context and readability
 */

import { getTokenCounter, TokenCounter } from './token-counter';

export interface ChunkConfig {
  /** Maximum tokens per chunk (default: 8000) */
  maxTokens: number;
  /** Preferred minimum tokens per chunk (default: 500) */
  minTokens: number;
  /** Whether to include context comments (default: true) */
  includeContext: boolean;
  /** Whether to preserve imports at chunk start (default: true) */
  preserveImports: boolean;
}

export interface CodeChunk {
  content: string;
  tokens: number;
  startLine: number;
  endLine: number;
  type: 'function' | 'class' | 'block' | 'imports' | 'mixed';
  name?: string;
  language?: string;
}

interface BracketState {
  curly: number; // {}
  paren: number; // ()
  square: number; // []
  angle: number; // <> (for generics)
}

interface BlockBoundary {
  startLine: number;
  endLine: number;
  type: 'function' | 'class' | 'block' | 'imports';
  name?: string;
  indentLevel: number;
}

const DEFAULT_CONFIG: ChunkConfig = {
  maxTokens: 8000,
  minTokens: 500,
  includeContext: true,
  preserveImports: true
};

// Language detection patterns
const LANGUAGE_PATTERNS = {
  typescript:
    /\b(interface|type|enum|namespace|declare)\b|:\s*\w+\s*[;,)=]|<\w+>/,
  javascript: /\b(const|let|var|function|class|import|export|async|await)\b/,
  python: /\b(def|class|import|from|async|await|with|lambda)\b|:\s*$/m,
  rust: /\b(fn|struct|impl|enum|trait|mod|use|pub|mut|let)\b/,
  go: /\b(func|struct|interface|package|import|type|var|const)\b/,
  java: /\b(public|private|protected|class|interface|extends|implements)\b/,
  cpp: /\b(class|struct|namespace|template|public:|private:|protected:)\b|#include/,
  ruby: /\b(def|class|module|require|attr_accessor|attr_reader)\b/
};

export class AstChunker {
  private config: ChunkConfig;
  private tokenCounter: TokenCounter;

  constructor(config: Partial<ChunkConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.tokenCounter = getTokenCounter();
  }

  /**
   * Chunk content intelligently based on language structure
   */
  chunk(content: string, language?: string): CodeChunk[] {
    const detectedLang = language || this.detectLanguage(content);
    const lines = content.split('\n');

    // Find block boundaries
    const boundaries = this.findBlockBoundaries(lines, detectedLang);

    // Group boundaries into chunks respecting token limits
    const chunks = this.groupIntoChunks(lines, boundaries, detectedLang);

    return chunks;
  }

  /**
   * Detect programming language from content
   */
  detectLanguage(content: string): string {
    for (const [lang, pattern] of Object.entries(LANGUAGE_PATTERNS)) {
      if (pattern.test(content)) {
        return lang;
      }
    }
    return 'unknown';
  }

  /**
   * Find syntactical block boundaries in the code
   */
  private findBlockBoundaries(
    lines: string[],
    language: string
  ): BlockBoundary[] {
    const boundaries: BlockBoundary[] = [];
    const bracketState: BracketState = {
      curly: 0,
      paren: 0,
      square: 0,
      angle: 0
    };

    let currentBlock: BlockBoundary | null = null;
    let importBlock: BlockBoundary | null = null;
    let inMultilineString = false;
    let inComment = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Track multiline strings and comments
      if (this.isInStringOrComment(line, inMultilineString, inComment)) {
        const result = this.updateStringCommentState(
          line,
          inMultilineString,
          inComment
        );
        inMultilineString = result.inString;
        inComment = result.inComment;
        continue;
      }

      // Track import/require blocks
      if (this.isImportLine(trimmed, language)) {
        if (!importBlock) {
          importBlock = {
            startLine: i,
            endLine: i,
            type: 'imports',
            indentLevel: this.getIndentLevel(line)
          };
        } else {
          importBlock.endLine = i;
        }
        continue;
      } else if (importBlock && trimmed.length > 0) {
        // End import block
        boundaries.push(importBlock);
        importBlock = null;
      }

      // Detect function/class declarations
      const declaration = this.detectDeclaration(trimmed, language);
      if (declaration) {
        if (currentBlock && bracketState.curly === 0) {
          currentBlock.endLine = i - 1;
          if (currentBlock.endLine >= currentBlock.startLine) {
            boundaries.push(currentBlock);
          }
        }

        currentBlock = {
          startLine: i,
          endLine: i,
          type: declaration.type,
          name: declaration.name,
          indentLevel: this.getIndentLevel(line)
        };
      }

      // Track brackets
      this.updateBracketState(line, bracketState, language);

      // Update current block end
      if (currentBlock) {
        currentBlock.endLine = i;

        // Check if block is complete
        if (bracketState.curly === 0 && i > currentBlock.startLine) {
          // Look for block end indicators
          if (
            this.isBlockEnd(
              trimmed,
              language,
              currentBlock.indentLevel,
              this.getIndentLevel(line)
            )
          ) {
            boundaries.push(currentBlock);
            currentBlock = null;
          }
        }
      }
    }

    // Close any remaining blocks
    if (importBlock) {
      boundaries.push(importBlock);
    }
    if (currentBlock) {
      currentBlock.endLine = lines.length - 1;
      boundaries.push(currentBlock);
    }

    return boundaries;
  }

  /**
   * Detect function/class declarations
   */
  private detectDeclaration(
    line: string,
    language: string
  ): { type: 'function' | 'class'; name?: string } | null {
    // TypeScript/JavaScript
    if (['typescript', 'javascript'].includes(language)) {
      // Function declarations
      const funcMatch = line.match(
        /(?:async\s+)?(?:function\s+)?(\w+)\s*(?:<[^>]*>)?\s*\(/
      );
      if (
        funcMatch &&
        !line.includes('if') &&
        !line.includes('while') &&
        !line.includes('for')
      ) {
        return { type: 'function', name: funcMatch[1] };
      }

      // Arrow functions
      const arrowMatch = line.match(
        /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=]+)\s*=>/
      );
      if (arrowMatch) {
        return { type: 'function', name: arrowMatch[1] };
      }

      // Class declarations
      const classMatch = line.match(/class\s+(\w+)/);
      if (classMatch) {
        return { type: 'class', name: classMatch[1] };
      }

      // Method definitions (inside classes)
      const methodMatch = line.match(
        /(?:async\s+)?(?:static\s+)?(?:private\s+|public\s+|protected\s+)?(\w+)\s*\(/
      );
      if (methodMatch && !line.startsWith('if') && !line.startsWith('while')) {
        return { type: 'function', name: methodMatch[1] };
      }
    }

    // Python
    if (language === 'python') {
      const defMatch = line.match(/^(?:async\s+)?def\s+(\w+)/);
      if (defMatch) {
        return { type: 'function', name: defMatch[1] };
      }

      const classMatch = line.match(/^class\s+(\w+)/);
      if (classMatch) {
        return { type: 'class', name: classMatch[1] };
      }
    }

    // Rust
    if (language === 'rust') {
      const fnMatch = line.match(/(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/);
      if (fnMatch) {
        return { type: 'function', name: fnMatch[1] };
      }

      const structMatch = line.match(/(?:pub\s+)?(?:struct|impl)\s+(\w+)/);
      if (structMatch) {
        return { type: 'class', name: structMatch[1] };
      }
    }

    // Go
    if (language === 'go') {
      const funcMatch = line.match(/func\s+(?:\([^)]+\)\s+)?(\w+)/);
      if (funcMatch) {
        return { type: 'function', name: funcMatch[1] };
      }

      const typeMatch = line.match(/type\s+(\w+)\s+struct/);
      if (typeMatch) {
        return { type: 'class', name: typeMatch[1] };
      }
    }

    return null;
  }

  /**
   * Check if line is an import statement
   */
  private isImportLine(line: string, language: string): boolean {
    if (['typescript', 'javascript'].includes(language)) {
      return /^import\s|^export\s.*from\s|^require\(/.test(line);
    }
    if (language === 'python') {
      return /^import\s|^from\s.*import/.test(line);
    }
    if (language === 'rust') {
      return /^use\s/.test(line);
    }
    if (language === 'go') {
      return /^import\s/.test(line) || /^\s*".*"$/.test(line);
    }
    return false;
  }

  /**
   * Update bracket state for a line
   */
  private updateBracketState(
    line: string,
    state: BracketState,
    language: string
  ): void {
    // Skip strings and comments
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const prev = i > 0 ? line[i - 1] : '';

      // Handle string tracking
      if ((char === '"' || char === "'" || char === '`') && prev !== '\\') {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
        }
        continue;
      }

      if (inString) continue;

      // Skip line comments
      if (char === '/' && line[i + 1] === '/') break;
      if (char === '#' && language === 'python') break;

      // Count brackets
      switch (char) {
        case '{':
          state.curly++;
          break;
        case '}':
          state.curly--;
          break;
        case '(':
          state.paren++;
          break;
        case ')':
          state.paren--;
          break;
        case '[':
          state.square++;
          break;
        case ']':
          state.square--;
          break;
        case '<':
          if (language === 'typescript') state.angle++;
          break;
        case '>':
          if (language === 'typescript') state.angle--;
          break;
      }
    }
  }

  /**
   * Get indentation level of a line
   */
  private getIndentLevel(line: string): number {
    const match = line.match(/^(\s*)/);
    return match ? match[1].length : 0;
  }

  /**
   * Check if line ends a block
   */
  private isBlockEnd(
    line: string,
    language: string,
    startIndent: number,
    currentIndent: number
  ): boolean {
    if (language === 'python') {
      // Python uses indentation
      return (
        line.length > 0 && currentIndent <= startIndent && !line.match(/^\s*#/)
      );
    }

    // C-style languages - look for closing brace at block level
    return line === '}' || (line.endsWith('}') && currentIndent <= startIndent);
  }

  /**
   * Check if inside string or comment
   */
  private isInStringOrComment(
    line: string,
    inString: boolean,
    inComment: boolean
  ): boolean {
    return inString || inComment;
  }

  /**
   * Update multiline string/comment state
   */
  private updateStringCommentState(
    line: string,
    inString: boolean,
    inComment: boolean
  ): { inString: boolean; inComment: boolean } {
    // Check for multiline comment end
    if (inComment && line.includes('*/')) {
      return { inString, inComment: false };
    }

    // Check for multiline string end (triple quotes for Python)
    if (inString && (line.includes('"""') || line.includes("'''"))) {
      return { inString: false, inComment };
    }

    return { inString, inComment };
  }

  /**
   * Group boundaries into chunks respecting token limits
   */
  private groupIntoChunks(
    lines: string[],
    boundaries: BlockBoundary[],
    language: string
  ): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    let currentChunk: string[] = [];
    let currentTokens = 0;
    let chunkStartLine = 0;
    let chunkType: CodeChunk['type'] = 'mixed';
    let chunkName: string | undefined;

    // Separate imports if configured
    let imports: string[] = [];
    let importEndLine = -1;

    if (this.config.preserveImports) {
      const importBoundaries = boundaries.filter((b) => b.type === 'imports');
      if (importBoundaries.length > 0) {
        const importLines = importBoundaries.flatMap((b) =>
          lines.slice(b.startLine, b.endLine + 1)
        );
        const importTokens = this.tokenCounter.countTokens(
          importLines.join('\n')
        );

        if (importTokens < this.config.maxTokens * 0.3) {
          imports = importLines;
          importEndLine = importBoundaries[importBoundaries.length - 1].endLine;
        }
      }
    }

    // Process non-import boundaries
    const codeBoundaries = boundaries.filter((b) => b.type !== 'imports');
    let lineIndex = importEndLine + 1;

    for (const boundary of codeBoundaries) {
      // Add any lines between boundaries
      if (boundary.startLine > lineIndex) {
        const betweenLines = lines.slice(lineIndex, boundary.startLine);
        const betweenContent = betweenLines.join('\n');
        const betweenTokens = this.tokenCounter.countTokens(betweenContent);

        if (currentTokens + betweenTokens <= this.config.maxTokens) {
          currentChunk.push(...betweenLines);
          currentTokens += betweenTokens;
        } else if (currentChunk.length > 0) {
          // Flush current chunk
          chunks.push(
            this.createChunk(
              currentChunk,
              chunkStartLine,
              chunkType,
              chunkName,
              language,
              imports
            )
          );
          currentChunk = betweenLines;
          currentTokens = betweenTokens;
          chunkStartLine = lineIndex;
          chunkType = 'mixed';
          chunkName = undefined;
        }
      }

      // Get boundary content
      const boundaryLines = lines.slice(
        boundary.startLine,
        boundary.endLine + 1
      );
      const boundaryContent = boundaryLines.join('\n');
      const boundaryTokens = this.tokenCounter.countTokens(boundaryContent);

      // Check if boundary fits in current chunk
      if (currentTokens + boundaryTokens <= this.config.maxTokens) {
        if (currentChunk.length === 0) {
          chunkStartLine = boundary.startLine;
          chunkType = boundary.type;
          chunkName = boundary.name;
        }
        currentChunk.push(...boundaryLines);
        currentTokens += boundaryTokens;
      } else {
        // Flush current chunk if not empty
        if (currentChunk.length > 0) {
          chunks.push(
            this.createChunk(
              currentChunk,
              chunkStartLine,
              chunkType,
              chunkName,
              language,
              imports
            )
          );
        }

        // Start new chunk with boundary
        if (boundaryTokens <= this.config.maxTokens) {
          currentChunk = boundaryLines;
          currentTokens = boundaryTokens;
          chunkStartLine = boundary.startLine;
          chunkType = boundary.type;
          chunkName = boundary.name;
        } else {
          // Boundary itself is too large, force split
          const splitChunks = this.forceSplitBlock(
            boundaryLines,
            boundary,
            language,
            imports
          );
          chunks.push(...splitChunks);
          currentChunk = [];
          currentTokens = 0;
        }
      }

      lineIndex = boundary.endLine + 1;
    }

    // Handle remaining lines
    if (lineIndex < lines.length) {
      const remaining = lines.slice(lineIndex);
      const remainingTokens = this.tokenCounter.countTokens(
        remaining.join('\n')
      );

      if (currentTokens + remainingTokens <= this.config.maxTokens) {
        currentChunk.push(...remaining);
        currentTokens += remainingTokens;
      } else {
        if (currentChunk.length > 0) {
          chunks.push(
            this.createChunk(
              currentChunk,
              chunkStartLine,
              chunkType,
              chunkName,
              language,
              imports
            )
          );
        }
        chunks.push(
          this.createChunk(
            remaining,
            lineIndex,
            'mixed',
            undefined,
            language,
            imports
          )
        );
      }
    }

    // Flush final chunk
    if (currentChunk.length > 0) {
      chunks.push(
        this.createChunk(
          currentChunk,
          chunkStartLine,
          chunkType,
          chunkName,
          language,
          imports
        )
      );
    }

    return chunks;
  }

  /**
   * Create a chunk object
   */
  private createChunk(
    lines: string[],
    startLine: number,
    type: CodeChunk['type'],
    name: string | undefined,
    language: string,
    imports: string[]
  ): CodeChunk {
    let content = lines.join('\n');

    // Prepend imports if configured and chunk doesn't already have them
    if (
      this.config.preserveImports &&
      imports.length > 0 &&
      type !== 'imports'
    ) {
      const hasImports = this.isImportLine(lines[0]?.trim() || '', language);
      if (!hasImports) {
        content = imports.join('\n') + '\n\n' + content;
      }
    }

    return {
      content,
      tokens: this.tokenCounter.countTokens(content),
      startLine,
      endLine: startLine + lines.length - 1,
      type,
      name,
      language
    };
  }

  /**
   * Force split a large block that exceeds token limits
   */
  private forceSplitBlock(
    lines: string[],
    boundary: BlockBoundary,
    language: string,
    imports: string[]
  ): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    let currentLines: string[] = [];
    let currentTokens = 0;
    let partIndex = 0;

    for (const line of lines) {
      const lineTokens = this.tokenCounter.countTokens(line);

      if (
        currentTokens + lineTokens > this.config.maxTokens &&
        currentLines.length > 0
      ) {
        // Add context comment for continuation
        if (this.config.includeContext) {
          currentLines.unshift(
            `// ${boundary.name || 'Block'} (part ${partIndex + 1})`
          );
        }

        chunks.push(
          this.createChunk(
            currentLines,
            boundary.startLine + partIndex * Math.floor(lines.length / 2),
            boundary.type,
            boundary.name
              ? `${boundary.name} (part ${partIndex + 1})`
              : undefined,
            language,
            imports
          )
        );

        currentLines = [];
        currentTokens = 0;
        partIndex++;
      }

      currentLines.push(line);
      currentTokens += lineTokens;
    }

    // Add final chunk
    if (currentLines.length > 0) {
      if (this.config.includeContext && partIndex > 0) {
        currentLines.unshift(
          `// ${boundary.name || 'Block'} (part ${partIndex + 1})`
        );
      }

      chunks.push(
        this.createChunk(
          currentLines,
          boundary.startLine + partIndex * Math.floor(lines.length / 2),
          boundary.type,
          boundary.name
            ? `${boundary.name} (part ${partIndex + 1})`
            : undefined,
          language,
          imports
        )
      );
    }

    return chunks;
  }

  /**
   * Configure the chunker
   */
  configure(config: Partial<ChunkConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Factory function
export function createAstChunker(config?: Partial<ChunkConfig>): AstChunker {
  return new AstChunker(config);
}

// Singleton for common use
let instance: AstChunker | null = null;

export function getAstChunker(config?: Partial<ChunkConfig>): AstChunker {
  if (!instance) {
    instance = new AstChunker(config);
  }
  return instance;
}

export function _resetAstChunkerForTesting(): void {
  instance = null;
}
