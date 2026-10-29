ALTER TABLE "client_invitations" ALTER COLUMN "token_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "password_expires_at" timestamp with time zone;