// Syncs the hand-picked images in images/lummi/ (AI) and images/unsplash/ (real)
// into the app, using images/catalog.csv for credits.
//
//   npm run catalog:sync         local: copies into data/storage/, loads local Postgres
//   npm run catalog:sync:prod    production: uploads to S3, then the CatalogSync
//                                function loads the production database
//
// - Image files that aren't in catalog.csv yet get a new row (title from the
//   filename), so you only have to fill in the page link and creator.
// - Rows whose file is missing are skipped and reported.
// - Rows removed from the CSV, or with active = no, are retired (never picked).
//
// The local /admin page does the same as the local sync, one image at a time.

import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { Resource } from "sst";
import type { CatalogReport } from "../src/lib/catalog";
import { SOURCES } from "../src/lib/sources/pool";
import {
  addMissingRows,
  CATALOG_PATH,
  pushToStorage,
  readCatalog,
  syncLocal,
  writeCatalog,
  type SyncResult,
} from "../src/lib/catalogFiles";
import { storage } from "../src/lib/storage";

const remote = process.argv.includes("--remote");

async function syncRemote(): Promise<SyncResult> {
  const rows = readCatalog();
  const added = addMissingRows(rows);
  writeCatalog(rows);
  const uploaded = await pushToStorage(storage("s3"), rows);

  const lambda = new LambdaClient({ region: "us-east-2" });
  const res = await lambda.send(new InvokeCommand({ FunctionName: Resource.CatalogSync.name }));
  const payload = JSON.parse(Buffer.from(res.Payload ?? []).toString("utf8") || "null");
  if (res.FunctionError) throw new Error(`CatalogSync failed: ${JSON.stringify(payload)}`);
  return { report: payload as CatalogReport, added, uploaded };
}

function print({ report: r, added, uploaded }: SyncResult) {
  console.log(`Catalog: ${CATALOG_PATH} → ${remote ? "production (S3 + RDS)" : "local"}`);
  for (const source of SOURCES) {
    const s = r.sources[source];
    const low = s.lowStock ? "  ← running low" : "";
    console.log(`  ${source.padEnd(9)} ${s.active} active, ${s.unused} not used yet${low}`);
  }
  if (added.length) console.log(`  Added ${added.length} new file(s) to the CSV: ${added.join(", ")}`);
  if (uploaded) console.log(`  Uploaded ${uploaded} image(s) to storage`);
  if (r.missingFile.length) console.log(`  ${r.missingFile.length} row(s) skipped, file not found: ${r.missingFile.join(", ")}`);
  if (r.needsInfo.length) {
    console.log(`  ${r.needsInfo.length} image(s) missing page_url or creator_name (fill these in for credits):`);
    for (const f of r.needsInfo.slice(0, 10)) console.log(`    - ${f}`);
    if (r.needsInfo.length > 10) console.log(`    …and ${r.needsInfo.length - 10} more`);
  }
}

(remote ? syncRemote() : syncLocal()).then(
  (result) => {
    print(result);
    process.exit(0);
  },
  (err) => {
    console.error(err.message ?? err);
    process.exit(1);
  },
);
