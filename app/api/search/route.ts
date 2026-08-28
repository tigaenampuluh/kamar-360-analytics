import { asc, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { agendas, assets, projectComments, projects, user } from "@/db/schema";
import { badRequest, getApiSession, unauthorized } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getApiSession(request);
  if (!session) return unauthorized();
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return badRequest("Gunakan minimal 2 karakter untuk pencarian");
  const term = `%${query.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
  const [projectRows, commentRows, agendaRows, assetRows] = await Promise.all([
    db.select({ id: projects.id, title: projects.title, description: projects.description, category: projects.category, archivedAt: projects.archivedAt })
      .from(projects).where(or(ilike(projects.title, term), ilike(projects.description, term), ilike(projects.pic, term), ilike(projects.category, term))).orderBy(desc(projects.updatedAt)).limit(8),
    db.select({ id: projectComments.id, title: projects.title, description: projectComments.body, author: user.name, projectId: projects.id })
      .from(projectComments).innerJoin(projects, eq(projects.id, projectComments.projectId)).innerJoin(user, eq(user.id, projectComments.authorId))
      .where(ilike(projectComments.body, term)).orderBy(desc(projectComments.createdAt)).limit(6),
    db.select({ id: agendas.id, title: agendas.title, description: agendas.note, category: agendas.category })
      .from(agendas).where(or(ilike(agendas.title, term), ilike(agendas.note, term), ilike(agendas.pic, term), ilike(agendas.category, term))).orderBy(asc(agendas.startTime)).limit(6),
    db.select({ id: assets.id, title: assets.projectName, description: assets.description, category: assets.category })
      .from(assets).where(or(ilike(assets.projectName, term), ilike(assets.description, term), ilike(assets.pic, term), ilike(assets.category, term))).orderBy(desc(assets.completedDate)).limit(6),
  ]);
  return Response.json({ data: [
    ...projectRows.map((item) => ({ type: "project", view: "tracker", ...item })),
    ...commentRows.map((item) => ({ type: "comment", view: "tracker", ...item })),
    ...agendaRows.map((item) => ({ type: "agenda", view: "calendar", ...item })),
    ...assetRows.map((item) => ({ type: "asset", view: "library", ...item })),
  ] });
}
