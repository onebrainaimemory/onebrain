export interface ApiError {
  code: string;
  message: string;
  details?: unknown[];
}

export interface PaginationMeta {
  cursor: string | null;
  hasMore: boolean;
  total?: number;
}

export interface ApiMeta {
  requestId: string;
  pagination?: PaginationMeta;
}

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: ApiError;
  meta?: ApiMeta;
}

export type PaginatedResponse<T> = ApiResponse<T[]> & {
  meta: ApiMeta & { pagination: PaginationMeta };
};
