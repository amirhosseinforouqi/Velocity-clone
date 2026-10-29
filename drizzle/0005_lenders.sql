CREATE TABLE "lender_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lender_id" uuid NOT NULL,
	"name" text NOT NULL,
	"term" integer NOT NULL,
	"fees" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lenders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"code" text DEFAULT '' NOT NULL,
	"display_as" text NOT NULL,
	"underwriter_type" text DEFAULT 'Internal' NOT NULL,
	"underwriters" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"default_underwriter" text DEFAULT '' NOT NULL,
	"fees" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"limits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"all_agents" boolean DEFAULT true NOT NULL,
	"agent_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"hidden_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lender_products" ADD CONSTRAINT "lender_products_lender_id_lenders_id_fk" FOREIGN KEY ("lender_id") REFERENCES "public"."lenders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lenders" ADD CONSTRAINT "lenders_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lender_products_name_uq" ON "lender_products" USING btree ("lender_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "lenders_org_name_uq" ON "lenders" USING btree ("organization_id","name");