"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  markPaidAction,
  type MarkPaidState,
} from "@/features/tasks/actions/task-actions";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type MarkPaidFormProps = {
  taskId: string;
};

export function MarkPaidForm({ taskId }: MarkPaidFormProps) {
  const { toast } = useToast();
  const boundAction = markPaidAction.bind(null, taskId);
  const [state, action, pending] = useActionState(
    boundAction,
    undefined as MarkPaidState,
  );
  const lastHandled = useRef<MarkPaidState>(undefined);

  useEffect(() => {
    if (!state || state === lastHandled.current) return;
    lastHandled.current = state;
    if (state.success) {
      toast(state.message ?? "Charge recorded.", "success");
    } else if (state.message) {
      toast(state.message, "error");
    }
  }, [state, toast]);

  return (
    <form action={action} className="mt-4 flex flex-wrap items-end gap-3">
      <div>
        <Label htmlFor="paidAmount">Record merchant charge</Label>
        <Input
          id="paidAmount"
          name="amount"
          type="number"
          min="1"
          step="1"
          placeholder="850"
          required
          disabled={pending}
        />
      </div>
      <Button type="submit" variant="secondary" loading={pending}>
        Mark paid
      </Button>
    </form>
  );
}
