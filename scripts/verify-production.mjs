const expected = {
  appId: "360-center-of-research",
  appName: "360 - Center of Research",
};

const baseUrl = (process.env.PRODUCTION_URL || "https://ruang-riset.vercel.app").replace(/\/$/, "");
const failures = [];

const pageResponse = await fetch(`${baseUrl}/`, { redirect: "follow", cache: "no-store" });
if (!pageResponse.ok) failures.push(`halaman utama merespons HTTP ${pageResponse.status}`);
if (pageResponse.headers.get("x-app-identity") !== expected.appId) failures.push("header identitas aplikasi tidak sesuai");
const pageHtml = await pageResponse.text();
if (!pageHtml.includes(expected.appName)) failures.push("nama 360 - Center of Research tidak ditemukan pada halaman utama");

const healthResponse = await fetch(`${baseUrl}/api/health`, { redirect: "follow", cache: "no-store" });
if (!healthResponse.ok) failures.push(`health endpoint merespons HTTP ${healthResponse.status}`);
else {
  const health = await healthResponse.json();
  if (health.appId !== expected.appId || health.appName !== expected.appName || health.status !== "ok") {
    failures.push("identitas health endpoint tidak sesuai");
  }
}

if (failures.length > 0) {
  console.error("\nPRODUCTION SMOKE CHECK GAGAL:\n- " + failures.join("\n- "));
  process.exit(1);
}

console.log(`Production terverifikasi: ${expected.appName} di ${baseUrl}`);
