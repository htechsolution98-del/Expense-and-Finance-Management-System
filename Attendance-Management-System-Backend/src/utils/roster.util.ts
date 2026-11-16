export interface ShiftSchedule {
  shiftId?: string | null;
  durationType: 'PERMANENT' | '1_WEEK' | '2_WEEKS' | '1_MONTH' | 'CUSTOM';
  startDate: string; // YYYY-MM-DD
  endDate: string | null; // YYYY-MM-DD
  assignedAt?: string;
  notes?: string;
}

export interface ParsedRoster {
  effectiveShiftId: string | null;
  schedule: ShiftSchedule | null;
  daysRemaining: number | null;
  isExpired: boolean;
  statusText: string;
}

const ROSTER_PREFIX = '__ROSTER__:';
const ROSTER_DELIMITER = '|||';

/**
 * Strips roster metadata from employee address string
 */
export function getCleanAddress(rawAddress?: string | null): string {
  if (!rawAddress) return 'N/A';
  if (rawAddress.includes(ROSTER_DELIMITER)) {
    const parts = rawAddress.split(ROSTER_DELIMITER);
    return parts[0]?.trim() || 'N/A';
  }
  if (rawAddress.startsWith(ROSTER_PREFIX)) {
    return 'N/A';
  }
  return rawAddress;
}

/**
 * Encodes shift schedule inside employee address string safely without altering schema
 */
export function serializeRoster(
  rawAddress: string | null | undefined,
  schedule: ShiftSchedule | null
): string {
  const clean = getCleanAddress(rawAddress);
  if (!schedule) {
    return clean === 'N/A' ? 'N/A' : clean;
  }
  const payload = JSON.stringify(schedule);
  if (clean && clean !== 'N/A') {
    return `${clean}${ROSTER_DELIMITER}${ROSTER_PREFIX}${payload}`;
  }
  return `${ROSTER_PREFIX}${payload}`;
}

/**
 * Parses roster schedule from employee address and computes validity & remaining days
 */
export function parseRoster(
  rawAddress: string | null | undefined,
  directShiftId: string | null | undefined
): ParsedRoster {
  if (!rawAddress || !rawAddress.includes(ROSTER_PREFIX)) {
    if (directShiftId) {
      return {
        effectiveShiftId: directShiftId,
        schedule: {
          shiftId: directShiftId,
          durationType: 'PERMANENT',
          startDate: '',
          endDate: null,
        },
        daysRemaining: null,
        isExpired: false,
        statusText: 'Permanent',
      };
    }
    return {
      effectiveShiftId: null,
      schedule: null,
      daysRemaining: null,
      isExpired: false,
      statusText: 'Default',
    };
  }

  try {
    const jsonStr = rawAddress.substring(rawAddress.indexOf(ROSTER_PREFIX) + ROSTER_PREFIX.length);
    const schedule: ShiftSchedule = JSON.parse(jsonStr);

    const shiftToUse = schedule.shiftId || directShiftId || null;

    if (schedule.durationType === 'PERMANENT' || !schedule.endDate) {
      return {
        effectiveShiftId: shiftToUse,
        schedule,
        daysRemaining: null,
        isExpired: false,
        statusText: 'Permanent',
      };
    }

    // Check expiry
    const now = new Date();
    // End date considered active until end of the date (23:59:59)
    const end = new Date(`${schedule.endDate}T23:59:59`);

    if (now.getTime() > end.getTime()) {
      return {
        effectiveShiftId: null, // Expired, fallback to company default
        schedule,
        daysRemaining: 0,
        isExpired: true,
        statusText: 'Schedule Expired',
      };
    }

    // Calculate days remaining (inclusive)
    const diffMs = end.getTime() - now.getTime();
    const daysRemaining = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

    let durationLabel = 'Scheduled';
    if (schedule.durationType === '1_WEEK') durationLabel = '1 Week';
    else if (schedule.durationType === '2_WEEKS') durationLabel = '2 Weeks';
    else if (schedule.durationType === '1_MONTH') durationLabel = '1 Month';
    else durationLabel = 'Custom';

    return {
      effectiveShiftId: shiftToUse,
      schedule,
      daysRemaining,
      isExpired: false,
      statusText: `${durationLabel} (${daysRemaining}d left)`,
    };
  } catch {
    return {
      effectiveShiftId: directShiftId || null,
      schedule: null,
      daysRemaining: null,
      isExpired: false,
      statusText: directShiftId ? 'Permanent' : 'Default',
    };
  }
}

