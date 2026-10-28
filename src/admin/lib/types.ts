export type ProductRow = {
  id: string
  title: string
  handle: string
  status: string
  thumbnail?: string | null
  discountable?: boolean
  metadata?: Record<string, unknown> | null
  created_at: string
  updated_at: string
  collection?: { id: string; title: string } | null
  type?: { id: string; value: string } | null
  categories?: { id: string; name: string }[]
  tags?: { id: string; value: string }[]
  sales_channels?: { id: string; name: string }[]
  variants?: { id: string }[]
}

export type Mode = "add" | "remove" | "replace"
export type SetList = { mode: Mode; ids: string[] }

export type EditSpec = {
  status?: string
  collection_id?: string | null
  type_id?: string | null
  discountable?: boolean
  categories?: SetList
  tags?: SetList
  sales_channels?: SetList
  titleFind?: string
  titleReplace?: string
  titlePrefix?: string
  titleSuffix?: string
  metaSet?: Record<string, string>
  metaUnset?: string[]
}

export type Opt = { id: string; label: string }
export type Lookups = {
  collections: Opt[]
  types: Opt[]
  categories: Opt[]
  tags: Opt[]
  channels: Opt[]
}

export type Kind = "edit" | "soft" | "hard"
export type Job = { kind: Kind; ids: string[]; spec?: EditSpec }
export type Result = { status: "ok" | "error" | "skipped"; message?: string }
