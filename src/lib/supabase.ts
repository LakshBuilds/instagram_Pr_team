import { supabase } from "@/integrations/supabase/client";

export const signUp = async (email: string, password: string, fullName: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
      emailRedirectTo: `${window.location.origin}/`,
    },
  });
  return { data, error };
};

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

/**
 * Saves the Apify API key to user's profile
 */
export const saveApifyApiKey = async (userId: string, apiKey: string) => {
  // First check if profile exists
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  
  if (!existing) {
    // Create profile if it doesn't exist
    const { data: userData } = await supabase.auth.getUser();
    const { data: newProfile, error: createError } = await supabase
      .from("profiles")
      .insert({
        id: userId,
        email: userData.user?.email || "",
        full_name: userData.user?.user_metadata?.full_name || userData.user?.email || "User",
        apify_api_key: apiKey,
      })
      .select()
      .single();
    
    return { data: newProfile, error: createError };
  }
  
  // Update existing profile
  const { data, error } = await supabase
    .from("profiles")
    .update({ apify_api_key: apiKey })
    .eq("id", userId)
    .select()
    .single();
  return { data, error };
};

/**
 * Gets the Apify API key from user's profile
 */
export const getApifyApiKey = async (userId: string): Promise<string | null> => {
  const { data, error } = await supabase
    .from("profiles")
    .select("apify_api_key")
    .eq("id", userId)
    .single();
  
  if (error || !data) return null;
  return data.apify_api_key;
};