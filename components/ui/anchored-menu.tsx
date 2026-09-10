"use client";

import {
  useEffect,
  useLayoutEffect,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils/cn";

type AnchoredMenuProps = {
  open: boolean;
  triggerRef: RefObject<HTMLElement | null>;
  menuRef: RefObject<HTMLDivElement | null>;
  id?: string;
  role?: string;
  "aria-label"?: string;
  align?: "left" | "right";
  className?: string;
  onKeyDown?: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  children: ReactNode;
};

/**
 * Renders a menu in a portal, fixed to the trigger.
 * Avoids clipping inside overflow-hidden cards / forms.
 */
export function AnchoredMenu({
  open,
  triggerRef,
  menuRef,
  id,
  role = "menu",
  "aria-label": ariaLabel,
  align = "right",
  className,
  onKeyDown,
  children,
}: AnchoredMenuProps) {
  const [mounted, setMounted] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({
    position: "fixed",
    top: 0,
    left: 0,
    visibility: "hidden",
    zIndex: 200,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;

    function place() {
      const trigger = triggerRef.current;
      const menu = menuRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const gap = 8;
      const menuHeight = menu?.offsetHeight ?? 0;
      const menuWidth = menu?.offsetWidth ?? 168;
      const spaceBelow = window.innerHeight - rect.bottom - gap;
      const openUp =
        menuHeight > 0 &&
        spaceBelow < menuHeight &&
        rect.top - gap > spaceBelow;

      let top = openUp
        ? Math.max(8, rect.top - gap - menuHeight)
        : rect.bottom + gap;

      // Keep fully on-screen vertically when possible
      if (menuHeight > 0) {
        top = Math.min(top, Math.max(8, window.innerHeight - menuHeight - 8));
      }

      if (align === "right") {
        let right = window.innerWidth - rect.right;
        const leftEdge = window.innerWidth - right - menuWidth;
        if (leftEdge < 8) {
          right = Math.max(8, window.innerWidth - menuWidth - 8);
        }
        setStyle({
          position: "fixed",
          top,
          right,
          left: "auto",
          zIndex: 200,
          visibility: "visible",
        });
        return;
      }

      let left = rect.left;
      if (left + menuWidth > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - menuWidth - 8);
      }
      setStyle({
        position: "fixed",
        top,
        left,
        right: "auto",
        zIndex: 200,
        visibility: "visible",
      });
    }

    place();
    const frame = requestAnimationFrame(place);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [align, menuRef, open, triggerRef]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      ref={menuRef}
      id={id}
      role={role}
      aria-label={ariaLabel}
      style={style}
      className={cn(className)}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>,
    document.body,
  );
}
