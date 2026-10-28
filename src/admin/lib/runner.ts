import { batch, computeUpdate, fetchProductsByIds, hardDelete } from "./api"
import type { Job, Result } from "./types"

const CHUNK = 25
const CONCURRENCY = 2

type Setter = (id: string, r: Result) => void
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e))

// try the whole chunk; on failure retry one-by-one to isolate bad items
async function send(ids: string[], fn: (ids: string[]) => Promise<unknown>, set: Setter) {
  if (!ids.length) return
  try {
    await fn(ids)
    ids.forEach((id) => set(id, { status: "ok" }))
  } catch (e) {
    if (ids.length === 1) {
      set(ids[0], { status: "error", message: errMsg(e) })
      return
    }
    for (const id of ids) {
      try {
        await fn([id])
        set(id, { status: "ok" })
      } catch (e2) {
        set(id, { status: "error", message: errMsg(e2) })
      }
    }
  }
}

async function runChunk(job: Job, ids: string[], set: Setter) {
  if (job.kind === "edit") {
    const products = await fetchProductsByIds(ids)
    const byId = new Map(products.map((p) => [p.id, p]))
    const updates: any[] = []
    for (const id of ids) {
      const p = byId.get(id)
      if (!p) {
        set(id, { status: "skipped", message: "not found" })
        continue
      }
      const u = computeUpdate(p, job.spec!)
      if (!u) {
        set(id, { status: "skipped", message: "no change" })
        continue
      }
      updates.push(u)
    }
    await send(
      updates.map((u) => u.id),
      (subset) => batch({ update: updates.filter((u) => subset.includes(u.id)) }),
      set
    )
    return
  }
  await send(ids, job.kind === "soft" ? (s) => batch({ delete: s }) : (s) => hardDelete(s), set)
}

export async function runJob(job: Job, set: Setter, signal: AbortSignal) {
  const chunks: string[][] = []
  for (let i = 0; i < job.ids.length; i += CHUNK) chunks.push(job.ids.slice(i, i + CHUNK))
  let next = 0
  const worker = async () => {
    while (next < chunks.length && !signal.aborted) {
      const c = chunks[next++]
      try {
        await runChunk(job, c, set)
      } catch (e) {
        c.forEach((id) => set(id, { status: "error", message: errMsg(e) }))
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, chunks.length) }, worker))
}
