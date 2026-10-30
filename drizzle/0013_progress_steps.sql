CREATE TABLE "deal_steps" (
	"deal_id" uuid NOT NULL,
	"step_id" uuid NOT NULL,
	"completed_on" date NOT NULL,
	"completed_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deal_steps_deal_id_step_id_pk" PRIMARY KEY("deal_id","step_id")
);
--> statement-breakpoint
CREATE TABLE "progress_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"deal_type" text NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"days" integer DEFAULT 0 NOT NULL,
	"milestone" boolean DEFAULT false NOT NULL,
	"todos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"auto_message" text DEFAULT '' NOT NULL,
	"prerequisite_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "step_id" uuid;--> statement-breakpoint
ALTER TABLE "deal_steps" ADD CONSTRAINT "deal_steps_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_steps" ADD CONSTRAINT "deal_steps_step_id_progress_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."progress_steps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_steps" ADD CONSTRAINT "deal_steps_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_steps" ADD CONSTRAINT "progress_steps_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_steps" ADD CONSTRAINT "progress_steps_prerequisite_id_progress_steps_id_fk" FOREIGN KEY ("prerequisite_id") REFERENCES "public"."progress_steps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "progress_steps_org_type_idx" ON "progress_steps" USING btree ("organization_id","deal_type","position");--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_step_id_progress_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."progress_steps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_steps" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON "progress_steps" FROM anon, authenticated;--> statement-breakpoint
ALTER TABLE "deal_steps" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON "deal_steps" FROM anon, authenticated;
