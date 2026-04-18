import { useState, useEffect, useCallback } from 'react';
import { db } from '../lib/supabase';
import type { Halaqah, HalaqahMember } from '../types';

/**
 * useHalaqah - Fetch and manage single halaqah data
 */
export function useHalaqah(halaqahId: string | undefined) {
  const [halaqah, setHalaqah] = useState<Halaqah | null>(null);
  const [members, setMembers] = useState<HalaqahMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHalaqah = useCallback(async () => {
    if (!halaqahId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [halaqahRes, membersRes] = await Promise.all([
        db.halaqahs.get(halaqahId),
        db.members.getByHalaqah(halaqahId),
      ]);

      if (halaqahRes.error) throw halaqahRes.error;
      if (membersRes.error) throw membersRes.error;

      setHalaqah(halaqahRes.data);
      setMembers(membersRes.data || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [halaqahId]);

  useEffect(() => {
    fetchHalaqah();
  }, [fetchHalaqah]);

  const updateHalaqah = async (updates: Partial<Halaqah>) => {
    if (!halaqahId) return { data: null, error: new Error('No halaqah ID') };

    try {
      const { data, error: updateError } = await db.halaqahs.update(halaqahId, updates);
      if (updateError) throw updateError;
      setHalaqah(data);
      return { data, error: null };
    } catch (err) {
      setError((err as Error).message);
      return { data: null, error: err as Error };
    }
  };

  const addMember = async (studentId: string) => {
    if (!halaqahId) return { data: null, error: new Error('No halaqah ID') };

    try {
      const { data, error: addError } = await db.members.add(halaqahId, studentId);
      if (addError) throw addError;
      const { data: updatedMembers } = await db.members.getByHalaqah(halaqahId);
      setMembers(updatedMembers || []);
      return { data, error: null };
    } catch (err) {
      setError((err as Error).message);
      return { data: null, error: err as Error };
    }
  };

  const removeMember = async (memberId: string) => {
    try {
      const { error: removeError } = await db.members.remove(memberId);
      if (removeError) throw removeError;
      setMembers(prev => prev.filter(m => m.id !== memberId));
      return { error: null };
    } catch (err) {
      setError((err as Error).message);
      return { error: err as Error };
    }
  };

  return {
    halaqah,
    members,
    loading,
    error,
    refetch: fetchHalaqah,
    updateHalaqah,
    addMember,
    removeMember,
  };
}

/**
 * useHalaqahs - Fetch multiple halaqahs with filters
 */
export function useHalaqahs(filters: { teacherId?: string; status?: string } = {}) {
  const [halaqahs, setHalaqahs] = useState<Halaqah[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHalaqahs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await db.halaqahs.getAll(filters);
      if (fetchError) throw fetchError;
      setHalaqahs(data || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [filters.teacherId, filters.status]);

  useEffect(() => {
    fetchHalaqahs();
  }, [fetchHalaqahs]);

  const createHalaqah = async (halaqahData: Partial<Halaqah>) => {
    try {
      const { data, error: createError } = await db.halaqahs.create(halaqahData);
      if (createError) throw createError;
      setHalaqahs(prev => [data!, ...prev]);
      return { data, error: null };
    } catch (err) {
      setError((err as Error).message);
      return { data: null, error: err as Error };
    }
  };

  const deleteHalaqah = async (halaqahId: string) => {
    try {
      const { error: deleteError } = await db.halaqahs.delete(halaqahId);
      if (deleteError) throw deleteError;
      setHalaqahs(prev => prev.filter(h => h.id !== halaqahId));
      return { error: null };
    } catch (err) {
      setError((err as Error).message);
      return { error: err as Error };
    }
  };

  return {
    halaqahs,
    loading,
    error,
    refetch: fetchHalaqahs,
    createHalaqah,
    deleteHalaqah,
  };
}

/**
 * useStudentHalaqah - Fetch halaqah for a specific student
 */
export function useStudentHalaqah(studentId: string | undefined) {
  const [membership, setMembership] = useState<HalaqahMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMembership = useCallback(async () => {
    if (!studentId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await db.members.getByStudent(studentId);
      if (fetchError && (fetchError as { code?: string }).code !== 'PGRST116') throw fetchError;
      setMembership(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    fetchMembership();
  }, [fetchMembership]);

  return {
    membership,
    halaqah: membership?.halaqah,
    loading,
    error,
    refetch: fetchMembership,
  };
}

export default useHalaqah;
