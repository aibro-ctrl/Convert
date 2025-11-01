"use client";

import * as React from "react";
import { cn } from "./utils";

interface SliderProps {
  className?: string;
  defaultValue?: number[];
  value?: number[];
  min?: number;
  max?: number;
  step?: number;
  onValueChange?: (value: number[]) => void;
  disabled?: boolean;
  orientation?: "horizontal" | "vertical";
}

function Slider({
  className,
  defaultValue = [0],
  value,
  min = 0,
  max = 100,
  step = 1,
  onValueChange,
  disabled = false,
  orientation = "horizontal",
}: SliderProps) {
  const [internalValue, setInternalValue] = React.useState(value || defaultValue);
  const sliderRef = React.useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  const currentValue = value !== undefined ? value : internalValue;

  const updateValue = React.useCallback(
    (clientX: number, clientY: number) => {
      if (!sliderRef.current || disabled) return;

      const rect = sliderRef.current.getBoundingClientRect();
      let percentage: number;

      if (orientation === "horizontal") {
        percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      } else {
        percentage = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));
      }

      const range = max - min;
      const rawValue = min + percentage * range;
      const steppedValue = Math.round(rawValue / step) * step;
      const clampedValue = Math.max(min, Math.min(max, steppedValue));

      const newValue = [clampedValue];
      setInternalValue(newValue);
      onValueChange?.(newValue);
    },
    [min, max, step, disabled, orientation, onValueChange]
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    setIsDragging(true);
    updateValue(e.clientX, e.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;
    setIsDragging(true);
    const touch = e.touches[0];
    updateValue(touch.clientX, touch.clientY);
  };

  React.useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      updateValue(e.clientX, e.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      updateValue(touch.clientX, touch.clientY);
    };

    const handleEnd = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("touchmove", handleTouchMove);
    document.addEventListener("mouseup", handleEnd);
    document.addEventListener("touchend", handleEnd);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("mouseup", handleEnd);
      document.removeEventListener("touchend", handleEnd);
    };
  }, [isDragging, updateValue]);

  const percentage = ((currentValue[0] - min) / (max - min)) * 100;

  return (
    <div
      ref={sliderRef}
      data-slot="slider"
      className={cn(
        "relative flex w-full touch-none items-center select-none",
        disabled && "opacity-50 cursor-not-allowed",
        orientation === "vertical" && "h-full min-h-44 w-auto flex-col",
        className
      )}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      <div
        data-slot="slider-track"
        className={cn(
          "bg-muted relative grow overflow-hidden rounded-full",
          orientation === "horizontal" ? "h-4 w-full" : "h-full w-1.5"
        )}
      >
        <div
          data-slot="slider-range"
          className={cn(
            "bg-primary absolute",
            orientation === "horizontal" ? "h-full" : "w-full bottom-0"
          )}
          style={
            orientation === "horizontal"
              ? { width: `${percentage}%` }
              : { height: `${percentage}%` }
          }
        />
      </div>
      <div
        data-slot="slider-thumb"
        className="border-primary bg-background ring-ring/50 absolute block size-4 shrink-0 rounded-full border shadow-sm transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
        style={
          orientation === "horizontal"
            ? { left: `calc(${percentage}% - 0.5rem)` }
            : { bottom: `calc(${percentage}% - 0.5rem)` }
        }
      />
    </div>
  );
}

export { Slider };
