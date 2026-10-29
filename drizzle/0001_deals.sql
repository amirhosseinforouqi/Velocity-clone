CREATE TYPE "public"."deal_status" AS ENUM('lead', 'pre_approval', 'new_deal', 'submitted', 'approved', 'accepted', 'waiting_to_close', 'funded', 'declined', 'cancelled', 'parked', 'complete');--> statement-breakpoint
CREATE TABLE "deal_borrowers" (
	"deal_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "deal_borrowers_deal_id_contact_id_pk" PRIMARY KEY("deal_id","contact_id")
);
--> statement-breakpoint
CREATE TABLE "deal_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"from" "deal_status",
	"to" "deal_status" NOT NULL,
	"actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" integer GENERATED ALWAYS AS IDENTITY (sequence name "deals_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 100001 CACHE 1),
	"organization_id" uuid NOT NULL,
	"office_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"status" "deal_status" NOT NULL,
	"previous_status" "deal_status",
	"purpose" text,
	"amount" integer,
	"closing_date" date,
	"conditions_date" date,
	"follow_up_date" date,
	"submitted_date" date,
	"fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "deals_number_unique" UNIQUE("number")
);
--> statement-breakpoint
ALTER TABLE "deal_borrowers" ADD CONSTRAINT "deal_borrowers_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_borrowers" ADD CONSTRAINT "deal_borrowers_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_status_history" ADD CONSTRAINT "deal_status_history_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_status_history" ADD CONSTRAINT "deal_status_history_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deal_status_history_deal_idx" ON "deal_status_history" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "deals_scope_idx" ON "deals" USING btree ("organization_id","office_id","agent_id");