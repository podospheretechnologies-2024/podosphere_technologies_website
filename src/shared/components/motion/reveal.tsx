'use client';

import { motion, type HTMLMotionProps } from 'motion/react';

const ease = [0.22, 1, 0.36, 1] as const;

/** Fades + lifts content in when it scrolls into view (once). */
export function Reveal({
  delay = 0,
  y = 24,
  ...props
}: HTMLMotionProps<'div'> & { delay?: number; y?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, ease, delay }}
      {...props}
    />
  );
}

/** Staggers its <StaggerItem> children when in view. */
export function Stagger({ gap = 0.08, ...props }: HTMLMotionProps<'div'> & { gap?: number }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: gap } } }}
      {...props}
    />
  );
}

export function StaggerItem(props: HTMLMotionProps<'div'>) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { duration: 0.6, ease } },
      }}
      {...props}
    />
  );
}

/** Quick fade for dashboard page transitions. */
export function PageFade(props: HTMLMotionProps<'div'>) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease }}
      {...props}
    />
  );
}
