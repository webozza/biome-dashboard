import type { NextRequest } from "next/server";
import { guard } from "./guard";
import { error, json, parsePagination } from "./response";
import { createDoc, deleteDoc, getDoc, listCollection, updateDoc } from "./firestore";

type WhereClause = { field: string; op: FirebaseFirestore.WhereFilterOp; value: unknown };

export function buildList(path: string, opts: { orderBy?: string; allowedFilters?: string[] } = {}) {
  return async (req: NextRequest) => {
    const g = guard(req);
    if (g) return g;
    const url = new URL(req.url);
    const { limit, cursor } = parsePagination(url);
    const where: WhereClause[] = [];
    for (const field of opts.allowedFilters || []) {
      const v = url.searchParams.get(field);
      if (v !== null && v !== "") where.push({ field, op: "==", value: v });
    }
    try {
      const result = await listCollection(path, {
        limit,
        cursor,
        orderBy: opts.orderBy || "createdAt",
        where,
      });
      return json(result);
    } catch (e) {
      return error("list_failed", 500, { detail: String((e as Error).message) });
    }
  };
}

export function buildCreate(path: string) {
  return async (req: NextRequest) => {
    const g = guard(req);
    if (g) return g;
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return error("invalid_json", 400);
    }
    try {
      const id = await createDoc(path, body);
      return json({ id }, 201);
    } catch (e) {
      return error("create_failed", 500, { detail: String((e as Error).message) });
    }
  };
}

export function buildGetOne(path: string) {
  return async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const g = guard(req);
    if (g) return g;
    const { id } = await ctx.params;
    try {
      const item = await getDoc(path, id);
      if (!item) return error("not_found", 404);
      return json(item);
    } catch (e) {
      return error("get_failed", 500, { detail: String((e as Error).message) });
    }
  };
}

export function buildPatch(path: string) {
  return async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const g = guard(req);
    if (g) return g;
    const { id } = await ctx.params;
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return error("invalid_json", 400);
    }
    try {
      await updateDoc(path, id, body);
      const fresh = await getDoc(path, id);
      return json(fresh);
    } catch (e) {
      return error("update_failed", 500, { detail: String((e as Error).message) });
    }
  };
}

export function buildDelete(path: string) {
  return async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const g = guard(req);
    if (g) return g;
    const { id } = await ctx.params;
    try {
      await deleteDoc(path, id);
      return json({ id, deleted: true });
    } catch (e) {
      return error("delete_failed", 500, { detail: String((e as Error).message) });
    }
  };
}
