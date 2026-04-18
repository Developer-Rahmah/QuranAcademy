import { useState, useEffect, useCallback } from 'react';
import { db } from '../lib/supabase';
import type { Profile } from '../types';

/**
 * useProfile - Fetch and manage profile data
 */
export function useProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await db.profiles.get(userId);
      if (fetchError) throw fetchError;
      setProfile(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!userId) return { data: null, error: new Error('No user ID') };

    try {
      const { data, error: updateError } = await db.profiles.update(userId, updates);
      if (updateError) throw updateError;
      setProfile(data);
      return { data, error: null };
    } catch (err) {
      setError((err as Error).message);
      return { data: null, error: err as Error };
    }
  };

  return {
    profile,
    loading,
    error,
    refetch: fetchProfile,
    updateProfile,
  };
}

/**
 * useProfiles - Fetch multiple profiles with filters
 */
export function useProfiles(filters: { role?: string; status?: string } = {}) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await db.profiles.getAll(filters);
      if (fetchError) throw fetchError;
      setProfiles(data || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [filters.role, filters.status]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  return {
    profiles,
    loading,
    error,
    refetch: fetchProfiles,
  };
}

export default useProfile;
