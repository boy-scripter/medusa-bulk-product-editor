import { defineRouteConfig } from "@medusajs/admin-sdk"
import { PencilSquare } from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  createDataTableColumnHelper,
  createDataTableFilterHelper,
  DataTable,
  DataTableFilteringState,
  DataTablePaginationState,
  DataTableRowSelectionState,
  Heading,
  Text,
  toast,
  useDataTable,
} from "@medusajs/ui"
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { BulkEditDrawer } from "../../components/bulk-edit-drawer"
import { DeleteConfirm } from "../../components/delete-confirm"
import { RunDrawer } from "../../components/run-drawer"
import { useLookups } from "../../hooks/use-lookups"
import { fetchAllIds, listProducts } from "../../lib/api"
import type { EditSpec, Job, ProductRow, Result } from "../../lib/types"

const PAGE_SIZE = 50
const STATUS_COLOR: Record<string, "green" | "grey" | "orange" | "red"> = {
  published: "green",
  draft: "grey",
  proposed: "orange",
  rejected: "red",
}

const fh = createDataTableFilterHelper<ProductRow>()
const ch = createDataTableColumnHelper<ProductRow>()

const daysAgo = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}
const datePresets = [
  { label: "Last 24 hours", value: { $gte: daysAgo(1) } },
  { label: "Last 7 days", value: { $gte: daysAgo(7) } },
  { label: "Last 30 days", value: { $gte: daysAgo(30) } },
]

const chips = (items: string[]) =>
  items.length ? items.slice(0, 2).join(", ") + (items.length > 2 ? ` +${items.length - 2}` : "") : "-"

const parse = <T,>(s: string | null, fallback: T): T => {
  try {
    return s ? (JSON.parse(s) as T) : fallback
  } catch {
    return fallback
  }
}

const columns = [
  ch.select(),
  ch.display({
    id: "title",
    header: "Product",
    cell: ({ row }) => (
      <div className="flex items-center gap-x-2">
        {row.original.thumbnail ? (
          <img src={row.original.thumbnail} className="h-8 w-8 rounded object-cover" />
        ) : (
          <div className="bg-ui-bg-component h-8 w-8 rounded" />
        )}
        <span className="truncate">{row.original.title}</span>
      </div>
    ),
  }),
  ch.accessor("handle", { header: "Handle" }),
  ch.display({
    id: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge size="2xsmall" color={STATUS_COLOR[row.original.status] ?? "grey"}>
        {row.original.status}
      </Badge>
    ),
  }),
  ch.display({ id: "collection", header: "Collection", cell: ({ row }) => row.original.collection?.title ?? "-" }),
  ch.display({ id: "type", header: "Type", cell: ({ row }) => row.original.type?.value ?? "-" }),
  ch.display({
    id: "categories",
    header: "Categories",
    cell: ({ row }) => chips((row.original.categories ?? []).map((c) => c.name)),
  }),
  ch.display({
    id: "tags",
    header: "Tags",
    cell: ({ row }) => chips((row.original.tags ?? []).map((t) => t.value)),
  }),
  ch.display({
    id: "sales_channels",
    header: "Channels",
    cell: ({ row }) => chips((row.original.sales_channels ?? []).map((c) => c.name)),
  }),
  ch.display({ id: "variants", header: "Variants", cell: ({ row }) => row.original.variants?.length ?? 0 }),
  ch.display({
    id: "updated_at",
    header: "Updated",
    cell: ({ row }) => new Date(row.original.updated_at).toLocaleDateString(),
  }),
]

