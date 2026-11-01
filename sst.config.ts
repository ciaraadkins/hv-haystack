/// <reference path="./.sst/platform/config.d.ts" />

// How the app runs in AWS. `npm run deploy` creates/updates everything below.
// See context/infrastructure.md for the why.

export default $config({
  app(input) {
    return {
      name: "lights-camera-fiction",
      // Keep the database, bucket, etc. if the production stage is ever removed.
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: input?.stage === "production",
      home: "aws",
      providers: { aws: { region: "us-east-2", profile: "lcf" } },
    };
  },
  async run() {
    // ── Secrets (values set with `npx sst secret set`, never stored in git) ──
    const dbPassword = new sst.Secret("DbPassword");

    // ── Database: RDS Postgres, reachable from the internet but password + SSL protected ──
    // Public so the Lambdas don't need a private network + NAT (~$13/mo more),
    // and so you can query the data directly from your laptop.
    const dbSecurityGroup = new aws.ec2.SecurityGroup("PostgresSecurityGroup", {
      description: "Postgres: open on 5432, protected by password and required SSL",
      ingress: [{ protocol: "tcp", fromPort: 5432, toPort: 5432, cidrBlocks: ["0.0.0.0/0"], ipv6CidrBlocks: ["::/0"] }],
      egress: [{ protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] }],
    });
    const postgres = new aws.rds.Instance("Postgres", {
      identifier: `lcf-${$app.stage}`, // RDS names must be lowercase
      engine: "postgres",
      engineVersion: "17",
      instanceClass: "db.t4g.micro",
      allocatedStorage: 20,
      maxAllocatedStorage: 50,
      storageType: "gp3",
      dbName: "lcf",
      username: "lcf_admin",
      password: dbPassword.value,
      publiclyAccessible: true,
      vpcSecurityGroupIds: [dbSecurityGroup.id],
      // The AWS free plan caps backup retention; raise to 7 after upgrading the plan.
      backupRetentionPeriod: 1,
      deletionProtection: $app.stage === "production",
      skipFinalSnapshot: $app.stage !== "production",
      finalSnapshotIdentifier: `lcf-${$app.stage}-final`,
      applyImmediately: true,
    });
    // Bundles the connection details so linked code can read Resource.Database.
    const database = new sst.Linkable("Database", {
      properties: {
        host: postgres.address,
        port: postgres.port,
        username: postgres.username,
        password: dbPassword.value,
        database: postgres.dbName,
      },
    });

    // ── Image storage: private S3 bucket (daily images + the hand-picked pool) ──
    const images = new sst.aws.Bucket("Images");

    const link = [database, images];
    const environment = { RUNTIME: "aws" };

    // ── Loads catalog.csv into the database (invoked by `npm run catalog:sync:prod`) ──
    new sst.aws.Function("CatalogSync", {
      handler: "src/functions/catalog-sync.handler",
      link,
      environment,
      timeout: "1 minute",
    });

    // ── Builds daily sets (the only code that needs sharp for image processing) ──
    const dailySetBuilder = new sst.aws.Function("DailySetBuilder", {
      handler: "src/functions/daily.handler",
      link,
      environment,
      timeout: "2 minutes",
      memory: "1024 MB",
      nodejs: { install: ["sharp"] },
    });

    // Every day at 00:00 UTC: build today's and tomorrow's sets ahead of time.
    new sst.aws.CronV2("DailySet", {
      schedule: "cron(0 0 * * ? *)",
      function: dailySetBuilder.arn,
    });

    // ── The website: Next.js on Lambda behind CloudFront ──
    const site = new sst.aws.Nextjs("Site", {
      // Production lives at humanversus.tech (registered in Route 53; SST creates
      // the HTTPS certificate and DNS records). www redirects to the bare domain.
      domain:
        $app.stage === "production" ? { name: "humanversus.tech", redirects: ["www.humanversus.tech"] } : undefined,
      // Linked to the builder so it can ask for a missing set on demand.
      link: [...link, dailySetBuilder],
      environment,
      server: { memory: "1024 MB", timeout: "30 seconds" },
    });

    return {
      url: site.url,
      databaseHost: postgres.address,
    };
  },
});
