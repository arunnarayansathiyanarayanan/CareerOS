import { jest } from "@jest/globals";

export const auth = jest.fn(async () => ({ userId: null }));

export const currentUser = jest.fn(async () => null);