const BulkProductsPage = () => {
  const qc = useQueryClient()
  const lookups = useLookups()
  const [sp, setSp] = useSearchParams()

  const [search, setSearch] = useState(sp.get("q") ?? "")
  const [filtering, setFiltering] = useState<DataTableFilteringState>(() => parse(sp.get("f"), {}))
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageSize: PAGE_SIZE,
    pageIndex: Number(sp.get("p") ?? 0) || 0,
  })
  const [selection, setSelection] = useState<DataTableRowSelectionState>({})

  const [editOpen, setEditOpen] = useState(false)
  const [delKind, setDelKind] = useState<"soft" | "hard" | null>(null)
  const [job, setJob] = useState<Job | null>(null)
  const [selectingAll, setSelectingAll] = useState(false)

  // URL sync (shareable / bookmarkable views)
  useEffect(() => {
    const n = new URLSearchParams()
    if (search) n.set("q", search)
    if (Object.keys(filtering).length) n.set("f", JSON.stringify(filtering))
    if (pagination.pageIndex) n.set("p", String(pagination.pageIndex))
    setSp(n, { replace: true })
  }, [search, filtering, pagination.pageIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  const { data, isLoading } = useQuery({
    queryKey: ["bulk-products", search, filtering, pagination.pageIndex],
    queryFn: () =>
      listProducts({
        q: search,
        filters: filtering as Record<string, unknown>,
        limit: pagination.pageSize,
        offset: pagination.pageIndex * pagination.pageSize,
      }),
    placeholderData: keepPreviousData,
  })
  const rows = data?.products ?? []
  const total = data?.count ?? 0

  const filters = useMemo(
    () => [
      fh.accessor("status", {
        type: "select",
        label: "Status",
        options: ["draft", "proposed", "published", "rejected"].map((s) => ({ label: s, value: s })),
      }),
      fh.accessor("collection", {
        type: "select",
        label: "Collection",
        searchable: true,
        options: lookups.collections.map((o) => ({ label: o.label, value: o.id })),
      }),
      fh.accessor("type", {
        type: "select",
        label: "Type",
        searchable: true,
        options: lookups.types.map((o) => ({ label: o.label, value: o.id })),
      }),
      fh.accessor("categories", {
        type: "select",
        label: "Category",
        searchable: true,
        options: lookups.categories.map((o) => ({ label: o.label, value: o.id })),
      }),
      fh.accessor("tags", {
        type: "select",
        label: "Tag",
        searchable: true,
        options: lookups.tags.map((o) => ({ label: o.label, value: o.id })),
      }),
      fh.accessor("sales_channels", {
        type: "select",
        label: "Sales channel",
        searchable: true,
        options: lookups.channels.map((o) => ({ label: o.label, value: o.id })),
      }),
      fh.accessor("created_at", {
        type: "date",
        label: "Created",
        format: "date",
        formatDateValue: (d: Date) => d.toLocaleDateString(),
        rangeOptionLabel: "Custom",
        rangeOptionStartLabel: "From",
        rangeOptionEndLabel: "To",
        options: datePresets,
      }),
      fh.accessor("updated_at", {
        type: "date",
        label: "Updated",
        format: "date",
        formatDateValue: (d: Date) => d.toLocaleDateString(),
        rangeOptionLabel: "Custom",
        rangeOptionStartLabel: "From",
        rangeOptionEndLabel: "To",
        options: datePresets,
      }),
    ],
    [lookups]
  )

  const selectedIds = useMemo(() => Object.keys(selection).filter((k) => selection[k]), [selection])
  const selectedRows = rows.filter((r) => selection[r.id])

  const resetPage = () => setPagination((p) => ({ ...p, pageIndex: 0 }))

  const table = useDataTable({
    data: rows,
    columns,
    getRowId: (r) => r.id,
    rowCount: total,
    isLoading,
    filters,
    filtering: {
      state: filtering,
      onFilteringChange: (s) => {
        setFiltering(s)
        resetPage()
      },
    },
    search: {
      state: search,
      onSearchChange: (s) => {
        setSearch(s)
        resetPage()
      },
    },
    pagination: { state: pagination, onPaginationChange: setPagination },
    rowSelection: { state: selection, onRowSelectionChange: setSelection },
    commands: [
      { label: "Edit", shortcut: "e", action: () => setEditOpen(true) },
      { label: "Delete", shortcut: "d", action: () => setDelKind("soft") },
      { label: "Hard delete", shortcut: "h", action: () => setDelKind("hard") },
    ],
  })

  const selectAllMatching = async () => {
    setSelectingAll(true)
    try {
      const ids = await fetchAllIds({ q: search, filters: filtering as Record<string, unknown> })
      setSelection(Object.fromEntries(ids.map((id) => [id, true])))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load ids")
    } finally {
      setSelectingAll(false)
    }
  }

  const startEdit = (spec: EditSpec) => {
    setEditOpen(false)
    setJob({ kind: "edit", ids: selectedIds, spec })
  }

  const startDelete = () => {
    if (!delKind) return
    setJob({ kind: delKind, ids: selectedIds })
    setDelKind(null)
  }

  const onRunClose = (results: Record<string, Result>) => {
    const kind = job?.kind
    setJob(null)
    qc.invalidateQueries({ queryKey: ["bulk-products"] })
    if (kind === "soft" || kind === "hard") {
      setSelection((prev) => {
        const next = { ...prev }
        Object.entries(results).forEach(([id, r]) => {
          if (r.status === "ok") delete next[id]
        })
        return next
      })
    }
    const failed = Object.values(results).filter((r) => r.status === "error").length
    if (failed) toast.warning(`${failed} item(s) failed`)
    else toast.success("Done")
  }

  return (
    <Container className="divide-y p-0">
      <DataTable instance={table}>
        <DataTable.Toolbar className="flex flex-col items-start justify-between gap-2 md:flex-row md:items-center">
          <div>
            <Heading>Bulk product editor</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              {total} product{total === 1 ? "" : "s"} match
            </Text>
          </div>
          <div className="flex items-center gap-x-2">
            <DataTable.FilterMenu tooltip="Filter" />
            <DataTable.Search placeholder="Search products" />
          </div>
        </DataTable.Toolbar>

        {(selectedIds.length > 0 || total > 0) && (
          <div className="flex items-center gap-x-3 px-6 py-2">
            <Text size="small">{selectedIds.length} selected</Text>
            {total > 0 && selectedIds.length < total && (
              <Button size="small" variant="transparent" isLoading={selectingAll} onClick={selectAllMatching}>
                Select all {total} matching
              </Button>
            )}
            {selectedIds.length > 0 && (
              <Button size="small" variant="transparent" onClick={() => setSelection({})}>
                Clear
              </Button>
            )}
          </div>
        )}

        <DataTable.Table />
        <DataTable.Pagination />
        <DataTable.CommandBar selectedLabel={(c) => `${c} selected`} />
      </DataTable>

      <BulkEditDrawer
        open={editOpen}
        onOpenChange={setEditOpen}
        count={selectedIds.length}
        lookups={lookups}
        sampleRows={selectedRows}
        onApply={startEdit}
      />
      <DeleteConfirm
        kind={delKind}
        count={selectedIds.length}
        onCancel={() => setDelKind(null)}
        onConfirm={startDelete}
      />
      <RunDrawer job={job} onClose={onRunClose} />
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Bulk Editor",
  icon: PencilSquare,
})

export default BulkProductsPage
