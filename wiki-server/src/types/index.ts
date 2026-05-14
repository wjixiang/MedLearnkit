export interface JwtPayload {
  sub: string;
  exp: number;
  iat: number;
}

export interface PageCreateInput {
  title: string;
  content: string;
  parentId?: string;
  message?: string;
}

export interface PageUpdateInput {
  title?: string;
  content: string;
  message?: string;
}

export interface PageMoveInput {
  parentId?: string | null;
  position?: number;
}

export interface ImportTriggerInput {
  prefix: string;
  dry_run?: boolean;
}

export interface DiffResult {
  fromRevision: number;
  toRevision: number;
  fromTitle: string;
  toTitle: string;
  titleChanged: boolean;
  unifiedDiff: string;
  operations: DiffOperation[];
}

export interface DiffOperation {
  type: "insert" | "delete" | "equal";
  content: string;
  lineNumber: number;
}

export interface PageResponse {
  id: string;
  slug: string;
  title: string;
  content: string;
  parentId: string | null;
  position: number;
  tags: string[];
  revisionNumber: number;
  authorName: string;
  updatedAt: string;
  createdAt: string;
}

export interface PageTreeItem {
  id: string;
  slug: string;
  title: string;
  parentId: string | null;
  position: number;
  hasChildren: boolean;
  updatedAt: string;
  children?: PageTreeItem[];
}

export interface RevisionListItem {
  revisionNumber: number;
  title: string;
  message: string;
  authorName: string;
  contentHash: string;
  createdAt: string;
}

export interface SearchResult {
  slug: string;
  title: string;
  excerpt: string;
  score: number;
}
