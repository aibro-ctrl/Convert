"use client";

import * as React from "react";
import { CheckIcon } from "./icons";
import { cn } from "./utils";

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  onCheckedChange?: (checked: boolean) => void;
}

function Checkbox({
  className,
  checked,
  defaultChecked,
  onCheckedChange,
  onChange,
  disabled,
  ...props
}: CheckboxProps) {
  const [isChecked, setIsChecked] = React.useState(defaultChecked || false);
  const isControlled = checked !== undefined;
  const checkedState = isControlled ? checked : isChecked;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newChecked = e.target.checked;
    
    if (!isControlled) {
      setIsChecked(newChecked);
    }
    
    onCheckedChange?.(newChecked);
    onChange?.(e);
  };

  const handleDivClick = (e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    const newChecked = !checkedState;
    if (!isControlled) {
      setIsChecked(newChecked);
    }
    onCheckedChange?.(newChecked);
  };

  return (
    <div className="relative inline-flex items-center justify-center">
      <input
        type="checkbox"
        className="sr-only peer"
        checked={checkedState}
        onChange={handleChange}
        disabled={disabled}
        {...props}
      />
      <div
        data-slot="checkbox"
        data-state={checkedState ? "checked" : "unchecked"}
        onClick={handleDivClick}
        role="checkbox"
        aria-checked={checkedState}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
            e.preventDefault();
            const newChecked = !checkedState;
            if (!isControlled) {
              setIsChecked(newChecked);
            }
            onCheckedChange?.(newChecked);
          }
        }}
        className={cn(
          "peer border bg-input-background dark:bg-input/30 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:data-[state=checked]:bg-primary data-[state=checked]:border-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive size-4 shrink-0 rounded-[4px] border shadow-xs transition-shadow outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
          "flex items-center justify-center cursor-pointer",
          disabled && "opacity-50 cursor-not-allowed",
          className,
        )}
      >
        {checkedState && (
          <div
            data-slot="checkbox-indicator"
            className="flex items-center justify-center text-current transition-none"
          >
            <CheckIcon className="size-3.5" />
          </div>
        )}
      </div>
    </div>
  );
}

export { Checkbox };
