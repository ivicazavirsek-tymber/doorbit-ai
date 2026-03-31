import { NextResponse } from "next/server";

/** JSON telo greške za sve `/api/*` rute — stabilno za klijent (`error.code`). */
export type ApiErrorBody = {
  request_id?: string;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type JsonErrorInit = {
  requestId?: string;
  headers?: HeadersInit;
};

export function newRequestId(): string {
  return crypto.randomUUID();
}

export function jsonError(
  status: number,
  code: string,
  message: string,
  details?: unknown,
  init?: JsonErrorInit
) {
  const body: ApiErrorBody = {
    ...(init?.requestId ? { request_id: init.requestId } : {}),
    error: { code, message, ...(details !== undefined ? { details } : {}) },
  };
  return NextResponse.json(body, { status, headers: init?.headers });
}

export function jsonOk(data: Record<string, unknown>, status = 200) {
  return NextResponse.json(data, { status });
}
