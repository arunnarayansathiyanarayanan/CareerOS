import {
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";

let client: S3Client | undefined;

export class StorageError extends Error {
  readonly key: string;

  constructor(key: string, message?: string, options?: { cause?: unknown }) {
    super(message ?? `Storage upload failed for key: ${key}`);
    this.name = "StorageError";
    this.key = key;
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
    Object.setPrototypeOf(this, StorageError.prototype);
  }
}

function getR2Client(): S3Client {
  if (client) return client;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Missing R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, or R2_SECRET_ACCESS_KEY"
    );
  }

  const config: S3ClientConfig = {
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  };

  client = new S3Client(config);
  return client;
}

function getR2Bucket(): string {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) {
    throw new Error("Missing R2_BUCKET_NAME");
  }
  return bucket;
}

function getR2PublicBaseUrl(): string {
  const base = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
  if (!base) {
    throw new Error("Missing R2_PUBLIC_URL");
  }
  return base;
}

export async function uploadBuffer(
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  try {
    await getR2Client().send(
      new PutObjectCommand({
        Bucket: getR2Bucket(),
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );
    return `${getR2PublicBaseUrl()}/${key}`;
  } catch (cause) {
    throw new StorageError(key, undefined, { cause });
  }
}
