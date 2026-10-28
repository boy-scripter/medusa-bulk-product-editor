# @xross-dev/medusa-bulk-product-editor

Medusa v2 admin plugin. Adds **Bulk Editor** to the sidebar (`/bulk-products`).

- Filters: search, status, collection, type, category, tag, sales channel, created/updated date (URL-synced)
- Selection: page / manual across pages / **all matching filter**
- Bulk edit: status, collection, type, discountable, categories/tags/channels (add | remove | replace), title find/replace/prefix/suffix, metadata set/unset — with review step
- Delete: soft (`POST /admin/products/batch {delete}`) and hard (`POST /admin/products/bulk-hard-delete`, type DELETE to confirm)
- Chunked execution (25/req, 2 concurrent), progress, per-item errors, retry failed

## Install
```
// medusa-config.ts
plugins: [{ resolve: "@xross-dev/medusa-bulk-product-editor", options: {} }]
```
Dev: `npm run dev` in the plugin, `npx medusa plugin:publish`, then `npx medusa plugin:add @xross-dev/medusa-bulk-product-editor` in the store.

## Using your own workflow/route
Edit `BATCH_PATH` / `HARD_DELETE_PATH` in `src/admin/lib/api.ts`. Delete `src/api/` if you don't need the bundled hard-delete route.
