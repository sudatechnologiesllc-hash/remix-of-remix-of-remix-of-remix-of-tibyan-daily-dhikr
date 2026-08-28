# بناء تطبيق تِبْيَان لأندرويد (على VPS أو جهازك)

## 1) المتطلبات على السيرفر

```bash
# Node 20+ و Java 21 (مطلوب لـ Capacitor 8 / AGP 8.x)
sudo apt update
sudo apt install -y unzip curl openjdk-21-jdk
java -version   # يجب أن يظهر 21

# Android SDK (command line tools)
sudo mkdir -p /opt/android-sdk && sudo chown -R $USER /opt/android-sdk
cd /opt/android-sdk
curl -o cmdline-tools.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip -q cmdline-tools.zip && mkdir -p cmdline-tools/latest
mv cmdline-tools/* cmdline-tools/latest/ 2>/dev/null || true

# متغيرات البيئة (أضفها إلى ~/.bashrc)
export ANDROID_HOME=/opt/android-sdk
export ANDROID_SDK_ROOT=$ANDROID_HOME
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools

yes | sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0"
```

## 2) جلب المشروع وتثبيت الحزم

```bash
git clone <رابط-المستودع> tibyan && cd tibyan
npm install
```

## 3) بناء الواجهة ومزامنة أندرويد

```bash
npm run android
# = npm run build:mobile && npx cap sync android
```

`build:mobile` ينتج SPA في `dist` (مع hash router) و`cap sync` ينسخها إلى
`android/app/src/main/assets/public` ويحدّث المكوّنات الإضافية.

## 4) بناء APK

```bash
cd android
chmod +x gradlew
./gradlew assembleDebug          # نسخة تجريبية للتثبيت المباشر
# الناتج: android/app/build/outputs/apk/debug/app-debug.apk
```

### نسخة موقّعة للنشر (Release)

```bash
# 1. أنشئ مفتاح توقيع (مرة واحدة، احفظه خارج Git)
keytool -genkey -v -keystore ~/tibyan.keystore -alias tibyan \
  -keyalg RSA -keysize 2048 -validity 10000

# 2. أنشئ android/keystore.properties (لا تضعه في Git)
cat > android/keystore.properties <<'EOF'
storeFile=/home/USER/tibyan.keystore
storePassword=****
keyAlias=tibyan
keyPassword=****
EOF

# 3. ابنِ
cd android
./gradlew assembleRelease   # أو bundleRelease لملف AAB لمتجر Play
```

> ملاحظة: قالب Capacitor لا يقرأ `keystore.properties` تلقائياً. لتوقيع
> Release أضف `signingConfigs` في `android/app/build.gradle`، أو وقّع يدوياً
> عبر `apksigner` بعد `assembleRelease`.

## 5) التثبيت على الهاتف

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
# أو انقل ملف APK إلى الهاتف وثبّته يدوياً
```

## بعد التثبيت: تحقّق من التذكيرات

1. افتح صفحة **تَنْبِيهَاتُ الذِّكْر**.
2. فعّل التذكير واقبل إذن الإشعارات (Android 13+).
3. اضغط **إرسال إشعار اختبار الآن** — يجب أن يظهر إشعار مع الصوت خلال ثوانٍ.
4. إن رُفض الإذن يظهر زر **فتح إعدادات الإشعارات** لفتح إعدادات النظام مباشرة.
5. أوقف تحسين البطارية للتطبيق (Battery → Unrestricted) لضمان دقّة المواعيد.

## أشياء مهمة موجودة داخل المستودع

- `android/app/src/main/res/raw/`: `salawat.mp3`, `chime.mp3`, `silence.mp3` (أصوات القنوات).
- `android/app/src/main/res/drawable/ic_stat_icon.xml`: أيقونة شريط الإشعارات.
- صلاحيات `AndroidManifest.xml`: `POST_NOTIFICATIONS`, `SCHEDULE_EXACT_ALARM`,
  `USE_EXACT_ALARM`, `RECEIVE_BOOT_COMPLETED`, `VIBRATE`.
- `android/capacitor-cordova-android-plugins/` و`assets/public` مُستثناة من Git
  ويعيد `npx cap sync android` توليدها — لذا نفّذ الخطوة 3 قبل Gradle دائماً.

## مشاكل شائعة

| المشكلة | الحل |
| --- | --- |
| `Unsupported class file major version` | استخدم Java 21 (`sudo update-alternatives --config java`) |
| `SDK location not found` | صدّر `ANDROID_HOME` أو أنشئ `android/local.properties` بـ `sdk.dir=/opt/android-sdk` |
| شاشة بيضاء بعد التثبيت | نسيت `npm run build:mobile` قبل `cap sync` |
| لا صوت في الإشعار | حذف/إعادة تثبيت التطبيق لإعادة إنشاء القنوات، وتأكد من وجود ملفات `res/raw` |
