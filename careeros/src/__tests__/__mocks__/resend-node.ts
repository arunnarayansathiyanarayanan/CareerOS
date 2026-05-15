/** Jest stub for `@resend/node` — tests can import `mockResendSend`. */
export const mockResendSend = jest.fn().mockResolvedValue({
  data: { id: "mock-email" },
  error: null,
});

export class Resend {
  emails = { send: mockResendSend };
}
