"use client";

import * as React from "react";
import { cn } from "./utils";

interface SwitchProps {
  className?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  name?: string;
  value?: string;
  id?: string;
}

function Switch({
  className,
  checked: controlledChecked,
  defaultChecked = false,
  onCheckedChange,
  disabled = false,
  name,
  value,
  id,
  ...props
}: SwitchProps) {
  const [internalChecked, setInternalChecked] = React.useState(defaultChecked);
  
  const isChecked = controlledChecked !== undefined ? controlledChecked : internalChecked;

  const handleToggle = () => {
    if (disabled) return;
    
    const newChecked = !isChecked;
    setInternalChecked(newChecked);
    onCheckedChange?.(newChecked);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      handleToggle();
    }
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isChecked}
      data-state={isChecked ? "checked" : "unchecked"}
      data-slot="switch"
      disabled={disabled}
      className={cn(
        "peer inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent transition-all outline-none",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        isChecked ? "bg-primary" : "bg-switch-background dark:bg-input/80",
        className
      )}
      onClick={handleToggle}
      onKeyDown={handleKeyDown}
      id={id}
      {...props}
    >
      <input
        type="checkbox"
        name={name}
        value={value}
        checked={isChecked}
        onChange={() => {}}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />
      <span
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-4 rounded-full ring-0 transition-transform",
          "bg-card dark:bg-card-foreground",
          isChecked
            ? "translate-x-[calc(100%-2px)] dark:bg-primary-foreground"
            : "translate-x-0"
        )}
      />
    </button>
  );
}

export { Switch };
