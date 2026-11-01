/** True when running inside AWS (SST sets RUNTIME=aws on the site and functions). */
export function inAws(): boolean {
  return process.env.RUNTIME === "aws";
}
