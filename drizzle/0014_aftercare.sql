CREATE TABLE "aftercare" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"deal_id" uuid NOT NULL,
	"label" text NOT NULL,
	"next_date" date NOT NULL,
	"period_months" integer DEFAULT 12 NOT NULL,
	"max_times" integer DEFAULT 0 NOT NULL,
	"times_done" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "aftercare" ADD CONSTRAINT "aftercare_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aftercare" ADD CONSTRAINT "aftercare_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aftercare" ADD CONSTRAINT "aftercare_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "aftercare_deal_idx" ON "aftercare" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "aftercare_due_idx" ON "aftercare" USING btree ("organization_id","active","next_date");--> statement-breakpoint
ALTER TABLE "aftercare" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON "aftercare" FROM anon, authenticated;