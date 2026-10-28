import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"

/**
 * POST /admin/products/bulk-hard-delete  { ids: string[] }
 * Permanently removes products (+ variants). Admin-authenticated by default.
 * Skip/replace this file if you already have your own hard-delete route/workflow —
 * then just change HARD_DELETE_PATH in src/admin/lib/api.ts.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const ids = (req.body as { ids?: unknown })?.ids
  if (!Array.isArray(ids) || !ids.length || ids.length > 500 || ids.some((i) => typeof i !== "string")) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "ids must be an array of 1-500 product ids")
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const link = req.scope.resolve(ContainerRegistrationKeys.LINK)
  const productService = req.scope.resolve(Modules.PRODUCT)

  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "variants.id"],
    filters: { id: ids as string[] },
  })
  const found = data.map((p: any) => p.id as string)
  const variantIds = data.flatMap((p: any) => (p.variants ?? []).map((v: any) => v.id as string))

  // clean cross-module links (sales channels, inventory, price sets, ...) before the rows go away
  const links: Record<string, Record<string, string[]>> = {
    [Modules.PRODUCT]: { product_id: found },
  }
  if (variantIds.length) links[Modules.PRODUCT].variant_id = variantIds
  await link.delete(links)

  // module-service `delete*` is a hard delete (soft is `softDelete*`)
  await productService.deleteProducts(found)

  res.json({ ids: found, object: "product", deleted: true })
}
