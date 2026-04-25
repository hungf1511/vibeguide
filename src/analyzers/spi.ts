export type Language = "javascript" | "typescript" | "python" | "go" | "rust" | "unknown";

export interface SourceFile {
  path: string;
  absolutePath: string;
  content: string;
  extension: string;
}

export type ImportKind = "static" | "dynamic" | "require" | "re-export";

export interface ImportRef {
  specifier: string;
  kind: ImportKind;
}

export type ExportKind = "named" | "default" | "namespace" | "re-export";
export type MaybePromise<T> = T | Promise<T>;

export interface ExportRef {
  name: string;
  kind: ExportKind;
  specifier?: string;
}

export interface FrameworkHint {
  framework: string;
  confidence: number;
}

export interface SymbolRef {
  name: string;
  kind: "function" | "class" | "variable" | "type" | "interface" | "unknown";
  line?: number;
}

export interface Analyzer {
  readonly language: Language;
  readonly extensions: string[];
  detect(filePath: string, content?: string): boolean;
  parseImports(file: SourceFile): MaybePromise<ImportRef[]>;
  parseExports(file: SourceFile): MaybePromise<ExportRef[]>;
  detectFrameworks?(file: SourceFile): FrameworkHint[];
  parseSymbols?(file: SourceFile): SymbolRef[];
}
