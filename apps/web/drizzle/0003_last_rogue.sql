ALTER TABLE "halaman_lembar" ADD COLUMN "lembar_tercetak" text;--> statement-breakpoint
ALTER TABLE "unit_terbaca" ADD COLUMN "halaman_semua" jsonb DEFAULT '[]'::jsonb NOT NULL;