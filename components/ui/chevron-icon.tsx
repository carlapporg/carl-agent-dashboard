import { cn } from "@/lib/utils/cn";

type ChevronIconProps = {
  className?: string;
  /** down (default) or right — rotate with Tailwind as needed */
  direction?: "down" | "right";
};

/** Theme-aware chevron (uses currentColor). */
export function ChevronIcon({
  className,
  direction = "down",
}: ChevronIconProps) {
  if (direction === "right") {
    return (
      <svg
        viewBox="0 0 15 15"
        fill="none"
        aria-hidden
        className={cn("size-[15px]", className)}
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M5.183 2.683a.75.75 0 0 1 1.061 0l4.375 4.375a.75.75 0 0 1 0 1.061l-4.375 4.375a.75.75 0 0 1-1.061-1.06L9.116 7.5 5.183 3.567a.75.75 0 0 1 0-1.06Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
      className={cn("size-5", className)}
    >
      <path
        d="M9.58 14.17c.13 0 .25-.03.36-.08.11-.05.22-.12.32-.22l5.73-5.74c.17-.16.26-.36.26-.6 0-.16-.04-.3-.12-.44a.9.9 0 0 0-.32-.31.86.86 0 0 0-.43-.11c-.24 0-.46.09-.64.26L9.58 12.1 4.42 6.93a.9.9 0 0 0-.63-.26.86.86 0 0 0-.44.11.9.9 0 0 0-.31.31c-.08.13-.12.28-.12.44 0 .24.08.44.25.6l5.73 5.74c.1.1.21.17.32.22.11.05.23.08.36.08Z"
        fill="currentColor"
      />
    </svg>
  );
}
