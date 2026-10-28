import { Input, Prompt, Text } from "@medusajs/ui"
import { useEffect, useState } from "react"

export function DeleteConfirm({
  kind,
  count,
  onCancel,
  onConfirm,
}: {
  kind: "soft" | "hard" | null
  count: number
  onCancel: () => void
  onConfirm: () => void
}) {
  const [typed, setTyped] = useState("")
  useEffect(() => setTyped(""), [kind])
  const hard = kind === "hard"
  return (
    <Prompt open={!!kind} onOpenChange={(o) => !o && onCancel()} variant="danger">
      <Prompt.Content>
        <Prompt.Header>
          <Prompt.Title>
            {hard ? "Permanently delete" : "Delete"} {count} product{count === 1 ? "" : "s"}?
          </Prompt.Title>
          <Prompt.Description>
            {hard
              ? "Hard delete removes the products and their variants from the database. This cannot be undone."
              : "Products are soft-deleted (deleted_at is set)."}
          </Prompt.Description>
        </Prompt.Header>
        {hard && (
          <div className="flex flex-col gap-y-2 px-6 pb-4">
            <Text size="small">
              Type <b>DELETE</b> to confirm
            </Text>
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} />
          </div>
        )}
        <Prompt.Footer>
          <Prompt.Cancel onClick={onCancel}>Cancel</Prompt.Cancel>
          <Prompt.Action disabled={hard && typed !== "DELETE"} onClick={onConfirm}>
            {hard ? "Hard delete" : "Delete"}
          </Prompt.Action>
        </Prompt.Footer>
      </Prompt.Content>
    </Prompt>
  )
}
