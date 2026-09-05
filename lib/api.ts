// Route-handler plumbing: JSON responses, zod validation, auth + RBAC gates, error shaping.
import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { getSessionUser, type SessionUser } from "./auth";
import { can, type Action, type Resource } from "./rbac";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function json<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new ApiError(401, "Sign in to continue");
  return user;
}

export function authorize(user: SessionUser, action: Action, resource?: Resource): void {
  if (!can(user, action, resource)) throw new ApiError(403, "You don't have permission to do that");
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, "Request body must be JSON");
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path?.length ? `${issue.path.join(".")}: ` : "";
    throw new ApiError(400, `${path}${issue?.message ?? "Invalid input"}`, result.error.issues);
  }
  return result.data;
}

/** Wrap a handler so thrown ApiErrors become clean JSON and anything else becomes a 500 with a message. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message, details: err.details ?? null }, { status: err.status });
    }
    console.error(err);
    const message = err instanceof Error ? err.message : "Something went wrong";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
