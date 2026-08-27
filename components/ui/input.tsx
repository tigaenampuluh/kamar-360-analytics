import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input type={type} className={cn("h-10 w-full rounded-md border border-[#d9d7cf] bg-white px-3 text-sm text-[#183044] outline-none placeholder:text-[#9aa0a3] focus:border-[#e76f36] focus:ring-2 focus:ring-[#e76f36]/15", className)} ref={ref} {...props} />
  )
);
Input.displayName = "Input";
