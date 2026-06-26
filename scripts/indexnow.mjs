import { readFileSync } from "fs";
import { execSync } from "child_process";

const config = readFileSync("./lib/siteConfig.ts", "utf-8");
const blog = (config.match(/blog:\s*"([^"]+)"/) || [])[1];
if (!blog) process.exit(0);

const key = "9dc3aecdc81b4bd3ac32a778f1b7acef";
const sitemapUrl = `https://${blog}/sitemap.xml`;

execSync(`curl -s "https://api.indexnow.org/indexnow?url=${encodeURIComponent(sitemapUrl)}&key=${key}"`, {
  stdio: "inherit",
});
