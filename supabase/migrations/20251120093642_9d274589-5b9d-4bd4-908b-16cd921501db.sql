-- Create reels table
CREATE TABLE IF NOT EXISTS public.reels (
    id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    shortcode text,
    ownerusername text,
    ownerfullname text,
    ownerid text,
    caption text,
    likescount integer DEFAULT 0,
    commentscount integer DEFAULT 0,
    videoviewcount integer DEFAULT 0,
    videoplaycount integer DEFAULT 0,
    videowatchcount integer DEFAULT 0,
    repostcount integer DEFAULT 0,
    payout numeric(10,2) DEFAULT 0.00,
    sentcount integer DEFAULT 0,
    sharecount integer DEFAULT 0,
    locationname text,
    timestamp timestamptz,
    takenat timestamptz,
    lastupdatedat timestamptz,
    publishedtime timestamptz,
    displayurl text,
    videourl text,
    thumbnailurl text,
    audioname text,
    audiourl text,
    producttype text,
    url text,
    permalink text,
    inputurl text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    created_by_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    created_by_email text,
    created_by_name text
);

-- Enable RLS
ALTER TABLE public.reels ENABLE ROW LEVEL SECURITY;

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text,
    full_name text,
    avatar_url text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

-- Reels policies - users can view their own reels
CREATE POLICY "Users can view own reels"
    ON public.reels FOR SELECT
    TO authenticated
    USING (created_by_user_id = auth.uid());

-- Reels policies - users can view all team reels
CREATE POLICY "Users can view all team reels"
    ON public.reels FOR SELECT
    TO authenticated
    USING (true);

-- Users can insert their own reels
CREATE POLICY "Users can insert own reels"
    ON public.reels FOR INSERT
    TO authenticated
    WITH CHECK (created_by_user_id = auth.uid());

-- Users can update their own reels
CREATE POLICY "Users can update own reels"
    ON public.reels FOR UPDATE
    TO authenticated
    USING (created_by_user_id = auth.uid())
    WITH CHECK (created_by_user_id = auth.uid());

-- Users can delete their own reels
CREATE POLICY "Users can delete own reels"
    ON public.reels FOR DELETE
    TO authenticated
    USING (created_by_user_id = auth.uid());

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'full_name', new.email)
    );
    RETURN new;
END;
$$;

-- Trigger to create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for reels updated_at
CREATE TRIGGER update_reels_updated_at
    BEFORE UPDATE ON public.reels
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for profiles updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();