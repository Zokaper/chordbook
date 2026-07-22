const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const distDir = path.join(projectRoot, "dist");
const sourceIcon = path.join(projectRoot, "assets", "images", "icon.png");
const destinationIcon = path.join(distDir, "icon.png");

if (!fs.existsSync(path.join(distDir, "index.html"))) {
  throw new Error("Expo web export did not create dist/index.html");
}

fs.copyFileSync(sourceIcon, destinationIcon);
console.log("Prepared root-domain PWA assets.");
