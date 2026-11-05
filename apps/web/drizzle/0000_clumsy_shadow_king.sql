CREATE TABLE "aturan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_set_id" uuid NOT NULL,
	"kategori" text NOT NULL,
	"kunci" text NOT NULL,
	"nama" text NOT NULL,
	"isi" text NOT NULL,
	"sumber" text NOT NULL,
	"keyakinan" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"waktu" timestamp with time zone DEFAULT now() NOT NULL,
	"pengguna_id" uuid,
	"entitas" text NOT NULL,
	"entitas_id" text NOT NULL,
	"aksi" text NOT NULL,
	"nilai_lama" jsonb,
	"nilai_baru" jsonb
);
--> statement-breakpoint
CREATE TABLE "brand" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"nama" text NOT NULL,
	"logo_url" text,
	"warna" text
);
--> statement-breakpoint
CREATE TABLE "material" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"brand_id" uuid,
	"nama" text NOT NULL,
	"lembar_lebar" text DEFAULT '1220' NOT NULL,
	"lembar_panjang" text DEFAULT '2440' NOT NULL,
	"tebal" text,
	"satuan" text DEFAULT 'lembar' NOT NULL,
	"serat_tetap" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "material_alias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"material_id" uuid NOT NULL,
	"alias" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pengguna" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"nama" text NOT NULL,
	"email" text NOT NULL,
	"kata_sandi" text NOT NULL,
	"peran" text NOT NULL,
	"aktif" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rule_set" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"versi" integer NOT NULL,
	"status" text DEFAULT 'draf' NOT NULL,
	"penyetuju_id" uuid,
	"dibuat" timestamp with time zone DEFAULT now() NOT NULL,
	"disetujui" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "workspace" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nama" text NOT NULL,
	"pengaturan" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "aturan" ADD CONSTRAINT "aturan_rule_set_id_rule_set_id_fk" FOREIGN KEY ("rule_set_id") REFERENCES "public"."rule_set"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_pengguna_id_pengguna_id_fk" FOREIGN KEY ("pengguna_id") REFERENCES "public"."pengguna"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand" ADD CONSTRAINT "brand_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material" ADD CONSTRAINT "material_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material" ADD CONSTRAINT "material_brand_id_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_alias" ADD CONSTRAINT "material_alias_material_id_material_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."material"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pengguna" ADD CONSTRAINT "pengguna_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_set" ADD CONSTRAINT "rule_set_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_set" ADD CONSTRAINT "rule_set_penyetuju_id_pengguna_id_fk" FOREIGN KEY ("penyetuju_id") REFERENCES "public"."pengguna"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "aturan_kunci_uq" ON "aturan" USING btree ("rule_set_id","kategori","kunci");--> statement-breakpoint
CREATE INDEX "aturan_set_idx" ON "aturan" USING btree ("rule_set_id");--> statement-breakpoint
CREATE INDEX "audit_entitas_idx" ON "audit_log" USING btree ("entitas","entitas_id");--> statement-breakpoint
CREATE UNIQUE INDEX "material_nama_uq" ON "material" USING btree ("workspace_id",lower("nama"));--> statement-breakpoint
CREATE UNIQUE INDEX "material_alias_uq" ON "material_alias" USING btree (lower("alias"));--> statement-breakpoint
CREATE UNIQUE INDEX "pengguna_email_uq" ON "pengguna" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "rule_set_versi_uq" ON "rule_set" USING btree ("workspace_id","versi");