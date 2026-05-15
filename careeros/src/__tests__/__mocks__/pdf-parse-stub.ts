/** Avoid loading `pdf-parse` ESM bundle in Jest (uses import.meta). */
export class PDFParse {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_opts?: { data?: Uint8Array }) {}

  async getText(): Promise<{ text?: string }> {
    return { text: "" };
  }

  async destroy(): Promise<void> {}
}
