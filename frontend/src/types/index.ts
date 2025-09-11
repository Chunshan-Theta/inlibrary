export interface Author {
  id: number
  name: string
  email?: string
  affiliation?: string
  created_at: string
}

export interface Venue {
  id: number
  name: string
  type: 'journal' | 'conference'
  impact_factor?: number
  created_at: string
}

export interface Tag {
  id: number
  name: string
  color: string
}

export interface PaperAuthor {
  author_order: number
  is_corresponding: boolean
  author: Author
}

export interface PaperTag {
  tag: Tag
}

export interface Paper {
  id: number
  title: string
  abstract?: string
  publication_year: number
  doi?: string
  citation_count: number
  venue_id?: number
  pdf_file_path?: string
  file_size?: number
  url?: string
  keywords?: string[]
  created_at: string
  updated_at: string
  venue?: Venue
  authors: PaperAuthor[]
  tags: PaperTag[]
}

export interface SearchFilters {
  title_keyword?: string
  author_name?: string
  year_from?: number
  year_to?: number
  min_citations?: number
  max_citations?: number
  abstract_keyword?: string
  venue_id?: number
  tags?: string[]
}

// 新的查詢構建器類型
export type FilterOperator = 'AND' | 'OR'

export interface FilterCondition {
  id: string
  field: 'title_keyword' | 'author_name' | 'abstract_keyword' | 'year_from' | 'year_to' | 'min_citations' | 'max_citations' | 'venue_id' | 'tags'
  operator: 'contains' | 'equals' | 'greater_than' | 'less_than' | 'greater_equal' | 'less_equal' | 'in'
  value: string | number | string[]
}

export interface FilterGroup {
  id: string
  operator: FilterOperator
  conditions: FilterCondition[]
  groups: FilterGroup[]
}

export interface ComplexSearchQuery {
  root: FilterGroup
}

export interface PaperCreate {
  title: string
  abstract?: string
  publication_year: number
  doi?: string
  citation_count?: number
  venue_id?: number
  keywords?: string[]
  url?: string
  author_ids?: number[]
  tag_ids?: number[]
}

export interface ApiResponse<T> {
  data: T
  message?: string
}

export interface ExcelImportResult {
  total_rows: number
  successful_imports: number
  failed_imports: number
  errors: string[]
  imported_papers: Paper[]
} 