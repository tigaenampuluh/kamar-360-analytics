import { sql } from "drizzle-orm";
import { db, pool } from "../db";
import { activityLogs, agendas, assets, projects } from "../db/schema";

async function main() {
const [existing] = await db.select({ count: sql<number>`count(*)` }).from(projects).limit(1);
if (Number(existing?.count ?? 0) > 0) {
  console.log("Seed skipped: project data already exists.");
  process.exit(0);
}

const projectRows = await db.insert(projects).values([
  { title: "Riset Persepsi Publik Q3", status: "On Going", priority: "High", category: "Brand Research", pic: "Nadia Putri", picInitials: "NP", deadline: new Date("2026-08-28T17:00:00+07:00"), description: "Finalisasi kuesioner dan koordinasi distribusi dengan tim lapangan.", workingDocLink: "https://docs.google.com" },
  { title: "Social Listening — Isu Pangan", status: "On Going", priority: "Medium", category: "Social Listening", pic: "Arga Wibawa", picInitials: "AW", deadline: new Date("2026-09-02T17:00:00+07:00"), description: "Analisis percakapan organik dan pemetaan sentimen mingguan." },
  { title: "Pemetaan Media Nasional", status: "On Going", priority: "Low", category: "Media Mapping", pic: "Dita Anjani", picInitials: "DA", deadline: new Date("2026-09-05T17:00:00+07:00"), description: "Verifikasi profil dan jangkauan 60 media prioritas." },
  { title: "Audit Kanal Digital", status: "Delay", priority: "High", category: "Digital Audit", pic: "Fikri Ramadhan", picInitials: "FR", deadline: new Date("2026-08-24T17:00:00+07:00"), description: "Menunggu akses data analytics dari pihak klien." },
  { title: "FGD Komunitas Urban", status: "Delay", priority: "Medium", category: "Qualitative", pic: "Nadia Putri", picInitials: "NP", deadline: new Date("2026-08-26T15:00:00+07:00"), description: "Dua responden utama belum mengonfirmasi kehadiran." },
  { title: "Benchmark Industri Energi", status: "Pending", priority: "Medium", category: "Desk Research", pic: "Arga Wibawa", picInitials: "AW", deadline: new Date("2026-09-10T17:00:00+07:00"), description: "Brief internal selesai, menunggu material pendukung." },
  { title: "Survei Kepuasan Mitra", status: "Pending", priority: "Low", category: "Survey", pic: "Maya Kirana", picInitials: "MK", deadline: new Date("2026-09-12T17:00:00+07:00"), description: "Sampling frame sedang disusun." },
  { title: "Laporan Tren Gen Z", status: "Revisi", priority: "High", category: "Trend Report", pic: "Dita Anjani", picInitials: "DA", deadline: new Date("2026-08-27T10:00:00+07:00"), description: "Perbaiki narasi pada bagian implikasi bisnis dan executive summary." },
  { title: "Analisis Kompetitor Fintech", status: "Done", priority: "Medium", category: "Competitor Research", pic: "Fikri Ramadhan", picInitials: "FR", deadline: new Date("2026-08-19T17:00:00+07:00"), description: "Pemetaan positioning dan komunikasi tujuh pemain fintech nasional." },
  { title: "Profil Audiens Podcast", status: "Done", priority: "Low", category: "Audience Research", pic: "Maya Kirana", picInitials: "MK", deadline: new Date("2026-08-16T17:00:00+07:00"), description: "Profil demografis, motivasi dengar, dan kebiasaan konsumsi audiens." },
]).returning();

const byTitle = new Map(projectRows.map((project) => [project.title, project]));

await db.insert(agendas).values([
  { title: "Review laporan Gen Z", pic: "Dita Anjani", category: "Review", startTime: new Date("2026-08-27T10:00:00+07:00"), endTime: new Date("2026-08-27T11:00:00+07:00"), note: "Review executive summary bersama lead.", projectId: byTitle.get("Laporan Tren Gen Z")?.id },
  { title: "Deadline riset persepsi", pic: "Nadia Putri", category: "Deadline", startTime: new Date("2026-08-28T17:00:00+07:00"), endTime: new Date("2026-08-28T17:30:00+07:00"), note: "Final deliverables.", projectId: byTitle.get("Riset Persepsi Publik Q3")?.id },
  { title: "Kickoff riset otomotif", pic: "Angga Ramadhan", category: "Meeting", startTime: new Date("2026-09-01T09:30:00+07:00"), endTime: new Date("2026-09-01T10:30:00+07:00"), note: "Kickoff internal semua tim." },
  { title: "Town hall riset", pic: "Maya Kirana", category: "Meeting", startTime: new Date("2026-08-31T15:00:00+07:00"), endTime: new Date("2026-08-31T16:00:00+07:00"), note: "Update lintas project." },
]);

await db.insert(assets).values([
  { projectName: "Analisis Kompetitor Fintech", category: "Competitor Research", pic: "Fikri Ramadhan", picInitials: "FR", completedDate: new Date("2026-08-19T17:00:00+07:00"), description: "Pemetaan positioning dan komunikasi tujuh pemain fintech nasional.", assetLink: "https://drive.google.com", docLink: "https://docs.google.com", tags: ["fintech", "market", "benchmark"], projectId: byTitle.get("Analisis Kompetitor Fintech")?.id },
  { projectName: "Profil Audiens Podcast", category: "Audience Research", pic: "Maya Kirana", picInitials: "MK", completedDate: new Date("2026-08-16T17:00:00+07:00"), description: "Profil demografis, motivasi dengar, dan kebiasaan konsumsi audiens.", assetLink: "https://drive.google.com", tags: ["podcast", "audience", "survey"], projectId: byTitle.get("Profil Audiens Podcast")?.id },
  { projectName: "Landscape Sustainability", category: "Desk Research", pic: "Arga Wibawa", picInitials: "AW", completedDate: new Date("2026-08-08T17:00:00+07:00"), description: "Ringkasan isu dan percakapan keberlanjutan di sektor FMCG.", tags: ["ESG", "sustainability"] },
  { projectName: "Persepsi Layanan Publik", category: "Brand Research", pic: "Nadia Putri", picInitials: "NP", completedDate: new Date("2026-07-31T17:00:00+07:00"), description: "Studi persepsi masyarakat pada layanan digital pemerintahan.", tags: ["public", "perception"] },
  { projectName: "Media Mapping Teknologi", category: "Media Mapping", pic: "Dita Anjani", picInitials: "DA", completedDate: new Date("2026-07-25T17:00:00+07:00"), description: "Database media dan jurnalis teknologi prioritas 2026.", tags: ["media", "technology"] },
  { projectName: "Retail Trend Snapshot", category: "Trend Report", pic: "Fikri Ramadhan", picInitials: "FR", completedDate: new Date("2026-07-18T17:00:00+07:00"), description: "Snapshot perubahan perilaku belanja dan kanal retail utama.", tags: ["retail", "trend", "consumer"] },
]);

await db.insert(activityLogs).values([
  { actorName: "Nadia Putri", actorInitials: "NP", projectId: byTitle.get("FGD Komunitas Urban")?.id, action: "memindahkan project", details: "On Going → Delay", createdAt: new Date("2026-08-26T14:18:00+07:00") },
  { actorName: "Dita Anjani", actorInitials: "DA", projectId: byTitle.get("Laporan Tren Gen Z")?.id, action: "menambahkan catatan revisi", details: "Executive summary perlu dipadatkan", createdAt: new Date("2026-08-26T13:42:00+07:00") },
  { actorName: "Arga Wibawa", actorInitials: "AW", projectId: byTitle.get("Benchmark Industri Energi")?.id, action: "mengubah deadline", details: "08 Sep → 10 Sep", createdAt: new Date("2026-08-26T11:06:00+07:00") },
  { actorName: "Fikri Ramadhan", actorInitials: "FR", projectId: byTitle.get("Analisis Kompetitor Fintech")?.id, action: "menyelesaikan project", details: "Dipindahkan ke Asset & Library", createdAt: new Date("2026-08-25T16:24:00+07:00") },
  { actorName: "Maya Kirana", actorInitials: "MK", action: "menambahkan agenda", details: "Town hall riset · 31 Agu, 15.00", createdAt: new Date("2026-08-25T14:03:00+07:00") },
]);

console.log(`Seeded ${projectRows.length} projects and related workspace data.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
