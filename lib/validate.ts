import { z, ZodError } from "zod";

export type Issue = { path: string; message: string };
export type BadRequest = { ok: false; code: "BAD_REQUEST"; issues: Issue[] };

export function zodToIssues(err: ZodError): Issue[] {
  return err.errors.map(e => ({ path: e.path.join(".") || "<root>", message: e.message }));
}

export function parseOrBadRequest<T>(schema: z.ZodType<T>, data: unknown):
  | { ok: true; data: T }
  | BadRequest {
  const r = schema.safeParse(data);
  if (r.success) return { ok: true, data: r.data };
  return { ok: false, code: "BAD_REQUEST", issues: zodToIssues(r.error) };
}

export function contentTypeIssue(expected: string): BadRequest {
  return { ok: false, code: "BAD_REQUEST", issues: [{ path: "headers.content-type", message: `expected ${expected}` }] };
}
