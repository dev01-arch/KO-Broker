import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes with proper precedence.
 * Used throughout the component library.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
