export const RESUME_PDF_MIME = "application/pdf";
export const RESUME_DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const EXT_TO_MIME: Record<string, string> = {
  pdf: RESUME_PDF_MIME,
  docx: RESUME_DOCX_MIME,
};

function extensionFromFileName(name: string): string | null {
  const match = /\.([a-z0-9]+)$/i.exec(name.trim());
  return match?.[1]?.toLowerCase() ?? null;
}

/** Resolve PDF/DOCX MIME from browser File metadata, falling back to extension. */
export function resolveResumeMimeType(file: {
  type: string;
  name: string;
}): string | null {
  const mime = (file.type || "").toLowerCase();
  if (mime === RESUME_PDF_MIME || mime === RESUME_DOCX_MIME) {
    return mime;
  }

  const ext = extensionFromFileName(file.name);
  if (ext && EXT_TO_MIME[ext]) {
    return EXT_TO_MIME[ext];
  }

  return null;
}

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return result.text?.trim() ?? "";
  } finally {
    await parser.destroy();
  }
}

export async function extractDocxText(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const { value } = await mammoth.extractRawText({ buffer });
  return value?.trim() ?? "";
}

export async function extractResumeText(
  buffer: Buffer,
  mime: string
): Promise<string> {
  if (mime === RESUME_PDF_MIME) {
    return extractPdfText(buffer);
  }
  return extractDocxText(buffer);
}
