/**
 * Shared Framer Motion animation variants for BuildMart.
 * Import these instead of redefining per-page.
 */
import type { Variants } from 'framer-motion';

const ease = [0.25, 0.46, 0.45, 0.94] as [number, number, number, number];

/** Whole-page container fade-in */
export const pageVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.5, staggerChildren: 0.08 } },
};

/** Single-page entrance: fade + slight upward slide */
export const pageEnter: Variants = {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease } },
};

/** Fade-up entrance for individual elements */
export const fadeUp: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease } },
};

/** Slide from right */
export const slideRight: Variants = {
    hidden: { opacity: 0, x: 40 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease } },
};

/** Slide from left */
export const slideLeft: Variants = {
    hidden: { opacity: 0, x: -40 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease } },
};

/** Scale-in for modals/cards */
export const scaleIn: Variants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.3, ease } },
};

/** Stagger container for grids/lists */
export const staggerContainer: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
};

/** Stagger item — used inside staggerContainer */
export const staggerItem: Variants = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease } },
};

/** Standard viewport trigger config for whileInView */
export const viewportOnce = { once: true, margin: '-80px' as const };
