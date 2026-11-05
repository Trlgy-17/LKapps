CREATE TABLE "halaman_lembar" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lembar_kerja_id" uuid NOT NULL,
	"nomor" integer NOT NULL,
	"kunci_thumb" text NOT NULL,
	"kunci_besar" text NOT NULL,
	"lebar_px" integer NOT NULL,
	"tinggi_px" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jenis" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'antre' NOT NULL,
	"progres" integer DEFAULT 0 NOT NULL,
	"total" integer,
	"galat" text,
	"dibuat" timestamp with time zone DEFAULT now() NOT NULL,
	"mulai" timestamp with time zone,
	"selesai" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "lembar_kerja" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proyek_id" uuid NOT NULL,
	"versi" integer DEFAULT 1 NOT NULL,
	"nama_file" text NOT NULL,
	"ukuran_byte" integer NOT NULL,
	"kunci_file" text NOT NULL,
	"halaman" integer,
	"status" text DEFAULT 'diunggah' NOT NULL,
	"galat" text,
	"dibuat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proyek" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"brand_id" uuid,
	"klien" text DEFAULT '' NOT NULL,
	"lokasi" text DEFAULT '' NOT NULL,
	"pekerjaan" text DEFAULT '' NOT NULL,
	"surveyor" text DEFAULT '' NOT NULL,
	"tanggal_gambar" text,
	"status" text DEFAULT 'draf' NOT NULL,
	"dibuat_oleh" uuid,
	"dibuat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "halaman_lembar" ADD CONSTRAINT "halaman_lembar_lembar_kerja_id_lembar_kerja_id_fk" FOREIGN KEY ("lembar_kerja_id") REFERENCES "public"."lembar_kerja"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lembar_kerja" ADD CONSTRAINT "lembar_kerja_proyek_id_proyek_id_fk" FOREIGN KEY ("proyek_id") REFERENCES "public"."proyek"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proyek" ADD CONSTRAINT "proyek_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proyek" ADD CONSTRAINT "proyek_brand_id_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proyek" ADD CONSTRAINT "proyek_dibuat_oleh_pengguna_id_fk" FOREIGN KEY ("dibuat_oleh") REFERENCES "public"."pengguna"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "halaman_uq" ON "halaman_lembar" USING btree ("lembar_kerja_id","nomor");--> statement-breakpoint
CREATE INDEX "job_status_idx" ON "job" USING btree ("status","dibuat");--> statement-breakpoint
CREATE INDEX "proyek_ws_idx" ON "proyek" USING btree ("workspace_id");