import { Button, Drawer, Label, Select, Switch, Text, Textarea, Input } from "@medusajs/ui"
import { ReactNode, useState } from "react"
import { computeUpdate } from "../lib/api"
import type { EditSpec, Lookups, Mode, Opt, ProductRow } from "../lib/types"
import { MultiPick } from "./multi-pick"

const NONE = "__none__"
type ListKey = "categories" | "tags" | "sales_channels"

function Field({
  title,
  on,
  onToggle,
  children,
}: {
  title: string
  on: boolean
  onToggle: (v: boolean) => void
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-y-2 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <Label size="small" weight="plus">
          {title}
        </Label>
        <Switch checked={on} onCheckedChange={onToggle} />
      </div>
      {on && children}
    </div>
  )
}

function Pick({
  value,
  onChange,
  items,
  withNone,
}: {
  value: string
  onChange: (v: string) => void
  items: Opt[]
  withNone?: boolean
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <Select.Trigger>
        <Select.Value placeholder="Select" />
      </Select.Trigger>
      <Select.Content>
        {withNone && <Select.Item value={NONE}>— None (clear) —</Select.Item>}
        {items.map((i) => (
          <Select.Item key={i.id} value={i.id}>
            {i.label}
          </Select.Item>
        ))}
      </Select.Content>
    </Select>
  )
}

const STATUSES: Opt[] = ["draft", "proposed", "published", "rejected"].map((s) => ({ id: s, label: s }))
const MODES: Opt[] = [
  { id: "add", label: "Add to existing" },
  { id: "remove", label: "Remove from existing" },
  { id: "replace", label: "Replace all" },
]

