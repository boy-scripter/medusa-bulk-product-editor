import { sdk } from "./sdk"
import type { EditSpec, ProductRow, SetList } from "./types"

/**
 * Endpoints. Edit + soft delete use Medusa's built-in batch route.
 * Hard delete points at the route shipped in this plugin — change the path
 * if your own workflow/route lives elsewhere (body: { ids: string[] }).
 */
export const BATCH_PATH = "/admin/products/batch"
export const HARD_DELETE_PATH = "/admin/products/bulk-hard-delete"

export const FIELDS =
  "id,title,handle,status,thumbnail,discountable,metadata,created_at,updated_at," +
  "*collection,*type,*categories,*tags,*sales_channels,variants.id"

// table filter id -> /admin/products query param
const PARAM_MAP: Record<string, string> = {
  collection: "collection_id",
  type: "type_id",
  categories: "category_id",
  tags: "tag_id",
  sales_channels: "sales_channel_id",
}

export function toApiFilters(f: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(f)) {
    if (v == null || (Array.isArray(v) && !v.length)) continue
    out[PARAM_MAP[k] ?? k] = v
  }
  return out
}

type ListArgs = { q?: string; filters: Record<string, unknown> }

export async function listProducts(args: ListArgs & { limit: number; offset: number }) {
  const query: Record<string, unknown> = {
    fields: FIELDS,
    limit: args.limit,
    offset: args.offset,
    order: "-updated_at",
    ...toApiFilters(args.filters),
  }
  if (args.q) query.q = args.q
  const res = await sdk.admin.product.list(query as any)
  return { products: res.products as unknown as ProductRow[], count: res.count as number }
}

export async function fetchAllIds(args: ListArgs) {
  const ids: string[] = []
  const limit = 500
  let offset = 0
  let count = Infinity
  while (offset < count) {
    const query: Record<string, unknown> = {
      fields: "id",
      limit,
      offset,
      ...toApiFilters(args.filters),
    }
    if (args.q) query.q = args.q
    const res = await sdk.admin.product.list(query as any)
    if (!res.products.length) break
    ids.push(...res.products.map((p: any) => p.id))
    count = res.count
    offset += limit
  }
  return ids
}

export async function fetchProductsByIds(ids: string[]) {
  const res = await sdk.admin.product.list({
    id: ids,
    limit: ids.length,
    fields: FIELDS,
  } as any)
  return res.products as unknown as ProductRow[]
}

export const batch = (body: { update?: any[]; delete?: string[] }) =>
  sdk.client.fetch(BATCH_PATH, { method: "POST", body })

export const hardDelete = (ids: string[]) =>
  sdk.client.fetch(HARD_DELETE_PATH, { method: "POST", body: { ids } })

const uniq = (a: string[]) => Array.from(new Set(a))

function applyList(current: string[], s: SetList) {
  if (s.mode === "replace") return s.ids
  if (s.mode === "add") return uniq([...current, ...s.ids])
  return current.filter((i) => !s.ids.includes(i))
}

/** Build the batch `update` item for one product, or null when nothing changes. */
export function computeUpdate(p: ProductRow, spec: EditSpec) {
  const out: Record<string, any> = { id: p.id }

  if (spec.status && spec.status !== p.status) out.status = spec.status
  if ("collection_id" in spec) out.collection_id = spec.collection_id
  if ("type_id" in spec) out.type_id = spec.type_id
  if (spec.discountable !== undefined && spec.discountable !== p.discountable)
    out.discountable = spec.discountable

  if (spec.categories)
    out.categories = applyList(p.categories?.map((c) => c.id) ?? [], spec.categories).map((id) => ({ id }))
  if (spec.tags)
    out.tags = applyList(p.tags?.map((t) => t.id) ?? [], spec.tags).map((id) => ({ id }))
  if (spec.sales_channels)
    out.sales_channels = applyList(p.sales_channels?.map((c) => c.id) ?? [], spec.sales_channels).map((id) => ({ id }))

  let title = p.title
  if (spec.titleFind) title = title.split(spec.titleFind).join(spec.titleReplace ?? "")
  if (spec.titlePrefix) title = spec.titlePrefix + title
  if (spec.titleSuffix) title = title + spec.titleSuffix
  if (title !== p.title) out.title = title

  const meta: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(spec.metaSet ?? {})) meta[k] = v
  for (const k of spec.metaUnset ?? []) meta[k] = null // null removes the key on merge
  if (Object.keys(meta).length) out.metadata = meta

  return Object.keys(out).length > 1 ? out : null
}
