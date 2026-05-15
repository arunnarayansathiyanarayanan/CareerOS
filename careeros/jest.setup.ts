import { beforeEach } from "@jest/globals";

import { mockRouterReplace, mockRouterPush } from "next/navigation";

if (typeof globalThis.structuredClone !== "function") {
  const { structuredClone } = require("node:util") as typeof import("node:util");
  globalThis.structuredClone = structuredClone;
}

if (typeof globalThis.TextEncoder === "undefined") {
  const util = require("node:util") as typeof import("node:util");
  globalThis.TextEncoder = util.TextEncoder as typeof globalThis.TextEncoder;
  globalThis.TextDecoder = util.TextDecoder as typeof globalThis.TextDecoder;
}

if (typeof globalThis.ReadableStream === "undefined") {
  const web = require("node:stream/web") as typeof import("node:stream/web");
  globalThis.ReadableStream = web.ReadableStream as typeof globalThis.ReadableStream;
  globalThis.WritableStream = web.WritableStream as typeof globalThis.WritableStream;
  globalThis.TransformStream = web.TransformStream as typeof globalThis.TransformStream;
}

if (typeof globalThis.Response !== "function") {
  if (typeof (globalThis as unknown as { MessagePort?: unknown }).MessagePort === "undefined") {
    (globalThis as unknown as { MessagePort: unknown }).MessagePort = class {} as unknown;
  }
  const undici = require("undici") as typeof import("undici");
  globalThis.Response = undici.Response as typeof globalThis.Response;
  globalThis.Request = undici.Request as typeof globalThis.Request;
  globalThis.Headers = undici.Headers as typeof globalThis.Headers;
}

if (typeof window !== "undefined") {
  require("@testing-library/jest-dom");

  if (typeof globalThis.DataTransfer === "undefined") {
    class DataTransferPolyfill {
      private readonly _files: File[] = [];
      items = {
        add: (file: File) => {
          this._files.push(file);
        },
        remove: () => {},
        clear: () => {
          this._files.length = 0;
        },
        get length() {
          return this._files.length;
        },
      };
      get files(): FileList {
        const list = this._files;
        const fileList = {
          length: list.length,
          item: (index: number) => list[index] ?? null,
          [Symbol.iterator]: function* () {
            yield* list;
          },
        };
        return fileList as FileList;
      }
      types: string[] = [];
      dropEffect = "none";
      effectAllowed = "all";
    }
    globalThis.DataTransfer =
      DataTransferPolyfill as unknown as typeof DataTransfer;
  }
}

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://127.0.0.1:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.OPENAI_API_KEY ??= "test-openai-key";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

global.ResizeObserver ??= ResizeObserverMock;

if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

beforeEach(() => {
  mockRouterReplace.mockClear();
  mockRouterPush.mockClear();
});
