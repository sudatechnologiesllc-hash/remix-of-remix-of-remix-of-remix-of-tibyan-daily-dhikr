import { playReminderSound, unlockAudio, type SoundId } from "./sound";

// طبقة التنبيهات: Capacitor Local Notifications على الجهاز (تعمل والتطبيق مغلق/في الخلفية)،
// وWeb Notifications في المتصفح (تعمل فقط أثناء فتح الصفحة).
export const INTERVALS = [5, 15, 30, 60, 120] as const;
export type IntervalMinutes = (typeof INTERVALS)[number];

const CHANNEL_ID = "tibyan_salawat";
/** عدد التنبيهات المجدولة مسبقاً (يُعاد ملؤها كلما فُتح التطبيق) */
const BATCH_SIZE = 48;
const ID_BASE = 1000;

const isBrowser = () => typeof window !== "undefined";

export function isNative(): boolean {
  if (!isBrowser()) return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

type NativeApi = typeof import("@capacitor/local-notifications")["LocalNotifications"];

async function loadNative(): Promise<NativeApi | null> {
  if (!isNative()) return null;
  try {
    const mod = await import("@capacitor/local-notifications");
    return mod.LocalNotifications;
  } catch {
    return null;
  }
}

export async function requestPermission(): Promise<boolean> {
  if (!isBrowser()) return false;
  const native = await loadNative();
  if (native) {
    try {
      const res = await native.requestPermissions();
      return res.display === "granted";
    } catch {
      return false;
    }
  }
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  return (await Notification.requestPermission()) === "granted";
}

let webTimer: ReturnType<typeof setInterval> | undefined;

export interface ScheduleOptions {
  minutes: IntervalMinutes;
  body: string;
  /** اسم ملف الصوت الأصلي على أندرويد (بدون امتداد يُستخدم للقناة) */
  sound?: string | undefined;
  /** معرّف الصوت للتشغيل في المتصفح: salawat | chime | silent */
  soundId?: SoundId;
}

const STORE_KEY = "tibyan_reminders_state";

function saveState(options: ScheduleOptions | null) {
  try {
    if (options) window.localStorage.setItem(STORE_KEY, JSON.stringify(options));
    else window.localStorage.removeItem(STORE_KEY);
  } catch {
    // تجاهل
  }
}

function readState(): ScheduleOptions | null {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as ScheduleOptions) : null;
  } catch {
    return null;
  }
}

async function ensureChannel(native: NativeApi, sound?: string) {
  try {
    await native.createChannel({
      id: CHANNEL_ID,
      name: "تذكير الصلاة على النبي ﷺ",
      description: "تنبيهات دورية للصلاة على النبي ﷺ",
      importance: 5,
      visibility: 1,
      ...(sound ? { sound } : {}),
      vibration: true,
    });
  } catch {
    // بعض المنصات لا تدعم القنوات (iOS)
  }
}

/** جدولة دفعة تنبيهات مستقبلية على الجهاز — تستمر بعد إغلاق التطبيق */
async function scheduleNative(native: NativeApi, options: ScheduleOptions): Promise<boolean> {
  const permission = await native.requestPermissions();
  if (permission.display !== "granted") return false;

  await ensureChannel(native, options.sound?.replace(/\.[^.]+$/, ""));
  await cancelNative(native);

  const stepMs = options.minutes * 60 * 1000;
  const start = Date.now() + stepMs;
  const notifications = Array.from({ length: BATCH_SIZE }, (_, index) => ({
    id: ID_BASE + index,
    title: "تِبْيَان",
    body: options.body,
    channelId: CHANNEL_ID,
    ...(options.sound ? { sound: options.sound } : {}),
    smallIcon: "ic_stat_icon",
    schedule: {
      at: new Date(start + index * stepMs),
      allowWhileIdle: true,
    },
  }));

  await native.schedule({ notifications });
  return true;
}

async function cancelNative(native: NativeApi) {
  try {
    const pending = await native.getPending();
    if (pending.notifications.length) {
      await native.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    }
  } catch {
    // تجاهل
  }
}

export async function schedule(options: ScheduleOptions): Promise<void> {
  if (!isBrowser()) return;
  await cancelAll({ keepState: true });
  saveState(options);

  const native = await loadNative();
  if (native) {
    const ok = await scheduleNative(native, options);
    if (ok) return;
  }

  // المتصفح: مؤقّت يعمل أثناء فتح الصفحة فقط
  await unlockAudio();
  const soundId: SoundId = options.soundId ?? "salawat";
  const granted = await requestPermission();
  webTimer = setInterval(() => {
    void playReminderSound(soundId);
    if (granted) {
      try {
        new Notification("تِبْيَان", { body: options.body });
      } catch {
        // تم إغلاق الصلاحية
      }
    }
  }, options.minutes * 60 * 1000);
}

export async function cancelAll(opts?: { keepState?: boolean }): Promise<void> {
  if (webTimer) {
    clearInterval(webTimer);
    webTimer = undefined;
  }
  if (!opts?.keepState) saveState(null);
  const native = await loadNative();
  if (native) await cancelNative(native);
}

/**
 * إعادة تعبئة دفعة التنبيهات عند فتح/استئناف التطبيق، حتى لا تنفد الجدولة المسبقة.
 * تُستدعى مرة واحدة عند إقلاع التطبيق.
 */
export function initBackgroundReminders(): () => void {
  if (!isBrowser()) return () => {};

  const rearm = async () => {
    const state = readState();
    if (!state) return;
    const native = await loadNative();
    if (!native) return;
    try {
      const pending = await native.getPending();
      const future = pending.notifications.filter((n) => n.id >= ID_BASE);
      if (future.length >= BATCH_SIZE / 2) return;
      await scheduleNative(native, state);
    } catch {
      // تجاهل
    }
  };

  void rearm();

  let cleanup = () => {};
  void (async () => {
    if (!isNative()) return;
    try {
      const { App } = await import("@capacitor/app");
      const handle = await App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) void rearm();
      });
      cleanup = () => void handle.remove();
    } catch {
      // تجاهل
    }
  })();

  return () => cleanup();
}
