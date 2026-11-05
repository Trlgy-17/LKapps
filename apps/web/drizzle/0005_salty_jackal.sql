CREATE TABLE "estimasi" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proyek_id" uuid NOT NULL,
	"lembar_kerja_id" uuid NOT NULL,
	"versi" integer NOT NULL,
	"rule_set_id" uuid,
	"rule_set_versi" integer,
	"status" text DEFAULT 'draf' NOT NULL,
	"masukan" jsonb NOT NULL,
	"hasil" jsonb NOT NULL,
	"dibuat" timestamp with time zone DEFAULT now() NOT NULL,
	"dibuat_oleh" uuid
);
--> statement-breakpoint
ALTER TABLE "estimasi" ADD CONSTRAINT "estimasi_proyek_id_proyek_id_fk" FOREIGN KEY ("proyek_id") REFERENCES "public"."proyek"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimasi" ADD CONSTRAINT "estimasi_lembar_kerja_id_lembar_kerja_id_fk" FOREIGN KEY ("lembar_kerja_id") REFERENCES "public"."lembar_kerja"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimasi" ADD CONSTRAINT "estimasi_rule_set_id_rule_set_id_fk" FOREIGN KEY ("rule_set_id") REFERENCES "public"."rule_set"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimasi" ADD CONSTRAINT "estimasi_dibuat_oleh_pengguna_id_fk" FOREIGN KEY ("dibuat_oleh") REFERENCES "public"."pengguna"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "estimasi_versi_uq" ON "estimasi" USING btree ("proyek_id","versi");