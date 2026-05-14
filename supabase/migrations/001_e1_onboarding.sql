-- E1 onboarding: users (Clerk), onboarding_profiles, roadmaps

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  username TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE onboarding_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  target_role TEXT NOT NULL CHECK (target_role IN (
    'ai_product_manager', 'ai_generalist', 'ai_engineer',
    'ai_marketer', 'ai_operator', 'ai_native_founder', 'other'
  )),
  current_role TEXT,
  years_of_experience TEXT CHECK (years_of_experience IN ('0-1','1-3','3-7','7-12','12+')),
  ai_fluency TEXT CHECK (ai_fluency IN (
    'not_started','played_with_chatgpt','built_workflows',
    'shipped_projects','working_in_ai'
  )),
  resume_text TEXT,
  resume_url TEXT,
  resume_parsed JSONB,
  onboarding_completed_at TIMESTAMPTZ,
  onboarding_step INT DEFAULT 1,
  referral_source TEXT,
  referral_utm JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE roadmaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  onboarding_profile_id UUID REFERENCES onboarding_profiles(id),
  version INT DEFAULT 1,
  content JSONB NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  is_current BOOLEAN DEFAULT TRUE,
  generation_model TEXT,
  generation_prompt_version TEXT
);

CREATE INDEX idx_onboarding_profiles_user_id ON onboarding_profiles(user_id);
CREATE INDEX idx_roadmaps_user_id_current ON roadmaps(user_id) WHERE is_current = TRUE;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_data" ON users FOR ALL USING (clerk_id = auth.uid()::text);
CREATE POLICY "profiles_own_data" ON onboarding_profiles FOR ALL
  USING (user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::text));
CREATE POLICY "roadmaps_own_data" ON roadmaps FOR ALL
  USING (user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::text));
