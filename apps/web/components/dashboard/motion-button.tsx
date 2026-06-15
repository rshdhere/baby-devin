"use client";

import { forwardRef } from "react";
import { motion, type HTMLMotionProps } from "motion/react";

const pressTransition = {
  type: "tween" as const,
  duration: 0.22,
  ease: "easeInOut" as const,
};

const pressScale = {
  default: 0.985,
  icon: 0.93,
  primary: 0.965,
} as const;

type PressStyle = keyof typeof pressScale;

export type MotionButtonProps = Omit<HTMLMotionProps<"button">, "ref"> & {
  pressStyle?: PressStyle;
};

export const MotionButton = forwardRef<HTMLButtonElement, MotionButtonProps>(
  (
    { pressStyle = "default", disabled, type = "button", children, ...props },
    ref,
  ) => {
    return (
      <motion.button
        ref={ref}
        type={type}
        disabled={disabled}
        whileTap={disabled ? undefined : { scale: pressScale[pressStyle] }}
        transition={pressTransition}
        {...props}
      >
        {children}
      </motion.button>
    );
  },
);

MotionButton.displayName = "MotionButton";
