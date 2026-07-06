export const API_VERSION       = '1';
export const RATE_LIMIT_HOURLY = 1000;

const BASE_HEADERS = {
  'X-API-Version':   API_VERSION,
  'X-Rate-Limit':    String(RATE_LIMIT_HOURLY),
  'Content-Type':    'application/json',
} as const;

export function apiSuccess<T>(
  data:    T,
  meta?:   Record<string, unknown> | null,
  status = 200,
) {
  return Response.json(
    { data, meta: meta ?? null, error: null },
    { status, headers: BASE_HEADERS },
  );
}

export function apiError(code: string, message: string, status: number) {
  return Response.json(
    { data: null, meta: null, error: { code, message, status } },
    { status, headers: BASE_HEADERS },
  );
}

export function paginationMeta(params: {
  total:    number;
  page:     number;
  perPage:  number;
}) {
  const { total, page, perPage } = params;
  return {
    page,
    per_page:    perPage,
    total,
    total_pages: Math.ceil(total / perPage),
    has_more:    page * perPage < total,
  };
}

export function getPageParams(url: URL): { page: number; perPage: number; offset: number } {
  const page    = Math.max(1, parseInt(url.searchParams.get('page')     ?? '1'));
  const perPage = Math.min(100, Math.max(1, parseInt(url.searchParams.get('per_page') ?? '20')));
  return { page, perPage, offset: (page - 1) * perPage };
}
