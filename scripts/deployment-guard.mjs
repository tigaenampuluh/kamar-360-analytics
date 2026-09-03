import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const expected = {
  packageName: "ruang-riset",
  appId: "360-center-of-research",
  appName: "360 - Center of Research",
  service: "ruang-riset-api",
  productionHost: "ruang-riset.vercel.app",
  repositoryOwner: "gideonlybrium07",
  repositorySlug: "ruang-riset",
};

const failures = [];
const read = (path) => readFileSync(resolve(root, path), "utf8");
const requireText = (path, text, label) => {
  if (!read(path).includes(text)) failures.push(`${label} tidak ditemukan di ${path}`);
};

const packageInfo = JSON.parse(read("package.json"));
if (packageInfo.name !== expected.packageName) failures.push(`package name harus ${expected.packageName}`);
if (!/^\d+\.\d+\.\d+$/.test(packageInfo.version)) failures.push("version harus menggunakan format semver x.y.z");

requireText("lib/app-identity.ts", `APP_ID = "${expected.appId}"`, "APP_ID resmi");
requireText("lib/app-identity.ts", `APP_NAME = "${expected.appName}"`, "nama aplikasi resmi");
requireText("lib/app-identity.ts", `APP_SERVICE = "${expected.service}"`, "service API resmi");
requireText("app/layout.tsx", "APP_NAME", "metadata nama aplikasi");
requireText("app/manifest.ts", "APP_NAME", "manifest nama aplikasi");
requireText("app/page.tsx", expected.appName, "branding halaman utama");
requireText("app/api/health/route.ts", "APP_ID", "identitas health endpoint");

const logoPath = resolve(root, "public/center-of-research-360.png");
if (!existsSync(logoPath) || statSync(logoPath).size < 1_000) failures.push("logo resmi tidak tersedia atau tidak valid");

const normalizeHost = (value = "") => value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
if (process.env.VERCEL_ENV === "production") {
  const productionHost = normalizeHost(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  if (!productionHost) failures.push("VERCEL_PROJECT_PRODUCTION_URL tidak tersedia pada build production");
  else if (productionHost !== expected.productionHost) failures.push(`target production salah: ${productionHost}`);
}

if (process.env.VERCEL_GIT_REPO_OWNER && process.env.VERCEL_GIT_REPO_OWNER.toLowerCase() !== expected.repositoryOwner) {
  failures.push(`owner Git salah: ${process.env.VERCEL_GIT_REPO_OWNER}`);
}
if (process.env.VERCEL_GIT_REPO_SLUG && process.env.VERCEL_GIT_REPO_SLUG.toLowerCase() !== expected.repositorySlug) {
  failures.push(`repository Git salah: ${process.env.VERCEL_GIT_REPO_SLUG}`);
}

if (failures.length > 0) {
  console.error("\nDEPLOYMENT GUARD MENOLAK BUILD:\n- " + failures.join("\n- "));
  process.exit(1);
}

console.log(`Deployment Guard lulus: ${expected.appName} v${packageInfo.version} → ${expected.productionHost}`);
