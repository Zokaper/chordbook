const fs = require("node:fs");
const path = require("node:path");

const userAgent = process.env.npm_config_user_agent ?? "";

if (!userAgent.startsWith("pnpm/")) {
  console.error("This workspace uses pnpm. Run commands with `corepack pnpm`.");
  process.exit(1);
}

for (const filename of ["package-lock.json", "yarn.lock"]) {
  fs.rmSync(path.join(__dirname, "..", filename), { force: true });
}
