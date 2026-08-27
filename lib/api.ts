import { auth } from "@/lib/auth";

export async function getApiSession(request: Request) {
  return auth.api.getSession({ headers: request.headers });
}

export function unauthorized() {
  return Response.json({ error: "Authentication required" }, { status: 401 });
}

export function forbidden(message = "Administrator access required") {
  return Response.json({ error: message }, { status: 403 });
}

export function badRequest(message: string, details?: unknown) {
  return Response.json({ error: message, details }, { status: 400 });
}

export function notFound(resource: string) {
  return Response.json({ error: `${resource} not found` }, { status: 404 });
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "RR";
}
