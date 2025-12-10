// Type declarations for Elide runtime
// These are provided by Elide at runtime but TypeScript needs hints

declare module 'node:http' {
  export function createServer(handler: (req: any, res: any) => void): {
    listen(port: number, callback?: () => void): void;
  };
}

declare module 'node:zlib' {
  export function gzipSync(buffer: Buffer): Buffer;
  export function gunzipSync(buffer: Buffer): Buffer;
}

declare module 'elide:llm' {
  export function version(): string;
  export function huggingface(config: { repo: string; name: string }): any;
  export function params(config: any): any;
  export function inferSync(params: any, model: any, prompt: string): string;
}

declare global {
  const require: (module: string) => any;
  const Buffer: {
    from(str: string, encoding?: string): Buffer;
    byteLength(str: string, encoding?: string): number;
  };
  interface Buffer {
    length: number;
    toString(encoding?: string): string;
  }
}

export {};
