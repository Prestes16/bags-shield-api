export type Network = 'devnet' | 'mainnet';

export interface ApiMeta {
  service: 'bags-shield-api';
  version: string;       // ex.: "1.0.0"
  time: string;          // ISO-8601
}

export interface ApiError {
  code: string;          // ex.: "BAD_REQUEST" | "UNAUTHORIZED" | ...
  message: string;
}

export interface ApiOk<TData> {
  ok: true;
  data: TData;
  meta: ApiMeta;
}

export interface ApiFail {
  ok: false;
  error: ApiError;
  meta: ApiMeta;
}

export type ApiResponse<TData> = ApiOk<TData> | ApiFail;

/* -------------------- /api/health -------------------- */

export interface HealthData {
  ok: true;
  service: 'bags-shield-api';
  version: string;
  status: 'healthy';
  time: string; // ISO-8601
}

/* -------------------- /api/scan -------------------- */

export interface ScanRequest {
  mint: string;
  network?: Network;
  requestedBy?: string;
  tags?: string[];
}

export interface ScanData {
  id: string;
  status: 'queued';
  mint: string;
  network: Network;
  requestedBy: string | null;
  tags: string[];
  decision: 'pending';
  reason: string | null;
}

/* -------------------- /api/simulate -------------------- */

export interface SimulateRequest {
  mint: string;
  network?: Network;
  scenario: string;                  // ex.: "apply_flag" | "unflag" | ...
  params?: Record<string, unknown>;
}

export interface SimulateData {
  mint: string;
  network: Network;
  scenario: string;
  params: Record<string, unknown>;
  expectedOutcome: string;           // ex.: "trading_restricted" | "limited" | ...
  scoreDelta: number;                // ex.: -22, +15, etc.
}

/* -------------------- /api/apply -------------------- */

export type Action = 'flag' | 'unflag' | 'limit_trading' | 'freeze';

export interface ApplyRequest {
  mint: string;
  network?: Network;
  action: Action;
  reason?: string;
  params?: Record<string, unknown>;
  idempotencyKey?: string;
}

export interface ApplyData {
  id: string;
  idempotencyKey: string | null;
  mint: string;
  network: Network;
  action: Action;
  reason: string | null;
  params: Record<string, unknown>;
  result: 'applied';
  effects: Record<string, unknown>;
}
