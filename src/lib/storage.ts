import fs from "node:fs/promises";
import path from "node:path";
import { GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Resource } from "sst";
import { inAws } from "./runtime";

// Where image files live. Keys look like:
//   daily/<uuid>.jpg          normalized images for each daily set
//   pool/lummi/<filename>     the AI image pool
//   pool/lummi/catalog.csv    the catalog that describes the pool
export interface Storage {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  exists(key: string): Promise<boolean>;
  /** File names directly under a prefix, e.g. list("pool/lummi/"). */
  list(prefix: string): Promise<string[]>;
}

/** Locally: files under data/storage/. */
function localStorage(): Storage {
  const root = path.resolve(/*turbopackIgnore: true*/ process.env.LOCAL_STORAGE_DIR || "data/storage");
  const file = (key: string) => path.join(root, key);

  return {
    async put(key, data) {
      await fs.mkdir(path.dirname(file(key)), { recursive: true });
      await fs.writeFile(file(key), data);
    },
    async get(key) {
      return fs.readFile(file(key)).catch(() => null);
    },
    async exists(key) {
      return fs.access(file(key)).then(() => true, () => false);
    },
    async list(prefix) {
      const entries = await fs.readdir(file(prefix), { withFileTypes: true }).catch(() => []);
      return entries.filter((e) => e.isFile()).map((e) => e.name);
    },
  };
}

/** In AWS (or the catalog push from a laptop): the S3 bucket linked by SST. */
function s3Storage(): Storage {
  const client = new S3Client({ region: process.env.AWS_REGION || "us-east-2" });
  const Bucket = Resource.Images.name;

  return {
    async put(Key, Body, ContentType) {
      await client.send(new PutObjectCommand({ Bucket, Key, Body, ContentType }));
    },
    async get(Key) {
      try {
        const res = await client.send(new GetObjectCommand({ Bucket, Key }));
        return Buffer.from(await res.Body!.transformToByteArray());
      } catch (err) {
        if ((err as Error).name === "NoSuchKey") return null;
        throw err;
      }
    },
    async exists(Key) {
      try {
        await client.send(new HeadObjectCommand({ Bucket, Key }));
        return true;
      } catch (err) {
        if ((err as Error).name === "NotFound") return false;
        throw err;
      }
    },
    async list(Prefix) {
      const names: string[] = [];
      let ContinuationToken: string | undefined;
      do {
        const res = await client.send(new ListObjectsV2Command({ Bucket, Prefix, Delimiter: "/", ContinuationToken }));
        for (const obj of res.Contents ?? []) names.push(obj.Key!.slice(Prefix.length));
        ContinuationToken = res.NextContinuationToken;
      } while (ContinuationToken);
      return names.filter(Boolean);
    },
  };
}

let cached: Storage | undefined;

/** S3 when running in AWS, local files otherwise. Pass a kind to override. */
export function storage(kind?: "local" | "s3"): Storage {
  if (kind) return kind === "s3" ? s3Storage() : localStorage();
  return (cached ??= inAws() ? s3Storage() : localStorage());
}
