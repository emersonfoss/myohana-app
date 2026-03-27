/**
 * Simple HTML tag stripper for defense-in-depth input sanitization.
 * Removes HTML tags from string values in request bodies.
 */

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, "");
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    return stripTags(value);
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value !== null && typeof value === "object") {
    return sanitizeObject(value as Record<string, unknown>);
  }
  return value;
}

function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    result[key] = sanitizeValue(val);
  }
  return result;
}

import type { Request, Response, NextFunction } from "express";

/**
 * Express middleware that sanitizes HTML tags from all string values
 * in request bodies for POST/PUT/PATCH requests.
 */
export function sanitizeInputMiddleware(req: Request, _res: Response, next: NextFunction) {
  if (["POST", "PUT", "PATCH"].includes(req.method) && req.body && typeof req.body === "object") {
    req.body = sanitizeObject(req.body);
  }
  next();
}
