export interface Paginated<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface ListFilters {
  limit?: number;
  offset?: number;
  search?: string;
  organizationId?: string;
}
