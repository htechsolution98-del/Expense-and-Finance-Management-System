-- Migration: Add OTP fields to users table for Forgot Password feature
-- Created: 2026-08-21

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "otp_code" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "otp_expires" TIMESTAMP(3);
