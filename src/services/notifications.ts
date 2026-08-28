import { playReminderSound, unlockAudio, type SoundId } from "./sound";

// طبقة التنبيهات:
// - أندرويد (Capacitor): الجدولة تُسلَّم لنظام أندرويد عبر @capacitor/local-notifications،
//   فتعمل التنبيهات والصوت والتطبيق مغلق أو الشاشة مقفلة، دون أي مؤقّت JavaScript.
// - المتصفح: مؤقّت setInterval يعمل أثناء فتح الصفحة فقط (بديل احتياطي للويب).
export const INTERVALS = [5, 15, 30, 60, 120] as const;
export type IntervalMinutes = (typeof INTERVALS)[number];

/** قنوات أندرويد: قناة مستقلة لكل صوت (لأن الصوت خاصية للقناة ولا يمكن تغييره بعد إنشائها). */
const CHANNELS: Record<SoundId, { id: string; sound: string; name: string }> = {
  salawat: {
    id: "tibyan_salawat_v2",
    sound: "salawat.mp3",
    name: "تذكير الصلاة على النبي ﷺ (بالصوت)",
  },
  chime: { id: "tibyan_chime_v2", sound: "chime.mp3", name: "تذكير الصلاة على النبي ﷺ (نغمة)" },
  silent: { id: "tibyan_silent_v2", sound: "silence.mp3", name: "تذكير الصلاة على النبي ﷺ (صامت)" },
};

/** نطاق معرّفات خاص بتِبْيَان لا يتصادم مع غيره */
const ID_BASE = 71000;
const BATCH_SIZE = 60;
/** إذا نقص عدد التنبيهات المستقبلية عن هذا الحد يُعاد ملء الدفعة */
const REFILL_THRESHOLD = 12;

const DEBUG = true;
const log = (...args: unknown[]) => {
  if (DEBUG) console.log("[Tibyan Notifications]", ...args);
};

const isBrowser = () => typeof window !== "undefined";

