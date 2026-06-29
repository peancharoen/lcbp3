'use client';

// File: frontend/components/common/error-display.tsx
// ADR-007: Component แสดง Error พร้อม Recovery Actions สำหรับ User

import { AlertTriangle, XCircle, Info } from 'lucide-react';

// รูปแบบ Error Response จาก Backend (ADR-007)
export interface ApiErrorPayload {
  type: string;
  code: string;
  message: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  timestamp: string;
  statusCode?: number;
  recoveryActions?: string[];
  technicalMessage?: string;
  details?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  error: ApiErrorPayload;
}

interface ErrorDisplayProps {
  error: ApiErrorResponse | ApiErrorPayload | null | undefined;
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}

// แปลง severity เป็น color class
function getSeverityStyles(severity: string): {
  container: string;
  icon: string;
  title: string;
  iconComponent: React.ElementType;
} {
  switch (severity) {
    case 'LOW':
      return {
        container: 'border-yellow-200 bg-yellow-50',
        icon: 'text-yellow-400',
        title: 'text-yellow-800',
        iconComponent: Info,
      };
    case 'MEDIUM':
      return {
        container: 'border-orange-200 bg-orange-50',
        icon: 'text-orange-400',
        title: 'text-orange-800',
        iconComponent: AlertTriangle,
      };
    case 'HIGH':
      return {
        container: 'border-red-200 bg-red-50',
        icon: 'text-red-400',
        title: 'text-red-700',
        iconComponent: AlertTriangle,
      };
    case 'CRITICAL':
      return {
        container: 'border-red-300 bg-red-100',
        icon: 'text-red-500',
        title: 'text-red-900',
        iconComponent: XCircle,
      };
    default:
      return {
        container: 'border-gray-200 bg-gray-50',
        icon: 'text-gray-400',
        title: 'text-gray-700',
        iconComponent: AlertTriangle,
      };
  }
}

// ดึง ErrorPayload ออกจาก response ที่อาจซ้อนอยู่
function extractErrorPayload(
  error: ApiErrorResponse | ApiErrorPayload | null | undefined
): ApiErrorPayload | null {
  if (!error) return null;

  // กรณีที่ error เป็น { error: { ... } }
  if ('error' in error && error.error && typeof error.error === 'object') {
    return error.error as ApiErrorPayload;
  }

  // กรณีที่ error เป็น payload โดยตรง
  if ('type' in error && 'message' in error) {
    return error as ApiErrorPayload;
  }

  return null;
}

export function ErrorDisplay({ error, onRetry, className = '', compact = false }: ErrorDisplayProps) {
  const payload = extractErrorPayload(error);

  if (!payload) return null;

  const styles = getSeverityStyles(payload.severity);
  const IconComponent = styles.iconComponent;

  if (compact) {
    return (
      <div className={`rounded-md border p-3 ${styles.container} ${className}`}>
        <div className="flex items-start gap-2">
          <IconComponent className={`mt-0.5 h-4 w-4 flex-shrink-0 ${styles.icon}`} />
          <p className={`text-sm ${styles.title}`}>{payload.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border p-4 ${styles.container} ${className}`} role="alert">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <IconComponent className={`h-5 w-5 ${styles.icon}`} aria-hidden="true" />
        </div>
        <div className="ml-3 flex-1">
          {/* หัวข้อ Error */}
          <h3 className={`text-sm font-medium ${styles.title}`}>
            {payload.message}
          </h3>

          {/* Recovery Actions */}
          {payload.recoveryActions && payload.recoveryActions.length > 0 && (
            <div className="mt-2 text-sm text-gray-600">
              <p className="font-medium text-gray-700">วิธีแก้ไข:</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5">
                {payload.recoveryActions.map((action, index) => (
                  <li key={index}>{action}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Error Code (แสดงเฉพาะ Development) */}
          {process.env.NODE_ENV === 'development' && payload.technicalMessage && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700">
                รายละเอียดทางเทคนิค (Development)
              </summary>
              <pre className="mt-1 overflow-x-auto rounded bg-gray-100 p-2 text-xs text-gray-600">
                {payload.technicalMessage}
              </pre>
            </details>
          )}

          {/* Action Buttons */}
          <div className="mt-3 flex flex-wrap gap-2">
            {onRetry && (
              <button
                onClick={onRetry}
                type="button"
                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
              >
                ลองใหม่
              </button>
            )}
            <button
              type="button"
              onClick={() => window.open('mailto:support@np-dms.work', '_blank')}
              className="rounded-md bg-gray-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1"
            >
              ติดต่อผู้ดูแลระบบ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper: แปลง Axios/Fetch error เป็น ApiErrorResponse
export function parseApiError(error: unknown): ApiErrorResponse {
  // กรณี error มาจาก Axios
  if (
    error !== null &&
    typeof error === 'object' &&
    'response' in error &&
    (error as { response?: { data?: unknown } }).response?.data
  ) {
    const data = (error as { response: { data: unknown } }).response.data;
    if (
      typeof data === 'object' &&
      data !== null &&
      'error' in data
    ) {
      return data as ApiErrorResponse;
    }
  }

  // กรณี error เป็น ApiErrorResponse อยู่แล้ว
  if (
    error !== null &&
    typeof error === 'object' &&
    'error' in error &&
    (error as ApiErrorResponse).error?.message
  ) {
    return error as ApiErrorResponse;
  }

  // กรณี Network Error หรือ Unknown
  return {
    error: {
      type: 'INTERNAL_ERROR',
      code: 'NETWORK_ERROR',
      message: 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้',
      severity: 'HIGH',
      timestamp: new Date().toISOString(),
      recoveryActions: ['ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต', 'ลองใหม่ภายหลัง'],
    },
  };
}
