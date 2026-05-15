export class STTError extends Error {
  readonly code: string;

  constructor(code: string, message?: string, options?: { cause?: unknown }) {
    super(message ?? code);
    this.name = "STTError";
    this.code = code;
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
    Object.setPrototypeOf(this, STTError.prototype);
  }
}

export class TTSError extends Error {
  readonly code: string;

  constructor(code: string, message?: string, options?: { cause?: unknown }) {
    super(message ?? code);
    this.name = "TTSError";
    this.code = code;
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
    Object.setPrototypeOf(this, TTSError.prototype);
  }
}

export class InterviewAIError extends Error {
  readonly code: string;

  constructor(code: string, message?: string, options?: { cause?: unknown }) {
    super(message ?? code);
    this.name = "InterviewAIError";
    this.code = code;
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
    Object.setPrototypeOf(this, InterviewAIError.prototype);
  }
}

export class FeedbackAIError extends Error {
  readonly code: string;

  constructor(code: string, message?: string, options?: { cause?: unknown }) {
    super(message ?? code);
    this.name = "FeedbackAIError";
    this.code = code;
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
    Object.setPrototypeOf(this, FeedbackAIError.prototype);
  }
}

export class FeedbackParseError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "FeedbackParseError";
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
    Object.setPrototypeOf(this, FeedbackParseError.prototype);
  }
}
