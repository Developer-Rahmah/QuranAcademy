/**
 * Error Handler - Maps Supabase/API errors to user-friendly Arabic messages
 */

// ============================================
// Error Types
// ============================================
export interface AppError {
  code: string;
  message: string;
  details?: string;
  original?: unknown;
}

// ============================================
// Supabase Error Codes to Arabic Messages
// ============================================
const ERROR_MAP: Record<string, string> = {
  // Auth Errors
  'invalid_credentials': 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
  'email_not_confirmed': 'يرجى تأكيد البريد الإلكتروني أولاً',
  'user_not_found': 'لم يتم العثور على المستخدم',
  'user_already_exists': 'هذا البريد الإلكتروني مسجل بالفعل',
  'weak_password': 'كلمة المرور ضعيفة جداً',
  'invalid_email': 'البريد الإلكتروني غير صالح',
  'email_taken': 'هذا البريد الإلكتروني مستخدم بالفعل',
  'phone_taken': 'رقم الهاتف مستخدم بالفعل',
  'signup_disabled': 'التسجيل معطل حالياً',
  'over_request_rate_limit': 'طلبات كثيرة جداً، يرجى المحاولة لاحقاً',
  'over_email_send_rate_limit': 'تم إرسال الكثير من الرسائل، يرجى الانتظار',

  // Session Errors
  'session_not_found': 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مرة أخرى',
  'invalid_token': 'رمز غير صالح',
  'token_expired': 'انتهت صلاحية الرمز',
  'refresh_token_not_found': 'يرجى تسجيل الدخول مرة أخرى',

  // RLS Errors
  'PGRST301': 'ليس لديك صلاحية لهذا الإجراء',
  '42501': 'ليس لديك صلاحية للوصول إلى هذه البيانات',
  'new row violates row-level security': 'ليس لديك صلاحية لإضافة هذه البيانات',
  'row-level security': 'ليس لديك صلاحية لهذا الإجراء',

  // Database Errors
  '23505': 'هذا العنصر موجود بالفعل',
  '23503': 'لا يمكن الحذف: هناك بيانات مرتبطة',
  '22P02': 'قيمة غير صالحة',
  'PGRST116': 'لم يتم العثور على البيانات',

  // Network Errors
  'fetch_failed': 'فشل الاتصال بالخادم',
  'network_error': 'خطأ في الشبكة، يرجى التحقق من اتصالك',
  'timeout': 'انتهت مهلة الاتصال',

  // Generic
  'unknown': 'حدث خطأ غير متوقع',
  'server_error': 'خطأ في الخادم، يرجى المحاولة لاحقاً',
};

// ============================================
// Parse Error
// ============================================
export function parseError(error: unknown): AppError {
  // Null/undefined
  if (!error) {
    return {
      code: 'unknown',
      message: ERROR_MAP.unknown,
      original: error,
    };
  }

  // String error
  if (typeof error === 'string') {
    const matchedKey = Object.keys(ERROR_MAP).find((key) =>
      error.toLowerCase().includes(key.toLowerCase())
    );

    return {
      code: matchedKey || 'unknown',
      message: ERROR_MAP[matchedKey || 'unknown'],
      details: error,
      original: error,
    };
  }

  // Error object
  if (error instanceof Error) {
    const errorObj = error as Error & {
      code?: string;
      status?: number;
      statusCode?: number;
      details?: string;
    };

    const code = errorObj.code || errorObj.status?.toString() || errorObj.statusCode?.toString() || 'unknown';
    const message = errorObj.message;

    // Check for known error patterns in message
    const matchedKey = Object.keys(ERROR_MAP).find((key) =>
      message.toLowerCase().includes(key.toLowerCase())
    );

    // Check if message is already in Arabic
    const isArabic = /[\u0600-\u06FF]/.test(message);

    return {
      code,
      message: isArabic ? message : (matchedKey ? ERROR_MAP[matchedKey] : (ERROR_MAP[code] || message)),
      details: errorObj.details,
      original: error,
    };
  }

  // Object with error properties
  if (typeof error === 'object') {
    const errorObj = error as Record<string, unknown>;
    const code = (errorObj.code as string) || (errorObj.error_code as string) || 'unknown';
    const message = (errorObj.message as string) || (errorObj.error_description as string) || '';

    // Check for known error patterns
    const matchedKey = Object.keys(ERROR_MAP).find((key) =>
      message.toLowerCase().includes(key.toLowerCase()) ||
      code.toLowerCase().includes(key.toLowerCase())
    );

    // Check if message is already in Arabic
    const isArabic = /[\u0600-\u06FF]/.test(message);

    return {
      code,
      message: isArabic ? message : (matchedKey ? ERROR_MAP[matchedKey] : (ERROR_MAP[code] || message || ERROR_MAP.unknown)),
      details: errorObj.details as string,
      original: error,
    };
  }

  return {
    code: 'unknown',
    message: ERROR_MAP.unknown,
    original: error,
  };
}

// ============================================
// Get User-Friendly Message
// ============================================
export function getErrorMessage(error: unknown): string {
  const parsed = parseError(error);
  return parsed.message;
}

// ============================================
// Is RLS Error
// ============================================
export function isRLSError(error: unknown): boolean {
  const parsed = parseError(error);
  return (
    parsed.code.includes('42501') ||
    parsed.code.includes('PGRST301') ||
    parsed.message.includes('row-level security') ||
    parsed.message.includes('صلاحية')
  );
}

// ============================================
// Is Network Error
// ============================================
export function isNetworkError(error: unknown): boolean {
  const parsed = parseError(error);
  return (
    parsed.code === 'fetch_failed' ||
    parsed.code === 'network_error' ||
    parsed.code === 'timeout' ||
    parsed.message.includes('fetch') ||
    parsed.message.includes('network')
  );
}

// ============================================
// Is Auth Error
// ============================================
export function isAuthError(error: unknown): boolean {
  const authCodes = [
    'invalid_credentials',
    'email_not_confirmed',
    'user_not_found',
    'session_not_found',
    'invalid_token',
    'token_expired',
  ];

  const parsed = parseError(error);
  return authCodes.some((code) => parsed.code.includes(code) || parsed.message.includes(code));
}

// ============================================
// Log Error (for developers)
// ============================================
export function logError(context: string, error: unknown): void {
  const parsed = parseError(error);

  console.error(`[${context}] Error:`, {
    code: parsed.code,
    message: parsed.message,
    details: parsed.details,
    original: parsed.original,
  });
}

export default {
  parseError,
  getErrorMessage,
  isRLSError,
  isNetworkError,
  isAuthError,
  logError,
};
