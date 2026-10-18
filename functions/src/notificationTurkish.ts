const exactTurkish: Record<string, string> = {
  "New app installed": "Yeni uygulama yüklendi",
  "Permission change requested": "İzin değişikliği istendi",
  "More screen time requested": "Daha fazla ekran süresi istendi",
  "Website access requested": "Web sitesi erişimi istendi",
  "Remote control priority applied": "Uzaktan kontrol önceliği uygulandı",
  "Daily screen time finished": "Günlük ekran süresi doldu",
  "App time limit reached": "Uygulama süre sınırına ulaşıldı",
  "Blocked app attempt": "Engellenen uygulama girişimi",
  "SOS Resolved": "SOS Çözüldü",
  "Emergency situation has been marked as resolved.": "Acil durum çözüldü olarak işaretlendi.",
  "The Remote Control command took priority over scheduled settings.": "Uzaktan Kontrol komutu, programlanmış ayarlara göre öncelikli uygulandı.",
  "Remote Unlock took priority over active scheduled lock settings.": "Uzaktan kilit açma, etkin kilit programına göre öncelikli uygulandı.",
  "Remote Lock took priority over scheduled device settings.": "Uzaktan kilitleme, programlanmış cihaz ayarlarına göre öncelikli uygulandı.",
  "The daily total screen-time limit was reached. Non-essential apps are now blocked.": "Günlük toplam ekran süresi sınırına ulaşıldı. Gerekli olmayan uygulamalar artık engellendi.",
  "Connection to the child device was lost.": "Çocuk cihazıyla bağlantı kesildi.",
  "Device has reconnected to the network.": "Cihaz ağa yeniden bağlandı.",
  "A mandatory child-app update has been published. Open Downloads to install it.": "Zorunlu bir çocuk uygulaması güncellemesi yayımlandı. Yüklemek için İndirilenler'i açın.",
  "A new child-app version is ready. Open Downloads to view the release notes.": "Çocuk uygulamasının yeni sürümü hazır. Sürüm notlarını görmek için İndirilenler'i açın.",
  "Security Alert": "Güvenlik Uyarısı",
  "Permission Alert": "İzin Uyarısı",
  "A required permission was disabled.": "Gerekli bir izin devre dışı bırakıldı.",
  "Someone tried to disable or remove KidsGuard protection.": "Birisi KidsGuard korumasını devre dışı bırakmaya veya kaldırmaya çalıştı.",
  "KidsGuard Device Admin protection was disabled.": "KidsGuard Cihaz Yöneticisi koruması devre dışı bırakıldı.",
  "Your weekly safety report is ready": "Haftalık güvenlik raporunuz hazır",
  "New support reply": "Yeni destek yanıtı",
  "🤝 Invitation Accepted": "🤝 Davet Kabul Edildi",
  "📱 New Child Paired": "📱 Yeni Çocuk Eşleştirildi",
};

type TurkishRule = {
  pattern: RegExp;
  render: (parts: string[]) => string;
};

