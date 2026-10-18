import {translateTurkishNotification} from "./notificationTurkish";

export type NotificationLocale = "en" | "de" | "es" | "ar" | "tr";

type NotificationCopy = {
  type?: string;
  title: string;
  body: string;
};

type Localized = {
  de: string;
  es: string;
  ar: string;
};

const exact: Record<string, Localized> = {
  "New app installed": {
    de: "Neue App installiert",
    es: "Nueva aplicación instalada",
    ar: "تم تثبيت تطبيق جديد",
  },
  "Permission change requested": {
    de: "Änderung einer Berechtigung angefragt",
    es: "Solicitud de cambio de permiso",
    ar: "طُلب تغيير إذن",
  },
  "More screen time requested": {
    de: "Mehr Bildschirmzeit angefragt",
    es: "Solicitud de más tiempo de pantalla",
    ar: "طُلب وقت شاشة إضافي",
  },
  "Website access requested": {
    de: "Website-Zugriff angefragt",
    es: "Solicitud de acceso a un sitio web",
    ar: "طُلب الوصول إلى موقع ويب",
  },
  "Remote control priority applied": {
    de: "Fernsteuerung hat Vorrang",
    es: "Se aplicó la prioridad del control remoto",
    ar: "تم تطبيق أولوية التحكم عن بُعد",
  },
  "Daily screen time finished": {
    de: "Tägliche Bildschirmzeit beendet",
    es: "Tiempo de pantalla diario finalizado",
    ar: "انتهى وقت الشاشة اليومي",
  },
  "App time limit reached": {
    de: "App-Zeitlimit erreicht",
    es: "Se alcanzó el límite de la aplicación",
    ar: "تم بلوغ حد وقت التطبيق",
  },
  "Blocked app attempt": {
    de: "Versuch, eine gesperrte App zu öffnen",
    es: "Intento de abrir una aplicación bloqueada",
    ar: "محاولة فتح تطبيق محظور",
  },
  "SOS Resolved": {
    de: "SOS-Alarm gelöst",
    es: "SOS resuelto",
    ar: "تم حل حالة الطوارئ",
  },
  "Emergency situation has been marked as resolved.": {
    de: "Die Notsituation wurde als gelöst markiert.",
    es: "La situación de emergencia se marcó como resuelta.",
    ar: "تم تحديد حالة الطوارئ على أنها محلولة.",
  },
  "The Remote Control command took priority over scheduled settings.": {
    de: "Der Fernsteuerungsbefehl hatte Vorrang vor den geplanten Einstellungen.",
    es: "La orden del control remoto tuvo prioridad sobre los ajustes programados.",
    ar: "أخذ أمر التحكم عن بُعد الأولوية على الإعدادات المجدولة.",
  },
  "Remote Unlock took priority over active scheduled lock settings.": {
    de: "Die Fernentsperrung hatte Vorrang vor dem aktiven Sperrplan.",
    es: "El desbloqueo remoto tuvo prioridad sobre el bloqueo programado activo.",
    ar: "أخذ فتح القفل عن بُعد الأولوية على جدول القفل النشط.",
  },
  "Remote Lock took priority over scheduled device settings.": {
    de: "Die Fernsperre hatte Vorrang vor den geplanten Geräteeinstellungen.",
    es: "El bloqueo remoto tuvo prioridad sobre los ajustes programados del dispositivo.",
    ar: "أخذ القفل عن بُعد الأولوية على إعدادات الجهاز المجدولة.",
  },
  "The daily total screen-time limit was reached. Non-essential apps are now blocked.": {
    de: "Das tägliche Gesamtlimit der Bildschirmzeit wurde erreicht. Nicht notwendige Apps sind jetzt gesperrt.",
    es: "Se alcanzó el límite total diario de pantalla. Las aplicaciones no esenciales están bloqueadas.",
    ar: "تم بلوغ الحد اليومي الإجمالي لوقت الشاشة. التطبيقات غير الأساسية محظورة الآن.",
  },
  "Connection to the child device was lost.": {
    de: "Die Verbindung zum Kindergerät wurde unterbrochen.",
    es: "Se perdió la conexión con el dispositivo del menor.",
    ar: "انقطع الاتصال بجهاز الطفل.",
  },
  "Device has reconnected to the network.": {
    de: "Das Gerät ist wieder mit dem Netzwerk verbunden.",
    es: "El dispositivo volvió a conectarse a la red.",
    ar: "أعاد الجهاز الاتصال بالشبكة.",
  },
  "A mandatory child-app update has been published. Open Downloads to install it.": {
    de: "Ein erforderliches Update der Kinder-App wurde veröffentlicht. Öffnen Sie Downloads, um es zu installieren.",
    es: "Se publicó una actualización obligatoria de la aplicación infantil. Abre Descargas para instalarla.",
    ar: "تم نشر تحديث إلزامي لتطبيق الطفل. افتح التنزيلات لتثبيته.",
  },
  "A new child-app version is ready. Open Downloads to view the release notes.": {
    de: "Eine neue Version der Kinder-App ist bereit. Öffnen Sie Downloads, um die Versionshinweise anzuzeigen.",
    es: "Hay una nueva versión de la aplicación infantil. Abre Descargas para ver las notas de la versión.",
    ar: "إصدار جديد من تطبيق الطفل جاهز. افتح التنزيلات لعرض ملاحظات الإصدار.",
  },
  "Security Alert": {
    de: "Sicherheitswarnung",
    es: "Alerta de seguridad",
    ar: "تنبيه أمني",
  },
  "Permission Alert": {
    de: "Berechtigungswarnung",
    es: "Alerta de permiso",
    ar: "تنبيه إذن",
  },
  "A required permission was disabled.": {
    de: "Eine erforderliche Berechtigung wurde deaktiviert.",
    es: "Se desactivó un permiso obligatorio.",
    ar: "تم تعطيل إذن مطلوب.",
  },
  "Someone tried to disable or remove KidsGuard protection.": {
    de: "Jemand hat versucht, den KidsGuard-Schutz zu deaktivieren oder zu entfernen.",
    es: "Alguien intentó desactivar o eliminar la protección de KidsGuard.",
    ar: "حاول شخص تعطيل حماية KidsGuard أو إزالتها.",
  },
  "KidsGuard Device Admin protection was disabled.": {
    de: "Der KidsGuard-Geräteadministratorschutz wurde deaktiviert.",
    es: "Se desactivó la protección de administrador del dispositivo de KidsGuard.",
    ar: "تم تعطيل حماية مسؤول الجهاز في KidsGuard.",
  },
  "Your weekly safety report is ready": {
    de: "Ihr wöchentlicher Sicherheitsbericht ist bereit",
    es: "Tu informe semanal de seguridad está listo",
    ar: "تقرير الأمان الأسبوعي جاهز",
  },
  "New support reply": {
    de: "Neue Support-Antwort",
    es: "Nueva respuesta de soporte",
    ar: "رد جديد من الدعم",
  },
  "🤝 Invitation Accepted": {
    de: "🤝 Einladung angenommen",
    es: "🤝 Invitación aceptada",
    ar: "🤝 تم قبول الدعوة",
  },
  "📱 New Child Paired": {
    de: "📱 Neues Kindergerät gekoppelt",
    es: "📱 Nuevo dispositivo infantil vinculado",
    ar: "📱 تم إقران جهاز طفل جديد",
  },
};

