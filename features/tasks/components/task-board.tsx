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
import { SlaCountdown } from "@/features/dashboard/components/sla-countdown";
import { useToast } from "@/components/providers/toast-provider";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import type { Task, TaskStatus } from "@/types/task";

type BoardColumnId = "assigned" | "in_progress" | "waiting" | "done";

const BOARD_COLUMNS: Array<{
  id: BoardColumnId;
  label: string;
  hint: string;
  color: string;
  statuses: TaskStatus[];
  dropStatus: TaskStatus;
}> = [
  {
    id: "assigned",
    label: "Assigned",
    hint: "Ready to start",
    color: "#64748b",
    statuses: ["queued", "assigned"],
    dropStatus: "assigned",
  },
  {
    id: "in_progress",
    label: "In progress",
    hint: "Being worked",
    color: "#4f7cff",
    statuses: ["in_progress"],
    dropStatus: "in_progress",
  },
  {
    id: "waiting",
    label: "Waiting",
    hint: "Customer or payment",
    color: "#d97706",
    statuses: ["waiting_for_customer", "waiting_for_payment"],
    dropStatus: "waiting_for_customer",
  },
  {
    id: "done",
    label: "Done",
    hint: "Completed, failed, or cancelled",
    color: "#059669",
    statuses: ["completed", "failed", "cancelled"],
    dropStatus: "completed",
  },
];

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

function columnKey(id: BoardColumnId) {
  return `col:${id}`;
}

function parseColumnKey(id: string | undefined | null): BoardColumnId | null {
  if (!id?.startsWith("col:")) return null;
  const key = id.slice(4) as BoardColumnId;
  return BOARD_COLUMNS.some((column) => column.id === key) ? key : null;
}

function columnForStatus(status: TaskStatus): BoardColumnId | null {
  return BOARD_COLUMNS.find((column) => column.statuses.includes(status))?.id ?? null;
}

function TaskBoardCard({
  task,
  dragging,
}: {
  task: Task;
  dragging?: boolean;
}) {
  const typeLabel = task.taskType?.replaceAll("_", " ") ?? "Task";
  const initial = task.customerName.trim().slice(0, 1).toUpperCase() || "C";

  return (
    <article
      className={cn(
        "rounded-lg border border-transparent bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/80 transition-all",
        "hover:-translate-y-px hover:shadow-[0_8px_18px_rgba(15,23,42,0.08)] hover:ring-slate-300",
        dragging && "rotate-1 shadow-[0_16px_32px_rgba(15,23,42,0.16)] ring-accent/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          {typeLabel}
        </p>
        <span
          className={cn(
            "rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase",
            task.priority === "urgent"
              ? "bg-red-50 text-red-700"
              : task.priority === "high"
                ? "bg-orange-50 text-orange-700"
                : "bg-slate-100 text-slate-600",
          )}
        >
          {task.priority}
        </span>
      </div>
      <p className="mt-1.5 text-[13px] font-semibold leading-snug text-slate-900">
        {task.title}
      </p>
      {task.expiresAt ? (
        <div className="mt-2">
          <SlaCountdown expiresAt={task.expiresAt} />
        </div>
      ) : null}
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium tabular-nums text-slate-400">
          #{task.number} · {formatRelative(task.updatedAt)}
        </span>
        <span
          className="flex size-6 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600"
          title={task.customerName}
        >
          {initial}
        </span>
      </div>
    </article>
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

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(isDragging && "opacity-30")}
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
          className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <TaskBoardCard task={task} />
        </Link>
      </div>
    </div>
  );
}

function BoardColumn({
  column,
  tasks,
}: {
  column: (typeof BOARD_COLUMNS)[number];
  tasks: Task[];
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: columnKey(column.id),
    data: { type: "column", columnId: column.id },
  });

  return (
    <section className="flex min-h-0 min-w-0 flex-col">
      <header className="mb-2 flex items-end justify-between gap-2 px-1">
        <div className="min-w-0">
          <h3 className="truncate text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
            {column.label}
          </h3>
          <p className="truncate text-[11px] text-slate-400">{column.hint}</p>
        </div>
        <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[11px] font-bold tabular-nums text-slate-600">
          {tasks.length}
        </span>
      </header>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[12rem] flex-1 flex-col gap-2 overflow-y-auto rounded-xl bg-slate-100/80 p-2 ring-1 ring-inset ring-slate-200/80 transition-colors",
          isOver && "bg-accent/[0.06] ring-2 ring-accent/30",
        )}
      >
        <SortableContext
          items={tasks.map((task) => task.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.length === 0 ? (
            <p className="m-auto px-2 py-8 text-center text-[12px] text-slate-400">
              Drop a card here
            </p>
          ) : (
            tasks.map((task) => <SortableTaskCard key={task.id} task={task} />)
          )}
        </SortableContext>
      </div>
    </section>
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

  const byColumn = useMemo(() => {
    const map = new Map<BoardColumnId, Task[]>();
    for (const column of BOARD_COLUMNS) map.set(column.id, []);
    for (const task of items) {
      const columnId = columnForStatus(task.status);
      if (!columnId) continue;
      map.get(columnId)!.push(task);
    }
    return map;
  }, [items]);

  const activeTask = activeId
    ? (items.find((task) => task.id === activeId) ?? null)
    : null;

  function findColumnForId(id: string): BoardColumnId | null {
    const asColumn = parseColumnKey(id);
    if (asColumn) return asColumn;
    const task = items.find((item) => item.id === id);
    return task ? columnForStatus(task.status) : null;
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const from = findColumnForId(String(active.id));
    const to = findColumnForId(String(over.id));
    if (!from || !to || from === to) return;
    const dropStatus = BOARD_COLUMNS.find((column) => column.id === to)?.dropStatus;
    if (!dropStatus) return;

    setItems((current) =>
      current.map((task) =>
        task.id === String(active.id)
          ? { ...task, status: dropStatus, updatedAt: new Date().toISOString() }
          : task,
      ),
    );
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over) {
      setItems(tasks);
      return;
    }

    const taskId = String(active.id);
    const nextColumn = findColumnForId(String(over.id));
    const previous = tasks.find((task) => task.id === taskId);
    const current = items.find((task) => task.id === taskId);
    const dropStatus = BOARD_COLUMNS.find((column) => column.id === nextColumn)
      ?.dropStatus;

    if (!nextColumn || !previous || !current || !dropStatus) {
      setItems(tasks);
      return;
    }
    if (previous.status === current.status) return;

    const snapshot = previous;
    const result = await updateTaskStatusAction(taskId, dropStatus);
    if (!result.ok) {
      setItems((latest) =>
        latest.map((task) => (task.id === taskId ? snapshot : task)),
      );
      toast(result.message || "Couldn’t update task status. Try again.", "error");
    }
  }

  if (tasks.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-16 text-center">
        <p className="text-sm font-semibold text-foreground">No tasks to show</p>
        <p className="mt-1 text-sm text-muted">
          Adjust filters or search to see work on the board.
        </p>
      </div>
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
      <div className="grid min-h-[28rem] grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 xl:min-h-[min(68vh,40rem)]">
        {BOARD_COLUMNS.map((column) => (
          <BoardColumn
            key={column.id}
            column={column}
            tasks={byColumn.get(column.id) ?? []}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask ? (
          <div className="w-72">
            <TaskBoardCard task={activeTask} dragging />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
