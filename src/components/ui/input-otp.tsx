"use client";

import * as React from "react";
import { OTPInput, OTPInputContext } from "input-otp";

// Adapted from shadcn/ui's input-otp to this app's neutral Tailwind tokens
// (no CSS-variable theme / cn util), with media-query dark mode and separated,
// individually-rounded boxes.

export function InputOTP({
  className = "",
  containerClassName = "",
  ...props
}: React.ComponentProps<typeof OTPInput> & { containerClassName?: string }) {
  return (
    <OTPInput
      data-slot="input-otp"
      containerClassName={`flex items-center gap-2 has-[:disabled]:opacity-50 ${containerClassName}`}
      className={`disabled:cursor-not-allowed ${className}`}
      {...props}
    />
  );
}

export function InputOTPGroup({ className = "", ...props }: React.ComponentProps<"div">) {
  return <div data-slot="input-otp-group" className={`flex items-center gap-2 ${className}`} {...props} />;
}

export function InputOTPSlot({
  index,
  className = "",
  ...props
}: React.ComponentProps<"div"> & { index: number }) {
  const context = React.useContext(OTPInputContext);
  const slot = context?.slots[index];
  const char = slot?.char;
  const hasFakeCaret = slot?.hasFakeCaret;
  const isActive = slot?.isActive;

  return (
    <div
      data-slot="input-otp-slot"
      data-active={isActive}
      className={
        "relative flex h-12 w-11 items-center justify-center rounded-lg border border-neutral-300 bg-white text-lg font-medium text-neutral-900 shadow-sm transition-all outline-none " +
        "data-[active=true]:border-neutral-900 data-[active=true]:ring-2 data-[active=true]:ring-neutral-900/20 " +
        "dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:data-[active=true]:border-neutral-100 dark:data-[active=true]:ring-neutral-100/30 " +
        className
      }
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-6 w-px animate-pulse bg-neutral-900 dark:bg-white" />
        </div>
      )}
    </div>
  );
}
