import { Button, Drawer, Heading, Text } from "@medusajs/ui"
import { useCallback, useEffect, useRef, useState } from "react"
import { runJob } from "../lib/runner"
import type { Job, Result } from "../lib/types"

const TITLES = { edit: "Applying bulk edit", soft: "Deleting products", hard: "Hard deleting products" }

export function RunDrawer({
  job,
  onClose,
}: {
  job: Job | null
  onClose: (results: Record<string, Result>) => void
}) {
  const [results, setResults] = useState<Record<string, Result>>({})
  const [running, setRunning] = useState(false)
  const abort = useRef<AbortController | null>(null)

  const start = useCallback(async (j: Job) => {
    const ac = new AbortController()
    abort.current = ac
    setRunning(true)
    await runJob(j, (id, r) => setResults((p) => ({ ...p, [id]: r })), ac.signal)
    setRunning(false)
  }, [])

  useEffect(() => {
    if (job) {
      setResults({})
      start(job)
    }
  }, [job, start])

  if (!job) return null

  const entries = Object.entries(results)
  const total = job.ids.length
  const ok = entries.filter(([, r]) => r.status === "ok").length
  const skipped = entries.filter(([, r]) => r.status === "skipped").length
  const failed = entries.filter(([, r]) => r.status === "error")
  const pct = total ? Math.round((entries.length / total) * 100) : 0

  return (
    <Drawer open onOpenChange={(o) => !o && !running && onClose(results)}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>{TITLES[job.kind]}</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-4 overflow-y-auto">
          <div className="bg-ui-bg-component h-2 w-full overflow-hidden rounded-full">
            <div className="bg-ui-bg-interactive h-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <Text size="small">
            {entries.length}/{total} processed · {ok} ok · {skipped} skipped · {failed.length} failed
          </Text>
          {failed.length > 0 && (
            <div className="flex flex-col gap-y-2">
              <Heading level="h3">Failures</Heading>
              <div className="max-h-72 overflow-y-auto rounded-md border">
                {failed.slice(0, 100).map(([id, r]) => (
                  <div key={id} className="border-b px-3 py-2 last:border-b-0">
                    <Text size="xsmall" weight="plus">
                      {id}
                    </Text>
                    <Text size="xsmall" className="text-ui-fg-subtle">
                      {r.message}
                    </Text>
                  </div>
                ))}
              </div>
              {failed.length > 100 && (
                <Text size="xsmall" className="text-ui-fg-muted">
                  +{failed.length - 100} more
                </Text>
              )}
            </div>
          )}
        </Drawer.Body>
        <Drawer.Footer>
          {running ? (
            <Button variant="secondary" onClick={() => abort.current?.abort()}>
              Stop
            </Button>
          ) : (
            <>
              {failed.length > 0 && (
                <Button
                  variant="secondary"
                  onClick={() => start({ ...job, ids: failed.map(([id]) => id) })}
                >
                  Retry failed ({failed.length})
                </Button>
              )}
              <Button onClick={() => onClose(results)}>Done</Button>
            </>
          )}
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  )
}
