
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ftwjlunfjuzgfvwqmyqo.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_09O87nYHBHeBI7eC7dUUkw_Qya3jlLA';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    }
});

/**
 * Sign up a new user with Supabase Auth including metadata (role, fullName, phone, center).
 */
export async function signUpWithSupabase(email, password, metadata = {}) {
    const role = metadata.role || 'super_admin';
    const fullName = metadata.fullName || 'Admin User';
    const phone = metadata.phone || '';
    const center = metadata.center || 'Main Hub (Bangalore)';

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: fullName,
                role: role,
                phone: phone,
                center: center
            }
        }
    });

    if (error) throw error;
    return data;
}

/**
 * Sign in with email and password using Supabase Auth.
 */
export async function signInWithSupabase(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (error) throw error;
    return data;
}

/**
 * Sign out current active session from Supabase.
 */
export async function signOutFromSupabase() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
}

/**
 * Get current authenticated user's active session.
 */
export async function getCurrentSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
}
