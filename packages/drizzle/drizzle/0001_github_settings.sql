-- GitHub integration settings for user dashboard
ALTER TABLE "user_dashboard_settings"
  ADD COLUMN IF NOT EXISTS "selected_repository" text,
  ADD COLUMN IF NOT EXISTS "github_can_commit" boolean DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS "github_can_create_pr" boolean DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS "github_can_push" boolean DEFAULT true NOT NULL;

ALTER TABLE "user_dashboard_settings"
  ALTER COLUMN "repository_label" SET DEFAULT 'No repository selected';
