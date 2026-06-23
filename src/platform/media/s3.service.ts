import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { Readable } from "stream";
import { env } from "../../shared/config/env";

/**
 * Bucket-specific AWS URLs (e.g. https://my-bucket.s3.eu-north-1.amazonaws.com)
 * must not be passed as S3_ENDPOINT — the SDK prepends the bucket again and
 * breaks TLS. Rewrite them to the regional endpoint instead.
 */
function resolveS3Endpoint(endpoint: string): string {
  const bucketPrefix = `${env.S3_BUCKET}.`;
  if (!endpoint.includes(bucketPrefix)) {
    return endpoint;
  }

  const regionalMatch = endpoint.match(/\.s3[.-]([a-z0-9-]+)\.amazonaws\.com/i);
  if (regionalMatch) {
    return `https://s3.${regionalMatch[1]}.amazonaws.com`;
  }

  return endpoint;
}

const s3Client = new S3Client({
  region: env.S3_REGION,
  endpoint: resolveS3Endpoint(env.S3_ENDPOINT),
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
});

/**
 * Converts a caller-provided image reference into a bare S3 object key.
 * Accepts plain keys, keys prefixed with the bucket name, or full S3/HTTPS URLs.
 */
export function normalizeS3Key(input: string): string {
  let key = input.trim();

  try {
    key = decodeURIComponent(key);
  } catch {
    // keep original when percent-encoding is malformed
  }

  if (/^https?:\/\//i.test(key) || /^s3:\/\//i.test(key)) {
    try {
      const url = new URL(key);

      if (url.protocol === "s3:") {
        key = url.pathname.replace(/^\/+/, "");
        if (url.hostname && url.hostname !== "s3.amazonaws.com") {
          const hostBucket = url.hostname;
          if (key.startsWith(`${hostBucket}/`)) {
            key = key.slice(hostBucket.length + 1);
          }
        }
      } else {
        key = url.pathname.replace(/^\/+/, "");
        const bucketPrefix = `${env.S3_BUCKET}/`;
        if (key.startsWith(bucketPrefix)) {
          key = key.slice(bucketPrefix.length);
        }
      }
    } catch {
      // not a valid URL — fall through and treat as a key
    }
  }

  key = key.replace(/^\/+/, "");

  const bucketPrefix = `${env.S3_BUCKET}/`;
  if (key.startsWith(bucketPrefix)) {
    key = key.slice(bucketPrefix.length);
  }

  return key;
}

/**
 * Downloads an object from S3-compatible storage and returns it as a Buffer.
 * Throws if the object cannot be found or read.
 */
export async function downloadImage(inputKey: string): Promise<Buffer> {
  const key = normalizeS3Key(inputKey);

  const command = new GetObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
  });

  const response = await s3Client.send(command);

  if (!response.Body) {
    throw new Error(`S3 object "${key}" has no body`);
  }

  const stream = response.Body as Readable;
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}
