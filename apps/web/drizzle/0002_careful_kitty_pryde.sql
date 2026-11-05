CREATE TABLE "bidang_terbaca" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lembar_kerja_id" uuid NOT NULL,
	"halaman" integer NOT NULL,
	"jenis" text NOT NULL,
	"kunci" text NOT NULL,
	"nilai" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text NOT NULL,
	"keyakinan" integer NOT NULL,
	"posisi" jsonb,
	"unit_nama" text
);
--> statement-breakpoint
CREATE TABLE "konflik" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lembar_kerja_id" uuid NOT NULL,
	"jenis" text NOT NULL,
	"item" text NOT NULL,
	"deskripsi" text NOT NULL,
	"opsi" jsonb NOT NULL,
	"jawaban" jsonb,
	"dijawab_oleh" uuid,
	"dijawab_pada" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "unit_terbaca" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lembar_kerja_id" uuid NOT NULL,
	"nama" text NOT NULL,
	"jenis" text NOT NULL,
	"bahan_utama" text,
	"halaman" integer NOT NULL,
	"posisi" jsonb
);
--> statement-breakpoint
ALTER TABLE "lembar_kerja" ADD COLUMN "tahap" text DEFAULT 'render' NOT NULL;--> statement-breakpoint
ALTER TABLE "lembar_kerja" ADD COLUMN "halaman_dibaca" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "bidang_terbaca" ADD CONSTRAINT "bidang_terbaca_lembar_kerja_id_lembar_kerja_id_fk" FOREIGN KEY ("lembar_kerja_id") REFERENCES "public"."lembar_kerja"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "konflik" ADD CONSTRAINT "konflik_lembar_kerja_id_lembar_kerja_id_fk" FOREIGN KEY ("lembar_kerja_id") REFERENCES "public"."lembar_kerja"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "konflik" ADD CONSTRAINT "konflik_dijawab_oleh_pengguna_id_fk" FOREIGN KEY ("dijawab_oleh") REFERENCES "public"."pengguna"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_terbaca" ADD CONSTRAINT "unit_terbaca_lembar_kerja_id_lembar_kerja_id_fk" FOREIGN KEY ("lembar_kerja_id") REFERENCES "public"."lembar_kerja"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bidang_lk_idx" ON "bidang_terbaca" USING btree ("lembar_kerja_id","jenis");--> statement-breakpoint
CREATE INDEX "konflik_lk_idx" ON "konflik" USING btree ("lembar_kerja_id");--> statement-breakpoint
CREATE INDEX "unit_lk_idx" ON "unit_terbaca" USING btree ("lembar_kerja_id");