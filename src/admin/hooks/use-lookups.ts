import { useQuery } from "@tanstack/react-query"
import { sdk } from "../lib/sdk"
import type { Lookups } from "../lib/types"

const EMPTY: Lookups = { collections: [], types: [], categories: [], tags: [], channels: [] }

export function useLookups(): Lookups {
  const { data } = useQuery({
    queryKey: ["bulk-products-lookups"],
    staleTime: 60_000,
    queryFn: async (): Promise<Lookups> => {
      const p = { limit: 200 } as any
      const [c, t, cat, tag, ch] = await Promise.all([
        sdk.admin.productCollection.list(p),
        sdk.admin.productType.list(p),
        sdk.admin.productCategory.list(p),
        sdk.admin.productTag.list(p),
        sdk.admin.salesChannel.list(p),
      ])
      return {
        collections: c.collections.map((x: any) => ({ id: x.id, label: x.title })),
        types: t.product_types.map((x: any) => ({ id: x.id, label: x.value })),
        categories: cat.product_categories.map((x: any) => ({ id: x.id, label: x.name })),
        tags: tag.product_tags.map((x: any) => ({ id: x.id, label: x.value })),
        channels: ch.sales_channels.map((x: any) => ({ id: x.id, label: x.name })),
      }
    },
  })
  return data ?? EMPTY
}
