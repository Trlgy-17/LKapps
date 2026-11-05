CREATE TABLE "data_real" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proyek_id" uuid NOT NULL,
	"versi" integer NOT NULL,
	"teks" text NOT NULL,
	"basis" text NOT NULL,
	"estimasi_id" uuid,
	"hasil" jsonb NOT NULL,
	"dibuat" timestamp with time zone DEFAULT now() NOT NULL,
	"dibuat_oleh" uuid
);
--> statement-breakpoint
ALTER TABLE "data_real" ADD CONSTRAINT "data_real_proyek_id_proyek_id_fk" FOREIGN KEY ("proyek_id") REFERENCES "public"."proyek"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_real" ADD CONSTRAINT "data_real_estimasi_id_estimasi_id_fk" FOREIGN KEY ("estimasi_id") REFERENCES "public"."estimasi"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_real" ADD CONSTRAINT "data_real_dibuat_oleh_pengguna_id_fk" FOREIGN KEY ("dibuat_oleh") REFERENCES "public"."pengguna"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "data_real_versi_uq" ON "data_real" USING btree ("proyek_id","versi");