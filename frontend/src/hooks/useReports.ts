import { useState, useEffect, useCallback } from 'react';
import { db } from '../lib/supabase';
import type { Report, ReportItem, ProgressStats, AcademyStats } from '../types';

/**
 * useStudentReports - Fetch reports for a specific student
 */
export function useStudentReports(studentId: string | undefined, limit: number = 10) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    if (!studentId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await db.reports.getByStudent(studentId, limit);
      if (fetchError) throw fetchError;
      setReports(data || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [studentId, limit]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  return {
    reports,
    loading,
    error,
    refetch: fetchReports,
  };
}

/**
 * useHalaqahReports - Fetch reports for a specific halaqah
 */
export function useHalaqahReports(halaqahId: string | undefined, limit: number = 50) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    if (!halaqahId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await db.reports.getByHalaqah(halaqahId, limit);
      if (fetchError) throw fetchError;
      setReports(data || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [halaqahId, limit]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  return {
    reports,
    loading,
    error,
    refetch: fetchReports,
  };
}

/**
 * useCreateReport - Create a new report with items
 */
export function useCreateReport() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createReport = async (
    reportData: Partial<Report>,
    items: Partial<ReportItem>[]
  ) => {
    setLoading(true);
    setError(null);

    try {
      const { data: report, error: reportError } = await db.reports.create(reportData);
      if (reportError) throw reportError;

      if (items && items.length > 0 && report) {
        const itemsWithReportId = items.map(item => ({
          ...item,
          report_id: report.id,
        }));

        const { error: itemsError } = await db.reports.addItems(itemsWithReportId);
        if (itemsError) throw itemsError;
      }

      return { data: report, error: null };
    } catch (err) {
      setError((err as Error).message);
      return { data: null, error: err as Error };
    } finally {
      setLoading(false);
    }
  };

  return {
    createReport,
    loading,
    error,
  };
}

/**
 * useStudentProgress - Fetch progress statistics for a student
 */
export function useStudentProgress(studentId: string | undefined) {
  const [progress, setProgress] = useState<ProgressStats>({
    memorization: 0,
    review: 0,
    progress: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProgress = useCallback(async () => {
    if (!studentId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await db.stats.getStudentProgress(studentId);
      if (fetchError) throw fetchError;
      setProgress(data || { memorization: 0, review: 0, progress: 0 });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  return {
    progress,
    loading,
    error,
    refetch: fetchProgress,
  };
}

/**
 * useAcademyStats - Fetch overall academy statistics
 */
export function useAcademyStats() {
  const [stats, setStats] = useState<AcademyStats>({
    totalStudents: 0,
    totalTeachers: 0,
    totalHalaqahs: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await db.stats.getAcademyStats();
      if (fetchError) throw fetchError;
      setStats(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    loading,
    error,
    refetch: fetchStats,
  };
}

export default useStudentReports;
