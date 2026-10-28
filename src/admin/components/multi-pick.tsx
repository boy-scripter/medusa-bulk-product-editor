import { Checkbox, Input, Text } from "@medusajs/ui"
import { useMemo, useState } from "react"
import type { Opt } from "../lib/types"

export function MultiPick({
  options,
  value,
  onChange,
}: {
  options: Opt[]
  value: string[]
  onChange: (v: string[]) => void
}) {
  const [q, setQ] = useState("")
  const shown = useMemo(
    () => options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())),
    [options, q]
  )
  return (
    <div className="flex flex-col gap-y-2">
      <Input size="small" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="max-h-40 overflow-y-auto rounded-md border">
        {shown.length === 0 && (
          <Text size="small" className="text-ui-fg-muted p-2">
            No options
          </Text>
        )}
        {shown.map((o) => (
          <label key={o.id} className="hover:bg-ui-bg-base-hover flex cursor-pointer items-center gap-x-2 px-2 py-1">
            <Checkbox
              checked={value.includes(o.id)}
              onCheckedChange={(c) =>
                onChange(c === true ? [...value, o.id] : value.filter((i) => i !== o.id))
              }
            />
            <Text size="small">{o.label}</Text>
          </label>
        ))}
      </div>
      <Text size="xsmall" className="text-ui-fg-muted">
        {value.length} selected
      </Text>
    </div>
  )
}
