import { jest } from "@jest/globals";

export const mockRouterReplace = jest.fn();
export const mockRouterPush = jest.fn();

export function useRouter() {
  return {
    replace: mockRouterReplace,
    push: mockRouterPush,
    prefetch: jest.fn(),
  };
}

export const usePathname = jest.fn(() => "/onboarding");

export const useSearchParams = jest.fn(() => new URLSearchParams());
