"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { updateTaskStatusAction } from "@/features/tasks/actions/task-actions";
import { PriorityBadge } from "@/features/tasks/components/status-badge";
import { TASK_STAGES } from "@/features/tasks/components/stage-progress";
import { useToast } from "@/components/providers/toast-provider";
import { Card } from "@/components/ui/card";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import type { Task, TaskStatus } from "@/types/task";

type TaskBoardProps = {
  tasks: Task[];
};

function formatRelative(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const diffMs = Date.now() - date.getTime();
  const mins = Math.max(0, Math.floor(diffMs / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isBoardStatus(status: string): status is TaskStatus {
  return TASK_STAGES.some((stage) => stage.status === status);
}

function columnId(status: TaskStatus) {
  return `col:${status}`;
}

function parseColumnId(id: string | undefined | null): TaskStatus | null {
  if (!id?.startsWith("col:")) return null;
  const status = id.slice(4);
  return isBoardStatus(status) ? status : null;
}

function TaskBoardCardContent({
  task,
  dragging,
}: {
  task: Task;
  dragging?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface p-4 shadow-[var(--shadow-card)]",
        dragging && "shadow-[var(--shadow-soft)] ring-2 ring-accent/30",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-base font-semibold text-muted">#{task.number}</span>
        <PriorityBadge priority={task.priority} />
      </div>
      <p className="mt-2 text-base font-semibold leading-snug text-foreground">
        {task.title}
      </p>
      <p className="mt-1.5 truncate text-base text-muted">{task.customerName}</p>
      <p className="mt-2.5 text-sm tabular-nums text-muted-dim">
        {formatRelative(task.updatedAt)}
      </p>
    </div>
  );
}

function SortableTaskCard({ task }: { task: Task }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { type: "task", task, status: task.status },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && "opacity-40")}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none active:cursor-grabbing"
      >
        <Link
          href={ROUTES.task(task.id)}
          onClick={(event) => {
            if (isDragging) event.preventDefault();
          }}
          className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
        >
          <TaskBoardCardContent task={task} />
        </Link>
      </div>
    </div>
  );
}

function BoardColumn({
  status,
  label,
  color,
  tasks,
}: {
  status: TaskStatus;
  label: string;
  color: string;
  tasks: Task[];
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: columnId(status),
    data: { type: "column", status },
  });

  return (
    <div className="flex w-[280px] shrink-0 flex-col md:w-[300px]">
      <div className="mb-3 flex items-center justify-between gap-2 px-1">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
            aria-hidden
          />
          <h3 className="truncate text-base font-semibold text-foreground">
            {label}
          </h3>
        </div>
        <span className="rounded-full bg-surface-hover px-2.5 py-0.5 text-sm font-semibold tabular-nums text-muted">
          {tasks.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex max-h-[min(70vh,640px)] min-h-[12rem] flex-1 flex-col gap-2.5 overflow-y-auto rounded-2xl border border-border bg-[#f8fafc] p-2.5 transition-colors",
          isOver && "border-accent/40 bg-accent/[0.04]",
        )}
      >
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.length === 0 ? (
            <p className="m-auto px-3 py-8 text-center text-base text-muted">
              No tasks here
            </p>
          ) : (
            tasks.map((task) => <SortableTaskCard key={task.id} task={task} />)
          )}
        </SortableContext>
      </div>
    </div>
  );
}

export function TaskBoard({ tasks }: TaskBoardProps) {
  const { toast } = useToast();
  const [items, setItems] = useState<Task[]>(tasks);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    setItems(tasks);
  }, [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const byStatus = useMemo(() => {
    const map = new Map<TaskStatus, Task[]>();
    for (const stage of TASK_STAGES) map.set(stage.status, []);
    for (const task of items) {
      if (!map.has(task.status)) continue;
      map.get(task.status)!.push(task);
    }
    return map;
  }, [items]);

  const activeTask = activeId
    ? (items.find((t) => t.id === activeId) ?? null)
    : null;

  function findStatusForId(id: string): TaskStatus | null {
    const asColumn = parseColumnId(id);
    if (asColumn) return asColumn;
    const task = items.find((t) => t.id === id);
    return task?.status ?? null;
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeTaskId = String(active.id);
    const overId = String(over.id);
    const fromStatus = findStatusForId(activeTaskId);
    const toStatus =
      parseColumnId(overId) ?? findStatusForId(overId);

    if (!fromStatus || !toStatus || fromStatus === toStatus) return;

    setItems((current) => {
      const moving = current.find((t) => t.id === activeTaskId);
      if (!moving || moving.status === toStatus) return current;
      return current.map((task) =>
        task.id === activeTaskId
          ? {
              ...task,
              status: toStatus,
              updatedAt: new Date().toISOString(),
            }
          : task,
      );
    });
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);

    if (!over) {
      setItems(tasks);
      return;
    }

    const taskId = String(active.id);
    const overId = String(over.id);
    const nextStatus = parseColumnId(overId) ?? findStatusForId(overId);
    const previous = tasks.find((t) => t.id === taskId);
    const current = items.find((t) => t.id === taskId);

    if (!nextStatus || !previous || !current) {
      setItems(tasks);
      return;
    }

    if (previous.status === current.status) return;

    const snapshot = previous;

    setItems((latest) =>
      latest.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status: current.status,
              updatedAt: new Date().toISOString(),
            }
          : task,
      ),
    );

    try {
      await updateTaskStatusAction(taskId, current.status);
    } catch {
      setItems((latest) =>
        latest.map((task) => (task.id === taskId ? snapshot : task)),
      );
      toast("Couldn’t update task status. Try again.", "error");
    }
  }

  if (tasks.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-base font-medium text-foreground">No tasks to show</p>
        <p className="mt-1 text-sm text-muted">
          Adjust filters or search to see work on the board.
        </p>
      </Card>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-2">
        {TASK_STAGES.map((stage) => (
          <BoardColumn
            key={stage.status}
            status={stage.status}
            label={stage.label}
            color={stage.color}
            tasks={byStatus.get(stage.status) ?? []}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask ? (
          <div className="w-[268px] md:w-[288px]">
            <TaskBoardCardContent task={activeTask} dragging />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
