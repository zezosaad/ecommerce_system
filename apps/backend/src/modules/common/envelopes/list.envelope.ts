import { RequestMeta } from './meta';

export interface PaginationMeta {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export class ListEnvelope<T> {
  data: T[];
  pagination: PaginationMeta;
  meta: RequestMeta;

  constructor(
    data: T[],
    total: number,
    page: number,
    pageSize: number,
    meta: RequestMeta,
  ) {
    this.data = data;
    this.pagination = {
      page,
      page_size: pageSize,
      total,
      total_pages: Math.ceil(total / pageSize),
    };
    this.meta = meta;
  }
}
