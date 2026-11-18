CREATE TABLE "login_failures" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"until" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "login_failures" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON "login_failures" FROM anon, authenticated;