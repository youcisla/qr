CREATE TYPE "public"."qr_status" AS ENUM('active', 'paused', 'archived');--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "scan_events" (
	"id" text PRIMARY KEY NOT NULL,
	"qr_code_id" text NOT NULL,
	"scanned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"country" text,
	"region" text,
	"city" text,
	"device_type" text,
	"os" text,
	"browser" text,
	"referer" text,
	"user_agent" text,
	"ip_hash" text,
	"visitor_hash" text,
	"is_unique" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "qr_styles" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "qr_styles" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "qr_styles" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "qr_styles" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "qr_codes" ALTER COLUMN "destination_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "qr_codes" ALTER COLUMN "last_scanned_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "qr_codes" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "qr_codes" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "qr_codes" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "qr_codes" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "qr_styles" ADD COLUMN "design" jsonb;--> statement-breakpoint
-- Backfill the new design document from the legacy color/pattern columns before they are dropped.
UPDATE "qr_styles"
SET "design" = jsonb_build_object(
  'version', 1,
  'dotStyle', CASE "pattern"
    WHEN 'dot' THEN 'dots'
    WHEN 'rounded' THEN 'rounded'
    ELSE 'square'
  END,
  'moduleGap', 0,
  'eyeFrameStyle', CASE "corner_style"
    WHEN 'rounded' THEN 'rounded'
    WHEN 'extra-rounded' THEN 'circle'
    ELSE 'square'
  END,
  'eyeBallStyle', CASE "corner_style"
    WHEN 'rounded' THEN 'rounded'
    WHEN 'extra-rounded' THEN 'rounded'
    ELSE 'square'
  END,
  'foreground', jsonb_build_object('type', 'solid', 'color', "foreground_color"),
  'background', jsonb_build_object('type', 'solid', 'color', "background_color"),
  'eyeFrameColor', NULL,
  'eyeBallColor', NULL,
  'quietZone', 4,
  'errorCorrection', 'M',
  'transparentBackground', false,
  'logo', CASE
    WHEN "logo_data_url" IS NULL THEN NULL
    ELSE jsonb_build_object(
      'src', "logo_data_url",
      'size', 0.2,
      'padding', 0.06,
      'radius', 0.12,
      'backgroundColor', '#ffffff',
      'clearModules', true
    )
  END,
  'frame', NULL
);--> statement-breakpoint
ALTER TABLE "qr_styles" ALTER COLUMN "design" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "qr_codes" ADD COLUMN "content_type" text DEFAULT 'url' NOT NULL;--> statement-breakpoint
ALTER TABLE "qr_codes" ADD COLUMN "content_data" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "qr_codes" ADD COLUMN "encoded_data" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "qr_codes" ADD COLUMN "status" "qr_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "qr_codes" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "qr_codes" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "qr_codes" ADD COLUMN "tags" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "qr_codes" ADD COLUMN "unique_scan_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Preserve the legacy payload so existing static codes keep a valid encoded target.
UPDATE "qr_codes"
SET "encoded_data" = COALESCE("destination_url", '')
WHERE "encoded_data" = '' AND "destination_url" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "scan_events" ADD CONSTRAINT "scan_events_qr_code_id_qr_codes_id_fk" FOREIGN KEY ("qr_code_id") REFERENCES "public"."qr_codes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_keys_user_id_idx" ON "api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "scan_events_qr_code_scanned_at_idx" ON "scan_events" USING btree ("qr_code_id","scanned_at");--> statement-breakpoint
ALTER TABLE "qr_styles" DROP COLUMN "foreground_color";--> statement-breakpoint
ALTER TABLE "qr_styles" DROP COLUMN "background_color";--> statement-breakpoint
ALTER TABLE "qr_styles" DROP COLUMN "pattern";--> statement-breakpoint
ALTER TABLE "qr_styles" DROP COLUMN "corner_style";--> statement-breakpoint
ALTER TABLE "qr_styles" DROP COLUMN "logo_data_url";--> statement-breakpoint
ALTER TABLE "qr_styles" ADD CONSTRAINT "qr_styles_qr_code_id_unique" UNIQUE("qr_code_id");--> statement-breakpoint
DROP TYPE "public"."corner_style";--> statement-breakpoint
DROP TYPE "public"."pattern";