const rules: TurkishRule[] = [
  { pattern: /^(.+?) installed (.+)\.?$/, render: ([child, app]) => `${child}, ${app.replace(/\.$/, "")} uygulamasını yükledi.` },
  { pattern: /^(.+?) wants to change (.+?)\. Approve or deny it from Device Health\.$/, render: ([child, permission]) => `${child}, ${permission} iznini değiştirmek istiyor. Cihaz Durumu bölümünden onaylayın veya reddedin.` },
  { pattern: /^(.+?) requested more time for (.+?)\.$/, render: ([child, app]) => `${child}, ${app} için daha fazla süre istedi.` },
  { pattern: /^(.+?) requested access to (.+?)\.$/, render: ([child, domain]) => `${child}, ${domain} için erişim istedi.` },
  { pattern: /^Arrived at (.+)$/, render: ([zone]) => `${zone} konumuna vardı` },
  { pattern: /^Entered (.+)$/, render: ([zone]) => `${zone} bölgesine girdi` },
  { pattern: /^Left (.+)$/, render: ([zone]) => `${zone} bölgesinden ayrıldı` },
  { pattern: /^(.+?) arrived at (.+?)\.?$/, render: ([child, zone]) => `${child}, ${zone} konumuna vardı.` },
  { pattern: /^(.+?) left (.+?)\.?$/, render: ([child, zone]) => `${child}, ${zone} bölgesinden ayrıldı.` },
  { pattern: /^(.+?) reached today's time limit and was blocked\.$/, render: ([app]) => `${app} bugünkü süre sınırına ulaştı ve engellendi.` },
  { pattern: /^(.+?) was opened on the child device and KidsGuard blocked it\.$/, render: ([app]) => `${app} çocuk cihazında açıldı ve KidsGuard tarafından engellendi.` },
  { pattern: /^Emergency SOS from (.+)$/, render: ([child]) => `${child} tarafından Acil SOS` },
  { pattern: /^(.+?) may need help\. Current location received\.$/, render: ([child]) => `${child} yardıma ihtiyaç duyabilir. Güncel konum alındı.` },
  { pattern: /^(.+?)\. Current location received\.$/, render: ([message]) => `${message}. Güncel konum alındı.` },
  { pattern: /^🪫 Critical Battery: (.+)$/, render: ([child]) => `🪫 Kritik Pil Seviyesi: ${child}` },
  { pattern: /^🔋 Low Battery: (.+)$/, render: ([child]) => `🔋 Düşük Pil Seviyesi: ${child}` },
  { pattern: /^(.+?)'s device is at (\d+)%\. Charge immediately\.$/, render: ([child, percent]) => `${child} adlı kişinin cihazının pili %${percent}. Hemen şarj edin.` },
  { pattern: /^(.+?)'s device is at (\d+)%\.$/, render: ([child, percent]) => `${child} adlı kişinin cihazının pili %${percent}.` },
  { pattern: /^☁️ (.+?) is Offline$/, render: ([child]) => `☁️ ${child} çevrimdışı` },
  { pattern: /^🌐 (.+?) is Online$/, render: ([child]) => `🌐 ${child} çevrimiçi` },
  { pattern: /^(.+?) is offline$/i, render: ([child]) => `${child} çevrimdışı` },
  { pattern: /^(.+?) is back online$/i, render: ([child]) => `${child} yeniden çevrimiçi` },
  { pattern: /^(.+?)'s device has been offline since (.+?) \((.+?)\)\.$/, render: ([child, since, duration]) => `${child} adlı kişinin cihazı ${since} zamanından beri çevrimdışı (${duration}).` },
  { pattern: /^(.+?)'s device reconnected at (.+?) after being offline for (.+?)\.$/, render: ([child, time, duration]) => `${child} adlı kişinin cihazı ${duration} çevrimdışı kaldıktan sonra ${time} zamanında yeniden bağlandı.` },
  { pattern: /^Sync problem on (.+?)'s device$/, render: ([child]) => `${child} adlı kişinin cihazında eşitleme sorunu` },
  { pattern: /^(.+?) failed to sync (\d+) times\. Open Device Health for details\.$/, render: ([source, count]) => `${source} ${count} kez eşitlenemedi. Ayrıntılar için Cihaz Durumu'nu açın.` },
  { pattern: /^KidsGuard v(.+?) update required$/, render: ([version]) => `KidsGuard v${version} güncellemesi gerekli` },
  { pattern: /^KidsGuard v(.+?) is available$/, render: ([version]) => `KidsGuard v${version} kullanıma hazır` },
  { pattern: /^(.+?) has joined the family vault as a (.+?)\.$/, render: ([email, role]) => `${email}, aile kasasına ${role} rolüyle katıldı.` },
  { pattern: /^(.+?) has been successfully linked to your family vault\.$/, render: ([child]) => `${child}, aile kasanıza başarıyla bağlandı.` },
  { pattern: /^🛡️ Mode Activated: (.+)$/, render: ([mode]) => `🛡️ Mod Etkinleştirildi: ${mode}` },
  { pattern: /^Protection rules for (.+?) are now active\.$/, render: ([type]) => `${type} için koruma kuralları artık etkin.` },
  { pattern: /^(.+?): Uninstall Attempt$/, render: ([child]) => `${child}: Kaldırma Girişimi` },
  { pattern: /^(.+?): Accessibility Disabled$/, render: ([child]) => `${child}: Erişilebilirlik Devre Dışı` },
  { pattern: /^(.+?): Device Admin Disabled$/, render: ([child]) => `${child}: Cihaz Yöneticisi Devre Dışı` },
  { pattern: /^(.+?): Protection Settings Changed$/, render: ([child]) => `${child}: Koruma Ayarları Değiştirildi` },
  { pattern: /^(.+?): Security Alert$/, render: ([child]) => `${child}: Güvenlik Uyarısı` },
  { pattern: /^(.+?) tried to uninstall KidsGuard\.$/, render: ([child]) => `${child}, KidsGuard'ı kaldırmaya çalıştı.` },
  { pattern: /^(.+?) turned off the KidsGuard Accessibility Service\.$/, render: ([child]) => `${child}, KidsGuard Erişilebilirlik Hizmeti'ni kapattı.` },
  { pattern: /^(.+?) tried to disable KidsGuard device protection\.$/, render: ([child]) => `${child}, KidsGuard cihaz korumasını devre dışı bırakmaya çalıştı.` },
  { pattern: /^(.+?) tried to change KidsGuard protection settings\.$/, render: ([child]) => `${child}, KidsGuard koruma ayarlarını değiştirmeye çalıştı.` },
  { pattern: /^(.+?) tried to disable or remove KidsGuard protection\.$/, render: ([child]) => `${child}, KidsGuard korumasını devre dışı bırakmaya veya kaldırmaya çalıştı.` },
  { pattern: /^(.+?) tried to (.+?)\.$/, render: ([child, action]) => `${child} şunu yapmaya çalıştı: ${action}.` },
  { pattern: /^([+-]?\d+)% screen-time change · (\d+) safety alerts$/, render: ([percent, count]) => `%${percent} ekran süresi değişimi · ${count} güvenlik uyarısı` },
];

export function translateTurkishNotification(source: string): string {
  const translatedExact = exactTurkish[source];
  if (translatedExact) return translatedExact;

  for (const rule of rules) {
    const match = source.match(rule.pattern);
    if (match) return rule.render(match.slice(1));
  }
  return source;
}

