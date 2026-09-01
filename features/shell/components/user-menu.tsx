"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { ConfirmDialog } from "@/components/ui/dialog";
import { logoutAction } from "@/features/auth/actions/auth";
import { useClearAppCache } from "@/features/agents/hooks";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import { getAgentDisplayName, type BackendUser } from "@/types/user";

type UserMenuProps = {
  user: BackendUser;
  statusLabel?: string;
  online?: boolean;
};

function UserIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="size-4 shrink-0" aria-hidden>
      <circle cx="8" cy="5.5" r="2.4" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M3.2 13c.7-2.2 2.5-3.4 4.8-3.4s4.1 1.2 4.8 3.4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="size-4 shrink-0" aria-hidden>
      <path
        d="M6.25 3H4.5A1.5 1.5 0 0 0 3 4.5v7A1.5 1.5 0 0 0 4.5 13h1.75"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M6.75 8h6.5M10.75 5.5 13.25 8l-2.5 2.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const ITEM_CLASS =
  "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium outline-none transition-colors focus-visible:bg-surface-hover focus-visible:ring-2 focus-visible:ring-accent/40";

export function UserMenu({
  user,
  statusLabel = "Online",
  online = true,
}: UserMenuProps) {
  const pathname = usePathname();
  const clearCache = useClearAppCache();
  const name = getAgentDisplayName(user);
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLElement | null>>([]);
  const initialFocus = useRef(0);
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  const focusItem = useCallback((index: number) => {
    const items = itemRefs.current.filter(Boolean);
    if (items.length === 0) return;
    const next = (index + items.length) % items.length;
    items[next]?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      close();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close(true);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() =>
      focusItem(initialFocus.current),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [open, focusItem]);

  const previousPath = useRef(pathname);
  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    close();
  }, [pathname, close]);

  function openMenu(focusIndex = 0) {
    initialFocus.current = focusIndex;
    setOpen(true);
  }

  function onTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      openMenu(0);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      openMenu(-1);
    }
  }

  function onMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const items = itemRefs.current.filter(Boolean);
    const current = items.findIndex((el) => el === document.activeElement);

    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusItem(current + 1);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusItem(current - 1);
    }
    if (event.key === "Home") {
      event.preventDefault();
      focusItem(0);
    }
    if (event.key === "End") {
      event.preventDefault();
      focusItem(items.length - 1);
    }
    if (event.key === "Tab") {
      close();
    }
  }

  const profileActive =
    pathname === ROUTES.profile || pathname.startsWith(`${ROUTES.profile}/`);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        className={cn(
          "flex max-w-64 cursor-pointer items-center gap-2.5 rounded-[var(--radius-pill)] px-2 py-1.5 text-left",
          "transition-colors hover:bg-surface-hover",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          open && "bg-surface-hover",
        )}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Account menu for ${name}`}
        onClick={() => (open ? close() : openMenu(0))}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="hidden min-w-0 sm:block">
          <span className="block truncate text-sm font-semibold leading-tight text-foreground">
            {name}
          </span>
          <span className="mt-0.5 inline-flex items-center gap-1.5 text-xs font-medium text-muted">
            <span
              className={cn(
                "size-1.5 rounded-full",
                online ? "bg-success" : "bg-muted-dim",
              )}
            />
            {statusLabel}
          </span>
        </span>
        <span className="flex size-8 items-center justify-center rounded-md border border-border bg-surface-muted text-muted sm:hidden">
          <UserIcon />
        </span>
      </button>

      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="Account"
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 z-50 mt-2 w-72 origin-top-right rounded-[var(--radius-lg)] border border-border bg-surface p-3 shadow-[var(--shadow-dropdown)]"
        >
          <div className="border-b border-border pb-3">
            <p className="truncate text-sm font-semibold text-foreground">
              {name}
            </p>
            <p className="truncate text-xs text-muted">{user.email}</p>
            <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success-foreground">
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  online ? "bg-success" : "bg-muted-dim",
                )}
              />
              {statusLabel}
            </span>
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-dim">
              Support agent
            </p>
          </div>

          <div className="space-y-2 pt-3">
            <Link
              ref={(el) => {
                itemRefs.current[0] = el;
              }}
              href={ROUTES.profile}
              role="menuitem"
              tabIndex={-1}
              aria-current={profileActive ? "page" : undefined}
              className={cn(
                ITEM_CLASS,
                "justify-center border border-border",
                profileActive
                  ? "bg-accent-soft text-accent"
                  : "text-foreground hover:bg-surface-hover",
              )}
              onClick={() => close()}
            >
              <UserIcon />
              Profile
            </Link>
            <button
              ref={(el) => {
                itemRefs.current[1] = el;
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className={cn(
                ITEM_CLASS,
                "justify-center bg-accent text-accent-foreground hover:bg-accent-hover",
              )}
              onClick={() => {
                close();
                setConfirmOpen(true);
              }}
            >
              <SignOutIcon />
              Log Out
            </button>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Sign out?"
        description="You’ll need to sign in again to continue working on tasks."
        confirmLabel="Log Out"
        cancelLabel="Stay signed in"
        destructive
        loading={pending}
        onConfirm={() => {
          clearCache();
          startTransition(() => {
            void logoutAction();
          });
        }}
      />
    </div>
  );
}
