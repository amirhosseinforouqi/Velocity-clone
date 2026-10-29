CREATE TYPE "public"."aml_risk" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."compliance_status" AS ENUM('in_progress', 'non_compliant', 'compliant');--> statement-breakpoint
CREATE TYPE "public"."sanction_screening" AS ENUM('not_screened', 'clear', 'possible_match');--> statement-breakpoint
CREATE TABLE "aml_assessments" (
	"deal_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"answers" jsonb NOT NULL,
	"risk" "aml_risk" NOT NULL,
	"screening" "sanction_screening" DEFAULT 'not_screened' NOT NULL,
	"screening_list" text DEFAULT '' NOT NULL,
	"screened_on" date,
	"assessed_by" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "aml_assessments_deal_id_contact_id_pk" PRIMARY KEY("deal_id","contact_id")
);
--> statement-breakpoint
CREATE TABLE "compliance_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"status" "compliance_status" NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"locked" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "compliance_status" "compliance_status" DEFAULT 'in_progress' NOT NULL;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "package_locked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "aml_assessments" ADD CONSTRAINT "aml_assessments_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aml_assessments" ADD CONSTRAINT "aml_assessments_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aml_assessments" ADD CONSTRAINT "aml_assessments_assessed_by_users_id_fk" FOREIGN KEY ("assessed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_reviews" ADD CONSTRAINT "compliance_reviews_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_reviews" ADD CONSTRAINT "compliance_reviews_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "compliance_reviews_deal_idx" ON "compliance_reviews" USING btree ("deal_id");