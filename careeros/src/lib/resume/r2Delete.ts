import {
  DeleteObjectsCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";

let r2Client: S3Client | undefined;

function getR2Endpoint(): string {
  const endpoint = process.env.R2_ENDPOINT?.trim();
  if (endpoint) return endpoint;

  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  if (accountId) {
    return `https://${accountId}.r2.cloudflarestorage.com`;
  }

  throw new Error("Missing R2_ENDPOINT or R2_ACCOUNT_ID");
}

function getR2Bucket(): string {
  const bucket =
    process.env.R2_BUCKET?.trim() ?? process.env.R2_BUCKET_NAME?.trim();
  if (!bucket) {
    throw new Error("Missing R2_BUCKET or R2_BUCKET_NAME");
  }
  return bucket;
}

function getR2Client(): S3Client {
  if (r2Client) return r2Client;

  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  if (!accessKeyId || !secretAccessKey) {
    throw new Error("Missing R2_ACCESS_KEY_ID or R2_SECRET_ACCESS_KEY");
  }

  const config: S3ClientConfig = {
    region: "auto",
    endpoint: getR2Endpoint(),
    credentials: { accessKeyId, secretAccessKey },
  };
  r2Client = new S3Client(config);
  return r2Client;
}

/** Deletes multiple R2 objects in a single batch request. */
export async function deleteR2Objects(keys: string[]): Promise<void> {
  const uniqueKeys = [...new Set(keys.filter((k) => k.trim().length > 0))];
  if (uniqueKeys.length === 0) return;

  await getR2Client().send(
    new DeleteObjectsCommand({
      Bucket: getR2Bucket(),
      Delete: {
        Objects: uniqueKeys.map((Key) => ({ Key })),
        Quiet: true,
      },
    })
  );
}