export function BulkEditDrawer({
  open,
  onOpenChange,
  count,
  lookups,
  sampleRows,
  onApply,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  count: number
  lookups: Lookups
  sampleRows: ProductRow[]
  onApply: (spec: EditSpec) => void
}) {
  const [on, setOn] = useState<Record<string, boolean>>({})
  const tog = (k: string) => (v: boolean) => setOn((p) => ({ ...p, [k]: v }))
  const [status, setStatus] = useState("published")
  const [collection, setCollection] = useState(NONE)
  const [type, setType] = useState(NONE)
  const [discountable, setDiscountable] = useState("true")
  const [lists, setLists] = useState<Record<ListKey, { mode: Mode; ids: string[] }>>({
    categories: { mode: "add", ids: [] },
    tags: { mode: "add", ids: [] },
    sales_channels: { mode: "add", ids: [] },
  })
  const [t, setT] = useState({ find: "", replace: "", prefix: "", suffix: "" })
  const [metaSet, setMetaSet] = useState("")
  const [metaUnset, setMetaUnset] = useState("")
  const [step, setStep] = useState<"form" | "preview">("form")

  const buildSpec = (): EditSpec => {
    const s: EditSpec = {}
    if (on.status) s.status = status
    if (on.collection) s.collection_id = collection === NONE ? null : collection
    if (on.type) s.type_id = type === NONE ? null : type
    if (on.discountable) s.discountable = discountable === "true"
    ;(["categories", "tags", "sales_channels"] as ListKey[]).forEach((k) => {
      if (on[k] && (lists[k].mode === "replace" || lists[k].ids.length)) s[k] = lists[k]
    })
    if (on.title) {
      if (t.find) {
        s.titleFind = t.find
        s.titleReplace = t.replace
      }
      if (t.prefix) s.titlePrefix = t.prefix
      if (t.suffix) s.titleSuffix = t.suffix
    }
    if (on.metadata) {
      const set: Record<string, string> = {}
      metaSet
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .forEach((l) => {
          const i = l.indexOf("=")
          if (i > 0) set[l.slice(0, i).trim()] = l.slice(i + 1).trim()
        })
      const unset = metaUnset.split(",").map((k) => k.trim()).filter(Boolean)
      if (Object.keys(set).length) s.metaSet = set
      if (unset.length) s.metaUnset = unset
    }
    return s
  }

  const spec = buildSpec()
  const valid = Object.keys(spec).length > 0

  const lbl = (opts: Opt[], id?: string | null) => (id ? opts.find((o) => o.id === id)?.label ?? id : "none")
  const names = (opts: Opt[], ids: string[]) => ids.map((i) => lbl(opts, i)).join(", ") || "nothing"
  const modeText: Record<Mode, string> = { add: "add", remove: "remove", replace: "replace with" }

  const lines: string[] = []
  if (spec.status) lines.push(`Status → ${spec.status}`)
  if ("collection_id" in spec) lines.push(`Collection → ${lbl(lookups.collections, spec.collection_id)}`)
  if ("type_id" in spec) lines.push(`Type → ${lbl(lookups.types, spec.type_id)}`)
  if (spec.discountable !== undefined) lines.push(`Discountable → ${spec.discountable}`)
  if (spec.categories) lines.push(`Categories: ${modeText[spec.categories.mode]} ${names(lookups.categories, spec.categories.ids)}`)
  if (spec.tags) lines.push(`Tags: ${modeText[spec.tags.mode]} ${names(lookups.tags, spec.tags.ids)}`)
  if (spec.sales_channels) lines.push(`Sales channels: ${modeText[spec.sales_channels.mode]} ${names(lookups.channels, spec.sales_channels.ids)}`)
  if (spec.titleFind) lines.push(`Title: replace "${spec.titleFind}" with "${spec.titleReplace ?? ""}"`)
  if (spec.titlePrefix) lines.push(`Title: prefix "${spec.titlePrefix}"`)
  if (spec.titleSuffix) lines.push(`Title: suffix "${spec.titleSuffix}"`)
  if (spec.metaSet) lines.push(`Metadata set: ${Object.keys(spec.metaSet).join(", ")}`)
  if (spec.metaUnset) lines.push(`Metadata unset: ${spec.metaUnset.join(", ")}`)

  const samples = step === "preview"
    ? sampleRows
        .map((p) => ({ p, u: computeUpdate(p, spec) }))
        .filter((x) => x.u?.title)
        .slice(0, 5)
    : []

  const listField = (k: ListKey, title: string, opts: Opt[]) => (
    <Field title={title} on={!!on[k]} onToggle={tog(k)}>
      <Pick
        value={lists[k].mode}
        onChange={(m) => setLists((p) => ({ ...p, [k]: { ...p[k], mode: m as Mode } }))}
        items={MODES}
      />
      <MultiPick
        options={opts}
        value={lists[k].ids}
        onChange={(ids) => setLists((p) => ({ ...p, [k]: { ...p[k], ids } }))}
      />
    </Field>
  )

  return (
    <Drawer
      open={open}
      onOpenChange={(o) => {
        if (!o) setStep("form")
        onOpenChange(o)
      }}
    >
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>
            {step === "form" ? `Bulk edit ${count} products` : "Review changes"}
          </Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-3 overflow-y-auto">
          {step === "form" ? (
            <>
              <Text size="small" className="text-ui-fg-subtle">
                Only enabled fields are applied.
              </Text>
              <Field title="Status" on={!!on.status} onToggle={tog("status")}>
                <Pick value={status} onChange={setStatus} items={STATUSES} />
              </Field>
              <Field title="Collection" on={!!on.collection} onToggle={tog("collection")}>
                <Pick value={collection} onChange={setCollection} items={lookups.collections} withNone />
              </Field>
              <Field title="Type" on={!!on.type} onToggle={tog("type")}>
                <Pick value={type} onChange={setType} items={lookups.types} withNone />
              </Field>
              <Field title="Discountable" on={!!on.discountable} onToggle={tog("discountable")}>
                <Pick
                  value={discountable}
                  onChange={setDiscountable}
                  items={[{ id: "true", label: "Yes" }, { id: "false", label: "No" }]}
                />
              </Field>
              {listField("categories", "Categories", lookups.categories)}
              {listField("tags", "Tags", lookups.tags)}
              {listField("sales_channels", "Sales channels", lookups.channels)}
              <Field title="Title find / replace / prefix / suffix" on={!!on.title} onToggle={tog("title")}>
                <Input placeholder="Find" value={t.find} onChange={(e) => setT({ ...t, find: e.target.value })} />
                <Input placeholder="Replace with" value={t.replace} onChange={(e) => setT({ ...t, replace: e.target.value })} />
                <Input placeholder="Prefix" value={t.prefix} onChange={(e) => setT({ ...t, prefix: e.target.value })} />
                <Input placeholder="Suffix" value={t.suffix} onChange={(e) => setT({ ...t, suffix: e.target.value })} />
              </Field>
              <Field title="Metadata" on={!!on.metadata} onToggle={tog("metadata")}>
                <Textarea
                  placeholder={"Set (one per line):\nkey=value"}
                  value={metaSet}
                  onChange={(e) => setMetaSet(e.target.value)}
                />
                <Input
                  placeholder="Keys to remove, comma separated"
                  value={metaUnset}
                  onChange={(e) => setMetaUnset(e.target.value)}
                />
              </Field>
            </>
          ) : (
            <>
              <Text size="small">
                {count} product{count === 1 ? "" : "s"} will be updated:
              </Text>
              <ul className="list-disc pl-5">
                {lines.map((l) => (
                  <li key={l}>
                    <Text size="small">{l}</Text>
                  </li>
                ))}
              </ul>
              {samples.length > 0 && (
                <div className="flex flex-col gap-y-1">
                  <Text size="small" weight="plus">
                    Title preview (selected rows on this page)
                  </Text>
                  {samples.map(({ p, u }) => (
                    <Text key={p.id} size="xsmall" className="text-ui-fg-subtle">
                      {p.title} → {u!.title}
                    </Text>
                  ))}
                </div>
              )}
            </>
          )}
        </Drawer.Body>
        <Drawer.Footer>
          {step === "form" ? (
            <>
              <Drawer.Close asChild>
                <Button variant="secondary">Cancel</Button>
              </Drawer.Close>
              <Button disabled={!valid} onClick={() => setStep("preview")}>
                Review
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setStep("form")}>
                Back
              </Button>
              <Button
                onClick={() => {
                  setStep("form")
                  onApply(spec)
                }}
              >
                Apply to {count}
              </Button>
            </>
          )}
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  )
}
