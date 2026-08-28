import { badRequest, getApiSession, initials, unauthorized } from "@/lib/api";
import type { ProjectStatus } from "@/lib/models/project";
import { createProjectWithActivity, listProjects } from "@/lib/services/project-service";
import { findWorkspaceMember, validateAssignments } from "@/lib/services/project-collaboration-service";
import { createProjectSchema } from "@/lib/validation";

export const runtime = "nodejs";

function periodBounds(year: number, month?: number) {
  const startMonth = month ?? 1;
  const endMonth = month ? month + 1 : 13;
  const makeDate = (targetMonth: number) => {
    const targetYear = year + Math.floor((targetMonth - 1) / 12);
    const normalizedMonth = ((targetMonth - 1) % 12) + 1;
    return new Date(`${targetYear}-${String(normalizedMonth).padStart(2, "0")}-01T00:00:00+07:00`);
  };
  return { periodStart: makeDate(startMonth), periodEnd: makeDate(endMonth) };
}

export async function GET(request: Request) {
  const session = await getApiSession(request);
  if (!session) return unauthorized();

  const url = new URL(request.url);
  const yearParam = url.searchParams.get("year");
  const monthParam = url.searchParams.get("month");
  if (monthParam && !yearParam) return badRequest("Parameter year wajib saat month digunakan");

  const year = yearParam ? Number(yearParam) : undefined;
  const month = monthParam ? Number(monthParam) : undefined;
  if (year !== undefined && (!Number.isInteger(year) || year < 2000 || year > 2100)) return badRequest("Parameter year harus berupa tahun 2000–2100");
  if (month !== undefined && (!Number.isInteger(month) || month < 1 || month > 12)) return badRequest("Parameter month harus berupa angka 1–12");
  const period = year === undefined ? {} : periodBounds(year, month);

  const rows = await listProjects({
    search: url.searchParams.get("search") || undefined,
    status: (url.searchParams.get("status") || undefined) as ProjectStatus | undefined,
    pic: url.searchParams.get("pic") || undefined,
    category: url.searchParams.get("category") || undefined,
    ...period,
  });
  return Response.json({ data: rows });
}

export async function POST(request: Request) {
  const session = await getApiSession(request);
  if (!session) return unauthorized();
  const parsed = createProjectSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid project data", parsed.error.flatten());

  const input = parsed.data;
  const assignments = input.memberAssignments ?? [];
  const primaryPic = input.primaryPicUserId ? await findWorkspaceMember(input.primaryPicUserId) : null;
  if (input.primaryPicUserId && !primaryPic) return badRequest("PIC yang dipilih tidak ditemukan");
  if (!await validateAssignments(assignments)) return badRequest("Salah satu anggota project tidak ditemukan");
  const { memberAssignments: _memberAssignments, ...projectInput } = input;
  const project = await createProjectWithActivity({
    ...projectInput,
    pic: primaryPic?.name ?? input.pic,
    picInitials: primaryPic ? initials(primaryPic.name) : input.picInitials || initials(input.pic),
    primaryPicUserId: primaryPic?.id ?? null,
    workingDocLink: input.workingDocLink || null,
  }, {
    userId: session.user.id,
    name: session.user.name,
    initials: initials(session.user.name),
  }, assignments);
  return Response.json({ data: project }, { status: 201 });
}
