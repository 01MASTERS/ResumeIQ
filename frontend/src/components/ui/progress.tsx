"use client"

import { Progress as ProgressPrimitive } from "@base-ui/react/progress"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"

export interface ProgressProps extends ProgressPrimitive.Root.Props {
  indicatorClassName?: string;
}

function Progress({
  className,
  indicatorClassName,
  children,
  value,
  ...props
}: ProgressProps) {
  return (
    <ProgressPrimitive.Root
      value={value}
      data-slot="progress"
      className="w-full"
      {...props}
    >
      {children}
      <ProgressTrack className={className}>
        <ProgressIndicator className={indicatorClassName} value={value as number} />
      </ProgressTrack>
    </ProgressPrimitive.Root>
  )
}

function ProgressTrack({ className, ...props }: ProgressPrimitive.Track.Props) {
  return (
    <ProgressPrimitive.Track
      className={cn(
        "relative flex h-1.5 w-full items-center overflow-hidden rounded-full bg-white/[0.06]",
        className
      )}
      data-slot="progress-track"
      {...props}
    />
  )
}

const MotionIndicator = motion(ProgressPrimitive.Indicator as any);

function ProgressIndicator({
  className,
  value,
  ...props
}: ProgressPrimitive.Indicator.Props & { value?: number }) {
  return (
    <MotionIndicator
      data-slot="progress-indicator"
      className={cn("h-full rounded-full bg-gradient-to-r from-primary to-accent", className)}
      initial={{ width: 0 }}
      whileInView={{ width: `${value || 0}%` }}
      viewport={{ once: true }}
      transition={{ duration: 1, ease: "easeOut" }}
      {...props}
    />
  )
}

function ProgressLabel({ className, ...props }: ProgressPrimitive.Label.Props) {
  return (
    <ProgressPrimitive.Label
      className={cn("text-sm font-medium", className)}
      data-slot="progress-label"
      {...props}
    />
  )
}

function ProgressValue({ className, ...props }: ProgressPrimitive.Value.Props) {
  return (
    <ProgressPrimitive.Value
      className={cn(
        "ml-auto text-sm text-muted-foreground tabular-nums",
        className
      )}
      data-slot="progress-value"
      {...props}
    />
  )
}

export {
  Progress,
  ProgressTrack,
  ProgressIndicator,
  ProgressLabel,
  ProgressValue,
}