export function isNative(): boolean {
  if (!isBrowser()) return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

type NativeApi = (typeof import("@capacitor/local-notifications"))["LocalNotifications"];

async function loadNative(): Promise<NativeApi | null> {
  if (!isNative()) return null;
  try {
    const mod = await import("@capacitor/local-notifications");
    return mod.LocalNotifications;
  } catch (error) {
    log("failed to load native plugin", error);
    return null;
  }
}

export async function requestPermission(): Promise<boolean> {
  if (!isBrowser()) return false;
  const native = await loadNative();
  if (native) {
    try {
      const current = await native.checkPermissions();
      if (current.display === "granted") return true;
      const res = await native.requestPermissions();
      log("Permission:", res.display);
      return res.display === "granted";
    } catch (error) {
      log("permission request failed", error);
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
  /** معرّف الصوت: salawat | chime | silent */
  soundId: SoundId;
}

export interface ScheduleResult {
  success: boolean;
  /** سبب الفشل أو ملاحظة (يُعرض للمستخدم عند الحاجة) */
  reason?: string;
  /** موعد أول تنبيه إن نجحت الجدولة */
  firstAt?: Date;
  /** صحيح إذا كان الفشل بسبب رفض تصريح الإشعارات (لعرض زر فتح الإعدادات) */
  permissionDenied?: boolean;
}

/**
 * يفتح صفحة إعدادات إشعارات تِبْيَان في نظام أندرويد مباشرة،
 * وفي المتصفح يفتح إعدادات الموقع إن أمكن.
 */
export async function openNotificationSettings(): Promise<boolean> {
  if (!isBrowser()) return false;
  if (isNative()) {
    try {
      const { NativeSettings, AndroidSettings, IOSSettings } = await import(
        "capacitor-native-settings"
      );
      await NativeSettings.open({
        optionAndroid: AndroidSettings.AppNotification,
        optionIOS: IOSSettings.App,
      });
      return true;
    } catch (error) {
      log("failed to open app notification settings", error);
      try {
        const { NativeSettings, AndroidSettings, IOSSettings } = await import(
          "capacitor-native-settings"
        );
        await NativeSettings.open({
          optionAndroid: AndroidSettings.ApplicationDetails,
          optionIOS: IOSSettings.App,
        });
        return true;
      } catch {
        return false;
      }
    }
  }
  return false;
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
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ScheduleOptions> & { sound?: string };
    if (!parsed.minutes || !INTERVALS.includes(parsed.minutes as IntervalMinutes)) return null;
    const soundId: SoundId =
      parsed.soundId && parsed.soundId in CHANNELS ? parsed.soundId : "salawat";
    return {
      minutes: parsed.minutes as IntervalMinutes,
      body: parsed.body ?? "اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبِيِّنَا مُحَمَّدٍ",
      soundId,
    };
  } catch {
    return null;
  }
}

/** إنشاء قناة الصوت المطلوبة فقط (القنوات في أندرويد ثابتة بعد إنشائها) */
async function ensureChannel(native: NativeApi, soundId: SoundId) {
  const channel = CHANNELS[soundId];
  try {
    await native.createChannel({
      id: channel.id,
      name: channel.name,
      description: "تنبيهات دورية للصلاة على النبي ﷺ",
      importance: 5,
      visibility: 1,
      sound: channel.sound,
      vibration: true,
    });
    log("Channel created:", channel.id, "sound:", channel.sound);
  } catch (error) {
    log("createChannel failed (may be unsupported platform)", error);
  }
}

/** إلغاء كل تنبيهات تِبْيَان المجدولة على الجهاز */
async function cancelNative(native: NativeApi) {
  try {
    const pending = await native.getPending();
    const ours = pending.notifications.filter((n) => n.id >= ID_BASE && n.id < ID_BASE + 100000);
    if (ours.length) {
      await native.cancel({ notifications: ours.map((n) => ({ id: n.id })) });
      log("Cancelled", ours.length, "pending notifications");
    }
  } catch (error) {
    log("cancel failed", error);
  }
}

async function futurePendingCount(native: NativeApi): Promise<number> {
  try {
    const pending = await native.getPending();
    return pending.notifications.filter((n) => n.id >= ID_BASE).length;
  } catch {
    return 0;
  }
}

/** جدولة دفعة تنبيهات مستقبلية على نظام أندرويد — تعمل بعد إغلاق التطبيق */
async function scheduleNative(
  native: NativeApi,
  options: ScheduleOptions,
): Promise<ScheduleResult> {
  log("Native detected");
  let permission = await native.checkPermissions();
  if (permission.display !== "granted") {
    permission = await native.requestPermissions();
  }
  log("Permission:", permission.display);
  if (permission.display !== "granted") {
    return {
      success: false,
      permissionDenied: true,
      reason: "لم يُمنح تصريح الإشعارات. افتح إعدادات الإشعارات وفعّلها لتِبْيَان.",
    };
  }

  await ensureChannel(native, options.soundId);
  await cancelNative(native);

  const channel = CHANNELS[options.soundId];
  const stepMs = options.minutes * 60 * 1000;
  const start = Date.now() + stepMs;
  const notifications = Array.from({ length: BATCH_SIZE }, (_, index) => ({
    id: ID_BASE + index,
    title: "تِبْيَان",
    body: options.body,
    channelId: channel.id,
    sound: channel.sound,
    smallIcon: "ic_stat_icon",
    ongoing: false,
    autoCancel: true,
    schedule: {
      at: new Date(start + index * stepMs),
      allowWhileIdle: true,
    },
  }));

  log("Scheduling", notifications.length, "notifications every", options.minutes, "min");
  try {
    await native.schedule({ notifications });
  } catch (error) {
    log("schedule failed", error);
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, reason: `تعذّرت الجدولة: ${message}` };
  }

  const firstAt = new Date(start);
  log("First notification at", firstAt.toISOString());
  log("Pending notifications:", await futurePendingCount(native));
  return { success: true, firstAt };
}

export async function schedule(options: ScheduleOptions): Promise<ScheduleResult> {
  if (!isBrowser()) return { success: false, reason: "غير متاح" };
  await stopWebTimer();
  saveState(options);

  const native = await loadNative();
  if (native) {
    const result = await scheduleNative(native, options);
    if (!result.success) saveState(null);
    return result;
  }

  // المتصفح فقط: مؤقّت يعمل أثناء فتح الصفحة (لا يُستخدم على أندرويد)
  await unlockAudio();
  const granted = await requestPermission();
  webTimer = setInterval(
    () => {
      void playReminderSound(options.soundId);
      if (granted) {
        try {
          new Notification("تِبْيَان", { body: options.body });
        } catch {
          // تم سحب الصلاحية
        }
      }
    },
    options.minutes * 60 * 1000,
  );
  return {
    success: true,
    firstAt: new Date(Date.now() + options.minutes * 60 * 1000),
    ...(granted ? {} : { reason: "التذكير يعمل أثناء فتح الصفحة فقط في المتصفح" }),
  };
}

async function stopWebTimer() {
  if (webTimer) {
    clearInterval(webTimer);
    webTimer = undefined;
  }
}

export async function cancelAll(opts?: { keepState?: boolean }): Promise<void> {
  await stopWebTimer();
  if (!opts?.keepState) saveState(null);
  const native = await loadNative();
  if (native) await cancelNative(native);
  log("Reminders cancelled");
}

/** عدد التنبيهات المستقبلية المجدولة فعلاً (للتشخيص/العرض) */
export async function pendingCount(): Promise<number> {
  const native = await loadNative();
  if (!native) return webTimer ? 1 : 0;
  return futurePendingCount(native);
}

/**
 * فحص الجدولة وإعادة ملئها عند إقلاع التطبيق وعند عودته من الخلفية،
 * وبعد إعادة تشغيل الجهاز (يعيد المكوّن الأصلي التنبيهات، وهذا يكمل ما نقص).
 * تُستدعى مرة واحدة من جذر التطبيق.
 */
export function initBackgroundReminders(): () => void {
  if (!isBrowser()) return () => {};

  const rearm = async () => {
    const state = readState();
    if (!state) return;
    const native = await loadNative();
    if (!native) return;
    try {
      const permission = await native.checkPermissions();
      if (permission.display !== "granted") {
        log("rearm skipped — permission:", permission.display);
        return;
      }
      const remaining = await futurePendingCount(native);
      log("Pending notifications:", remaining);
      if (remaining >= REFILL_THRESHOLD) return;
      log("Refilling batch…");
      await scheduleNative(native, state);
    } catch (error) {
      log("rearm failed", error);
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
      const resume = await App.addListener("resume", () => {
        void rearm();
      });
      cleanup = () => {
        void handle.remove();
        void resume.remove();
      };
    } catch (error) {
      log("app listener failed", error);
    }
  })();

  return () => cleanup();
}
