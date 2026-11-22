"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertCircle, Loader2 } from "lucide-react"

interface TaskDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  taskTitle: string
  deleting: boolean
  onConfirm: () => void
}

export function TaskDeleteDialog({
  open,
  onOpenChange,
  taskTitle,
  deleting,
  onConfirm,
}: TaskDeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-accent-ink" />
            Ištrinti užduotį?
          </DialogTitle>
          <DialogDescription>
            Ar tikrai norite ištrinti užduotį &bdquo;{taskTitle}&ldquo;? Šis
            veiksmas negrįžtamas.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleting}
          >
            Atšaukti
          </Button>
          <Button
            onClick={onConfirm}
            disabled={deleting}
            className="bg-accent-ink hover:bg-accent-ink/90 text-white gap-2"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {deleting ? "Trinama..." : "Ištrinti"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