function pick(locale: NotificationLocale, values: Localized): string {
  return locale === "de" ? values.de : locale === "es" ? values.es : values.ar;
}

function dynamic(source: string, locale: NotificationLocale): string {
  if (locale === "tr") return translateTurkishNotification(source);

  const rules: Array<{
    pattern: RegExp;
    render: (parts: string[]) => Localized;
  }> = [
    {
      pattern: /^(.+?) installed (.+)\.?$/,
      render: ([child, app]) => ({
        de: `${child} hat ${app} installiert.`,
        es: `${child} instaló ${app}.`,
        ar: `قام ${child} بتثبيت ${app}.`,
      }),
    },
    {
      pattern: /^(.+?) wants to change (.+?)\. Approve or deny it from Device Health\.$/,
      render: ([child, permission]) => ({
        de: `${child} möchte ${permission} ändern. Genehmigen oder ablehnen Sie dies unter Gerätezustand.`,
        es: `${child} quiere cambiar ${permission}. Aprueba o rechaza la solicitud en Estado del dispositivo.`,
        ar: `يريد ${child} تغيير ${permission}. وافق على الطلب أو ارفضه من حالة الجهاز.`,
      }),
    },
    {
      pattern: /^(.+?) requested more time for (.+?)\.$/,
      render: ([child, app]) => ({
        de: `${child} hat mehr Zeit für ${app} angefragt.`,
        es: `${child} solicitó más tiempo para ${app}.`,
        ar: `طلب ${child} وقتًا إضافيًا لاستخدام ${app}.`,
      }),
    },
    {
      pattern: /^(.+?) requested access to (.+?)\.$/,
      render: ([child, domain]) => ({
        de: `${child} hat Zugriff auf ${domain} angefragt.`,
        es: `${child} solicitó acceso a ${domain}.`,
        ar: `طلب ${child} الوصول إلى ${domain}.`,
      }),
    },
    {
      pattern: /^Arrived at (.+)$/,
      render: ([zone]) => ({
        de: `Ankunft bei ${zone}`,
        es: `Llegó a ${zone}`,
        ar: `وصل إلى ${zone}`,
      }),
    },
    {
      pattern: /^Entered (.+)$/,
      render: ([zone]) => ({
        de: `${zone} betreten`,
        es: `Entró en ${zone}`,
        ar: `دخل ${zone}`,
      }),
    },
    {
      pattern: /^Left (.+)$/,
      render: ([zone]) => ({
        de: `${zone} verlassen`,
        es: `Salió de ${zone}`,
        ar: `غادر ${zone}`,
      }),
    },
    {
      pattern: /^(.+?) arrived at (.+?)\.?$/,
      render: ([child, zone]) => ({
        de: `${child} ist bei ${zone} angekommen.`,
        es: `${child} llegó a ${zone}.`,
        ar: `وصل ${child} إلى ${zone}.`,
      }),
    },
    {
      pattern: /^(.+?) left (.+?)\.?$/,
      render: ([child, zone]) => ({
        de: `${child} hat ${zone} verlassen.`,
        es: `${child} salió de ${zone}.`,
        ar: `غادر ${child} ${zone}.`,
      }),
    },
    {
      pattern: /^(.+?) reached today's time limit and was blocked\.$/,
      render: ([app]) => ({
        de: `${app} hat das heutige Zeitlimit erreicht und wurde gesperrt.`,
        es: `${app} alcanzó el límite de hoy y se bloqueó.`,
        ar: `بلغ ${app} الحد الزمني لليوم وتم حظره.`,
      }),
    },
    {
      pattern: /^(.+?) was opened on the child device and KidsGuard blocked it\.$/,
      render: ([app]) => ({
        de: `${app} wurde auf dem Kindergerät geöffnet und von KidsGuard gesperrt.`,
        es: `${app} se abrió en el dispositivo del menor y KidsGuard la bloqueó.`,
        ar: `تم فتح ${app} على جهاز الطفل وقام KidsGuard بحظره.`,
      }),
    },
    {
      pattern: /^Emergency SOS from (.+)$/,
      render: ([child]) => ({
        de: `Notfall-SOS von ${child}`,
        es: `SOS de emergencia de ${child}`,
        ar: `نداء طوارئ من ${child}`,
      }),
    },
    {
      pattern: /^(.+?) may need help\. Current location received\.$/,
      render: ([child]) => ({
        de: `${child} benötigt möglicherweise Hilfe. Der aktuelle Standort wurde empfangen.`,
        es: `${child} puede necesitar ayuda. Se recibió la ubicación actual.`,
        ar: `قد يحتاج ${child} إلى المساعدة. تم استلام الموقع الحالي.`,
      }),
    },
    {
      pattern: /^(.+?)\. Current location received\.$/,
      render: ([message]) => ({
        de: `${message}. Der aktuelle Standort wurde empfangen.`,
        es: `${message}. Se recibió la ubicación actual.`,
        ar: `${message}. تم استلام الموقع الحالي.`,
      }),
    },
    {
      pattern: /^🪫 Critical Battery: (.+)$/,
      render: ([child]) => ({
        de: `🪫 Kritischer Akkustand: ${child}`,
        es: `🪫 Batería crítica: ${child}`,
        ar: `🪫 بطارية حرجة: ${child}`,
      }),
    },
    {
      pattern: /^🔋 Low Battery: (.+)$/,
      render: ([child]) => ({
        de: `🔋 Niedriger Akkustand: ${child}`,
        es: `🔋 Batería baja: ${child}`,
        ar: `🔋 البطارية منخفضة: ${child}`,
      }),
    },
    {
      pattern: /^(.+?)'s device is at (\d+)%\. Charge immediately\.$/,
      render: ([child, percent]) => ({
        de: `Der Akku von ${child}s Gerät liegt bei ${percent} %. Bitte sofort aufladen.`,
        es: `El dispositivo de ${child} tiene un ${percent} % de batería. Cárgalo inmediatamente.`,
        ar: `بطارية جهاز ${child} عند ${percent}٪. اشحنه فورًا.`,
      }),
    },
    {
      pattern: /^(.+?)'s device is at (\d+)%\.$/,
      render: ([child, percent]) => ({
        de: `Der Akku von ${child}s Gerät liegt bei ${percent} %.`,
        es: `El dispositivo de ${child} tiene un ${percent} % de batería.`,
        ar: `بطارية جهاز ${child} عند ${percent}٪.`,
      }),
    },
    {
      pattern: /^☁️ (.+?) is Offline$/,
      render: ([child]) => ({
        de: `☁️ ${child} ist offline`,
        es: `☁️ ${child} está sin conexión`,
        ar: `☁️ جهاز ${child} غير متصل`,
      }),
    },
    {
      pattern: /^🌐 (.+?) is Online$/,
      render: ([child]) => ({
        de: `🌐 ${child} ist online`,
        es: `🌐 ${child} está en línea`,
        ar: `🌐 جهاز ${child} متصل`,
      }),
    },
    {
      pattern: /^(.+?) is offline$/i,
      render: ([child]) => ({
        de: `${child} ist offline`,
        es: `${child} está sin conexión`,
        ar: `جهاز ${child} غير متصل`,
      }),
    },
    {
      pattern: /^(.+?) is back online$/i,
      render: ([child]) => ({
        de: `${child} ist wieder online`,
        es: `${child} volvió a conectarse`,
        ar: `عاد جهاز ${child} للاتصال`,
      }),
    },
    {
      pattern: /^(.+?)'s device has been offline since (.+?) \((.+?)\)\.$/,
      render: ([child, since, duration]) => ({
        de: `${child}s Gerät ist seit ${since} offline (${duration}).`,
        es: `El dispositivo de ${child} está sin conexión desde ${since} (${duration}).`,
        ar: `جهاز ${child} غير متصل منذ ${since} (${duration}).`,
      }),
    },
    {
      pattern: /^(.+?)'s device reconnected at (.+?) after being offline for (.+?)\.$/,
      render: ([child, time, duration]) => ({
        de: `${child}s Gerät wurde um ${time} wieder verbunden, nachdem es ${duration} offline war.`,
        es: `El dispositivo de ${child} se reconectó a las ${time} después de estar sin conexión durante ${duration}.`,
        ar: `أعاد جهاز ${child} الاتصال عند ${time} بعد انقطاع دام ${duration}.`,
      }),
    },
    {
      pattern: /^Sync problem on (.+?)'s device$/,
      render: ([child]) => ({
        de: `Synchronisierungsproblem auf ${child}s Gerät`,
        es: `Problema de sincronización en el dispositivo de ${child}`,
        ar: `مشكلة مزامنة على جهاز ${child}`,
      }),
    },
    {
      pattern: /^(.+?) failed to sync (\d+) times\. Open Device Health for details\.$/,
      render: ([source, count]) => ({
        de: `${source} konnte ${count}-mal nicht synchronisiert werden. Öffnen Sie den Gerätezustand für Details.`,
        es: `${source} no pudo sincronizarse ${count} veces. Abre Estado del dispositivo para ver los detalles.`,
        ar: `فشلت مزامنة ${source} عدد ${count} مرات. افتح حالة الجهاز للتفاصيل.`,
      }),
    },
    {
      pattern: /^KidsGuard v(.+?) update required$/,
      render: ([version]) => ({
        de: `Update auf KidsGuard v${version} erforderlich`,
        es: `Se requiere actualizar a KidsGuard v${version}`,
        ar: `يلزم تحديث KidsGuard إلى الإصدار v${version}`,
      }),
    },
    {
      pattern: /^KidsGuard v(.+?) is available$/,
      render: ([version]) => ({
        de: `KidsGuard v${version} ist verfügbar`,
        es: `KidsGuard v${version} está disponible`,
        ar: `يتوفر KidsGuard v${version}`,
      }),
    },
    {
      pattern: /^(.+?) has joined the family vault as a (.+?)\.$/,
      render: ([email, role]) => ({
        de: `${email} ist dem Familientresor als ${role} beigetreten.`,
        es: `${email} se unió a la bóveda familiar como ${role}.`,
        ar: `انضم ${email} إلى خزنة العائلة بصفة ${role}.`,
      }),
    },
    {
      pattern: /^(.+?) has been successfully linked to your family vault\.$/,
      render: ([child]) => ({
        de: `${child} wurde erfolgreich mit Ihrem Familientresor verknüpft.`,
        es: `${child} se vinculó correctamente a tu bóveda familiar.`,
        ar: `تم ربط ${child} بخزنة عائلتك بنجاح.`,
      }),
    },
    {
      pattern: /^🛡️ Mode Activated: (.+)$/,
      render: ([mode]) => ({
        de: `🛡️ Modus aktiviert: ${mode}`,
        es: `🛡️ Modo activado: ${mode}`,
        ar: `🛡️ تم تفعيل الوضع: ${mode}`,
      }),
    },
    {
      pattern: /^Protection rules for (.+?) are now active\.$/,
      render: ([type]) => ({
        de: `Die Schutzregeln für ${type} sind jetzt aktiv.`,
        es: `Las reglas de protección para ${type} están activas.`,
        ar: `قواعد الحماية لـ ${type} نشطة الآن.`,
      }),
    },
    {
      pattern: /^(.+?): Uninstall Attempt$/,
      render: ([child]) => ({
        de: `${child}: Deinstallationsversuch`,
        es: `${child}: intento de desinstalación`,
        ar: `${child}: محاولة إلغاء التثبيت`,
      }),
    },
    {
      pattern: /^(.+?): Accessibility Disabled$/,
      render: ([child]) => ({
        de: `${child}: Bedienungshilfe deaktiviert`,
        es: `${child}: accesibilidad desactivada`,
        ar: `${child}: تم تعطيل إمكانية الوصول`,
      }),
    },
    {
      pattern: /^(.+?): Device Admin Disabled$/,
      render: ([child]) => ({
        de: `${child}: Geräteadministrator deaktiviert`,
        es: `${child}: administrador del dispositivo desactivado`,
        ar: `${child}: تم تعطيل مسؤول الجهاز`,
      }),
    },
    {
      pattern: /^(.+?): Protection Settings Changed$/,
      render: ([child]) => ({
        de: `${child}: Schutzeinstellungen geändert`,
        es: `${child}: ajustes de protección modificados`,
        ar: `${child}: تم تغيير إعدادات الحماية`,
      }),
    },
    {
      pattern: /^(.+?): Security Alert$/,
      render: ([child]) => ({
        de: `${child}: Sicherheitswarnung`,
        es: `${child}: alerta de seguridad`,
        ar: `${child}: تنبيه أمني`,
      }),
    },
    {
      pattern: /^(.+?) tried to uninstall KidsGuard\.$/,
      render: ([child]) => ({
        de: `${child} hat versucht, KidsGuard zu deinstallieren.`,
        es: `${child} intentó desinstalar KidsGuard.`,
        ar: `حاول ${child} إلغاء تثبيت KidsGuard.`,
      }),
    },
    {
      pattern: /^(.+?) turned off the KidsGuard Accessibility Service\.$/,
      render: ([child]) => ({
        de: `${child} hat den KidsGuard-Bedienungshilfedienst deaktiviert.`,
        es: `${child} desactivó el servicio de accesibilidad de KidsGuard.`,
        ar: `عطّل ${child} خدمة إمكانية الوصول في KidsGuard.`,
      }),
    },
    {
      pattern: /^(.+?) tried to disable KidsGuard device protection\.$/,
      render: ([child]) => ({
        de: `${child} hat versucht, den KidsGuard-Geräteschutz zu deaktivieren.`,
        es: `${child} intentó desactivar la protección del dispositivo de KidsGuard.`,
        ar: `حاول ${child} تعطيل حماية جهاز KidsGuard.`,
      }),
    },
    {
      pattern: /^(.+?) tried to change KidsGuard protection settings\.$/,
      render: ([child]) => ({
        de: `${child} hat versucht, die KidsGuard-Schutzeinstellungen zu ändern.`,
        es: `${child} intentó cambiar los ajustes de protección de KidsGuard.`,
        ar: `حاول ${child} تغيير إعدادات حماية KidsGuard.`,
      }),
    },
    {
      pattern: /^(.+?) tried to disable or remove KidsGuard protection\.$/,
      render: ([child]) => ({
        de: `${child} hat versucht, den KidsGuard-Schutz zu deaktivieren oder zu entfernen.`,
        es: `${child} intentó desactivar o eliminar la protección de KidsGuard.`,
        ar: `حاول ${child} تعطيل حماية KidsGuard أو إزالتها.`,
      }),
    },
    {
      pattern: /^(.+?) tried to (.+?)\.$/,
      render: ([child, action]) => ({
        de: `${child} hat versucht: ${action}.`,
        es: `${child} intentó: ${action}.`,
        ar: `حاول ${child}: ${action}.`,
      }),
    },
    {
      pattern: /^([+-]?\d+)% screen-time change · (\d+) safety alerts$/,
      render: ([percent, count]) => ({
        de: `${percent} % Änderung der Bildschirmzeit · ${count} Sicherheitswarnungen`,
        es: `${percent} % de cambio en tiempo de pantalla · ${count} alertas de seguridad`,
        ar: `تغيّر وقت الشاشة بنسبة ${percent}٪ · ${count} تنبيه أمان`,
      }),
    },
  ];

  const translatedExact = exact[source];
  if (translatedExact) return pick(locale, translatedExact);

  for (const rule of rules) {
    const match = source.match(rule.pattern);
    if (match) return pick(locale, rule.render(match.slice(1)));
  }
  return source;
}

export function resolveNotificationLocale(parent: Record<string, unknown> | undefined): NotificationLocale {
  const preferred = String(parent?.preferredLanguage || "").toLowerCase();
  if (preferred === "de" || preferred === "es" || preferred === "ar" || preferred === "tr" || preferred === "en") {
    return preferred;
  }
  const resolved = String(parent?.resolvedLanguage || "").toLowerCase();
  if (resolved === "de" || resolved === "es" || resolved === "ar" || resolved === "tr" || resolved === "en") {
    return resolved;
  }
  return "en";
}

export function localizeNotificationCopy(
  notification: NotificationCopy,
  locale: NotificationLocale
): Pick<NotificationCopy, "title" | "body"> {
  if (locale === "en") return {title: notification.title, body: notification.body};

  return {
    title: dynamic(notification.title, locale),
    // Support replies may contain a human-written message. Never machine-
    // translate or rewrite that content; only localize its standard title.
    body: notification.type === "SUPPORT_REPLY"
      ? notification.body
      : dynamic(notification.body, locale),
  };
}
