/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Jaikrishna Industries — Trusted Server Date Resolver (Asia/Kolkata)
 * Resolves natural language date and time specifications relative to Indian Standard Time (IST).
 */

export interface DateResolutionResult {
  date: string;               // YYYY-MM-DD
  startTime: string;          // HH:MM
  endTime: string;            // HH:MM
  resolvedIst: string;        // Human readable: e.g. "Friday 31 Oct 2026, 10:00 AM – 10:30 AM IST"
  isAmbiguous: boolean;
  ambiguityReason?: string;
  warning?: string;           // E.g., non-working day / Sunday
}

export interface ResolveDateOptions {
  referenceDate?: Date;       // Defaults to new Date()
  defaultTime?: string;       // Defaults to "10:00"
  durationMinutes?: number;   // Defaults to 30
}

/**
 * Returns current date/time components in Asia/Kolkata
 */
export function getIstComponents(date: Date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    weekday: 'short',
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '';

  const year = parseInt(getPart('year'), 10);
  const month = parseInt(getPart('month'), 10);
  const day = parseInt(getPart('day'), 10);
  const hour = parseInt(getPart('hour'), 10);
  const minute = parseInt(getPart('minute'), 10);
  const weekday = getPart('weekday'); // e.g. 'Fri'

  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  return { year, month, day, hour, minute, weekday, dateStr, timeStr };
}

/**
 * Formats a Date in Asia/Kolkata human-readable string
 */
export function formatIstPretty(dateStr: string, timeStr: string, endTimeStr?: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);
  
  // Create UTC date that represents the IST components
  const d = new Date(Date.UTC(year, month - 1, day, hour - 5, minute - 30));

  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  };

  const formattedStart = new Intl.DateTimeFormat('en-IN', options).format(d);
  
  if (endTimeStr) {
    const [eHour, eMinute] = endTimeStr.split(':').map(Number);
    const ed = new Date(Date.UTC(year, month - 1, day, eHour - 5, eMinute - 30));
    const formattedEnd = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(ed);
    return `${formattedStart} – ${formattedEnd} IST`;
  }

  return `${formattedStart} IST`;
}

/**
 * Resolves natural language date and time input into trusted IST date, startTime, and endTime
 */
export function resolveDateAndTimeToIst(
  inputDateText: string,
  inputTimeText?: string,
  options: ResolveDateOptions = {}
): DateResolutionResult {
  const now = options.referenceDate || new Date();
  const istNow = getIstComponents(now);
  const defaultStartTime = options.defaultTime || '10:00';
  const duration = options.durationMinutes || 30;

  const normalizedDate = inputDateText.trim().toLowerCase();
  let targetDateStr = '';
  let warning: string | undefined;
  let isAmbiguous = false;
  let ambiguityReason: string | undefined;

  // 1. Relative keywords
  if (normalizedDate === 'today' || normalizedDate === 'inru' || normalizedDate === 'innikku') {
    targetDateStr = istNow.dateStr;
  } else if (normalizedDate === 'tomorrow' || normalizedDate === 'nalai' || normalizedDate === 'naalaiki') {
    // Add 1 day
    const nextDay = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    targetDateStr = getIstComponents(nextDay).dateStr;
  } else if (normalizedDate === 'day after tomorrow' || normalizedDate === 'naalanalikku') {
    const dayAfter = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    targetDateStr = getIstComponents(dayAfter).dateStr;
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
    targetDateStr = normalizedDate;
  } else {
    // Try weekday resolution (e.g. "friday", "next monday")
    const daysMap: Record<string, number> = {
      sunday: 0,
      sun: 0,
      monday: 1,
      mon: 1,
      tuesday: 2,
      tue: 2,
      wednesday: 3,
      wed: 3,
      thursday: 4,
      thu: 4,
      friday: 5,
      fri: 5,
      saturday: 6,
      sat: 6,
    };

    const isNext = normalizedDate.startsWith('next ');
    const rawDay = normalizedDate.replace(/^next\s+/, '').trim();

    if (daysMap[rawDay] !== undefined) {
      const targetDayOfWeek = daysMap[rawDay];
      const currentDayOfWeek = new Date(istNow.dateStr + 'T12:00:00+05:30').getDay();
      
      let diff = targetDayOfWeek - currentDayOfWeek;
      if (diff === 0) {
        // Ambiguity: today is this weekday!
        isAmbiguous = true;
        ambiguityReason = `Today is already ${rawDay}. Please specify if you mean today or next week's ${rawDay}.`;
        diff = isNext ? 7 : 0;
      } else if (diff < 0) {
        diff += 7;
      }
      if (isNext && diff < 7) {
        diff += 7;
      }

      const calculated = new Date(now.getTime() + diff * 24 * 60 * 60 * 1000);
      targetDateStr = getIstComponents(calculated).dateStr;
    } else {
      // Fallback: try parsing direct date
      const parsed = Date.parse(inputDateText);
      if (!isNaN(parsed)) {
        targetDateStr = getIstComponents(new Date(parsed)).dateStr;
      } else {
        targetDateStr = istNow.dateStr;
        isAmbiguous = true;
        ambiguityReason = `Could not reliably parse date "${inputDateText}". Defaulted to today.`;
      }
    }
  }

  // 2. Check for Sunday / Holiday
  const targetDayOfWeek = new Date(targetDateStr + 'T12:00:00+05:30').getDay();
  if (targetDayOfWeek === 0) {
    warning = 'Note: The resolved date is a Sunday (weekly pooja manufacturing rest day). Confirming will still schedule it.';
  }

  // 3. Resolve Time
  let resolvedStartTime = defaultStartTime;
  if (inputTimeText && inputTimeText.trim()) {
    const rawTime = inputTimeText.trim().toLowerCase();
    
    // Check 12-hour format e.g., "4:00 pm", "4pm", "10am"
    const match12 = rawTime.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
    if (match12) {
      let h = parseInt(match12[1], 10);
      const m = match12[2] ? parseInt(match12[2], 10) : 0;
      const meridiem = match12[3];
      if (meridiem === 'pm' && h < 12) h += 12;
      if (meridiem === 'am' && h === 12) h = 0;
      resolvedStartTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    } else if (/^\d{2}:\d{2}$/.test(rawTime)) {
      resolvedStartTime = rawTime;
    }
  }

  // 4. Calculate End Time (+30 min default)
  const [h, m] = resolvedStartTime.split(':').map(Number);
  const totalMins = h * 60 + m + duration;
  const endH = Math.floor(totalMins / 60) % 24;
  const endM = totalMins % 60;
  const resolvedEndTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

  // 5. Check if time has already passed today
  if (targetDateStr === istNow.dateStr) {
    const [nowH, nowM] = istNow.timeStr.split(':').map(Number);
    if (h < nowH || (h === nowH && m < nowM)) {
      isAmbiguous = true;
      ambiguityReason = `The requested time (${resolvedStartTime} IST) has already passed today.`;
    }
  }

  const resolvedIst = formatIstPretty(targetDateStr, resolvedStartTime, resolvedEndTime);

  return {
    date: targetDateStr,
    startTime: resolvedStartTime,
    endTime: resolvedEndTime,
    resolvedIst,
    isAmbiguous,
    ambiguityReason,
    warning,
  };
}
