import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 10;

/** Production password rules — enforced on signup and password change. */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(72, "Password must be at most 72 characters")
  .regex(/[a-z]/, "Password must include a lowercase letter")
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/[0-9]/, "Password must include a number")
  .regex(/[^a-zA-Z0-9]/, "Password must include a special character");

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address")
  .max(255);

export const displayNameSchema = z
  .string()
  .trim()
  .min(2, "Display name must be at least 2 characters")
  .max(60, "Display name must be at most 60 characters");

export const otpSchema = z
  .string()
  .trim()
  .length(6, "Enter the 6-digit verification code")
  .regex(/^\d{6}$/, "Verification code must be 6 digits");
