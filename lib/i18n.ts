/** All UI copy lives here (EN + BM). Copywriter/designer edits this file only. */
export type Lang = "en" | "bm";

export const dict = {
  appName: { en: "Jalan Pulang", bm: "Jalan Pulang" },
  tagline: {
    en: "Plan your balik kampung drive: toll, stops, best time. No login. Your location stays on your phone.",
    bm: "Rancang perjalanan balik kampung: tol, hentian, masa terbaik. Tanpa log masuk. Lokasi anda kekal dalam telefon anda.",
  },
  langToggle: { en: "Bahasa Melayu", bm: "English" },
  step: { en: "Step {n} of 3", bm: "Langkah {n} daripada 3" },
  stepPlan: { en: "Plan", bm: "Rancang" },
  stepRoad: { en: "Road", bm: "Jalan" },
  stepGo: { en: "Go", bm: "Mula" },
  back: { en: "Back", bm: "Kembali" },
  next: { en: "Next", bm: "Seterusnya" },
  route: { en: "Route", bm: "Laluan" },

  // plan
  departure: { en: "Departure", bm: "Bertolak" },
  vehicle: { en: "Vehicle", bm: "Kenderaan" },
  petrol: { en: "Petrol", bm: "Petrol" },
  ev: { en: "Electric (EV)", bm: "Elektrik (EV)" },
  range: { en: "Range at departure (km)", bm: "Jarak boleh dilalui semasa bertolak (km)" },
  maxDrive: { en: "Max driving before a break", bm: "Masa memandu maksimum sebelum rehat" },
  minutes: { en: "{n} min", bm: "{n} min" },
  needs: { en: "I need a stop with", bm: "Saya perlukan hentian dengan" },
  surau: { en: "Surau", bm: "Surau" },
  toilet: { en: "Toilet", bm: "Tandas" },
  food: { en: "Food", bm: "Makanan" },
  fuel: { en: "Fuel", bm: "Minyak" },
  evCharger: { en: "EV charger", bm: "Pengecas EV" },
  atm: { en: "ATM", bm: "ATM" },
  prayerAware: { en: "Plan around prayer times (Zohor, Asar, Maghrib)", bm: "Rancang mengikut waktu solat (Zohor, Asar, Maghrib)" },

  // toll
  tollTitle: { en: "Toll", bm: "Tol" },
  tollEntry: { en: "Enter at", bm: "Masuk di" },
  tollExit: { en: "Exit at", bm: "Keluar di" },
  tollTotal: { en: "Toll: RM {n}", bm: "Tol: RM {n}" },
  tollClass: { en: "For {c}. Treat as an estimate until verified.", bm: "Untuk {c}. Anggaran sehingga disahkan." },
  tollUnknown: { en: "Fare not confirmed yet. Check with PLUS.", bm: "Kadar tol belum disahkan. Semak dengan PLUS." },
  tollWrongWay: { en: "Exit must be after entry (northbound).", bm: "Tol keluar mesti selepas tol masuk (arah utara)." },
  checkPlus: { en: "Check with PLUS", bm: "Semak dengan PLUS" },

  // leave time
  leaveTitle: { en: "Best time to leave", bm: "Masa terbaik untuk bertolak" },
  leaveBest: { en: "Leave around {t} (about {d})", bm: "Bertolak sekitar {t} (lebih kurang {d})" },
  leaveEstimateNote: { en: "Rough festive-day pattern, not live traffic. For the official advisory see PLUS MyPLUS-TTA.", bm: "Corak kasar hari perayaan, bukan trafik masa nyata. Untuk nasihat rasmi lihat PLUS MyPLUS-TTA." },
  festiveDay: { en: "Festive peak day", bm: "Hari puncak perayaan" },
  normalDay: { en: "Normal day", bm: "Hari biasa" },
  addCalendar: { en: "Save to calendar", bm: "Simpan ke kalendar" },
  useThisTime: { en: "Use this time", bm: "Guna masa ini" },

  // road
  planTitle: { en: "Your stops", bm: "Hentian anda" },
  planNone: { en: "No stop needed. Drive straight through.", bm: "Tiada hentian diperlukan. Terus memandu." },
  arrive: { en: "Arrive about {t}", bm: "Tiba sekitar {t}" },
  totalTime: { en: "Total {d} incl. stops", bm: "Jumlah {d} termasuk hentian" },
  kmFromStart: { en: "km {n}", bm: "km {n}" },
  stopAt: { en: "{t} · stay {m} min", bm: "{t} · berhenti {m} min" },
  reason_charge: { en: "charge", bm: "cas" },
  reason_refuel: { en: "refuel", bm: "isi minyak" },
  reason_break: { en: "rest", bm: "rehat" },
  reason_pray: { en: "pray {p}", bm: "solat {p}" },
  allStops: { en: "All R&R and lay-bys on this route", bm: "Semua R&R dan hentian sebelah di laluan ini" },
  facilitiesUnknown: { en: "Dashed = not confirmed. We only count a facility when a source says it exists.", bm: "Garis putus = belum disahkan. Kami hanya kira kemudahan yang disahkan sumber." },
  infeasible: { en: "We couldn't make a plan", bm: "Pelan tidak dapat dibuat" },
  weatherTitle: { en: "Weather on the way", bm: "Cuaca sepanjang jalan" },
  weatherNone: { en: "No land weather warnings for this route right now.", bm: "Tiada amaran cuaca darat untuk laluan ini sekarang." },
  weatherBestEffort: { en: "Matched by place name (best-effort).", bm: "Dipadankan mengikut nama tempat (anggaran terbaik)." },
  forecastFor: { en: "Forecast for {d}", bm: "Ramalan untuk {d}" },
  prayerTitle: { en: "Prayer times", bm: "Waktu solat" },

  // go
  goTitle: { en: "Start driving", bm: "Mula memandu" },
  goExplain: { en: "We don't do turn-by-turn. Google Maps or Waze will guide you; your stops are added for you.", bm: "Kami tidak beri arah selekoh demi selekoh. Google Maps atau Waze akan memandu anda; hentian anda dimasukkan." },
  navGoogle: { en: "Navigate in Google Maps", bm: "Navigasi dengan Google Maps" },
  navWaze: { en: "Navigate in Waze", bm: "Navigasi dengan Waze" },
  wazeLegs: { en: "Waze takes one stop at a time:", bm: "Waze ambil satu hentian pada satu masa:" },
  leg: { en: "Leg {n}: {name}", bm: "Bahagian {n}: {name}" },
  liveTitle: { en: "On the road", bm: "Di jalan raya" },
  locationBadge: { en: "Location stays on your phone", bm: "Lokasi kekal dalam telefon anda" },
  useGps: { en: "Use my location", bm: "Guna lokasi saya" },
  stopGps: { en: "Stop", bm: "Henti" },
  simulate: { en: "Simulate drive", bm: "Simulasi pemanduan" },
  nextStop: { en: "Next R&R in {n} km: {name}", bm: "R&R seterusnya dalam {n} km: {name}" },
  nextToll: { en: "Toll plaza ahead in {n} km: {name}", bm: "Plaza tol dalam {n} km: {name}" },
  offRoute: { en: "You seem to be {n} km off this route.", bm: "Anda kelihatan {n} km di luar laluan ini." },
  arrived: { en: "You've reached the end of the route.", bm: "Anda telah sampai ke penghujung laluan." },
  gpsDenied: { en: "Location permission was denied. Use Simulate drive instead.", bm: "Kebenaran lokasi ditolak. Guna Simulasi pemanduan." },
  share: { en: "Share trip card", bm: "Kongsi kad perjalanan" },
  emergencyTitle: { en: "Breakdown & emergency", bm: "Kerosakan & kecemasan" },

  // misc
  dataPrivacy: { en: "Data & privacy", bm: "Data & privasi" },
  offline: { en: "Offline · showing data from {t}", bm: "Luar talian · data dari {t}" },
  loading: { en: "Loading…", bm: "Memuatkan…" },
  error: { en: "Couldn't load. Showing last saved data.", bm: "Gagal dimuatkan. Memaparkan data terakhir." },
  retry: { en: "Try again", bm: "Cuba lagi" },
  unverified: { en: "unverified", bm: "belum disahkan" },

  // tester mode
  testerTitle: { en: "Tester tasks", bm: "Tugasan penguji" },
  task1: { en: "How much is the toll KL → Ipoh?", bm: "Berapakah tol KL → Ipoh?" },
  task2: { en: "Find an R&R with a surau and an EV charger", bm: "Cari R&R dengan surau dan pengecas EV" },
  task3: { en: "Start navigation", bm: "Mulakan navigasi" },
  taskDone: { en: "Done", bm: "Selesai" },
  feedbackQ: { en: "What was confusing? (optional, anonymous)", bm: "Apa yang mengelirukan? (pilihan, tanpa nama)" },
  send: { en: "Send", bm: "Hantar" },
  thanks: { en: "Thank you!", bm: "Terima kasih!" },
  "live": { en: "live", bm: "langsung" },
  "cached": { en: "cached", bm: "salinan tersimpan" },
  "estimate": { en: "estimate", bm: "anggaran" },
  "stale": { en: "stale", bm: "data lama" },
  "statusOffline": { en: "offline", bm: "luar talian" },
  "streetMap": { en: "Open street map", bm: "Buka peta jalan" },
  "map": { en: "Route map", bm: "Peta laluan" },
  "mapUnavailable": { en: "Route outline · street map unavailable", bm: "Garisan laluan · peta jalan tidak tersedia" },
  "plannedPlazas": { en: "Planned drive: {entry} to {exit}.", bm: "Laluan dirancang: {entry} ke {exit}." },
  "classOne": { en: "Class 1 · private car", bm: "Kelas 1 · kereta persendirian" },
  "predictionNote": { en: "Traffic prediction saved for this date.", bm: "Ramalan trafik yang disimpan untuk tarikh ini." },
  "unavailable": { en: "Data unavailable.", bm: "Data tidak tersedia." },
  "weatherCachedNone": { en: "No matching warnings in the saved data. Current conditions are unknown.", bm: "Tiada amaran sepadan dalam data tersimpan. Keadaan semasa tidak diketahui." },
  "weatherSnapshotCached": { en: "Weather data saved earlier", bm: "Data cuaca tersimpan" },
  "weatherSnapshotWarning": { en: "Weather warning on the corridor", bm: "Amaran cuaca di sepanjang laluan" },
  "issued": { en: "Issued", bm: "Dikeluarkan" },
  "forecastNone": { en: "No forecast for this date.", bm: "Tiada ramalan untuk tarikh ini." },
  "zonesNote": { en: "Prayer zones along the highway are approximate.", bm: "Zon solat di sepanjang lebuh raya adalah anggaran." },
  "approxPrayer": { en: "Approximate prayer timetable", bm: "Jadual waktu solat anggaran" },
  "prayerPlanningNote": { en: "The planner uses the common prayer window across the route. Check the local zone when you stop.", bm: "Perancang menggunakan waktu solat yang bertindih di sepanjang laluan. Semak zon setempat apabila berhenti." },
  "plan_range": { en: "The confirmed fuel or charging stops are too far apart for this range.", bm: "Jarak antara stesen minyak atau pengecas yang disahkan melebihi jarak kenderaan." },
  "plan_max-driving": { en: "The gap between stops exceeds your break interval. Try a longer interval.", bm: "Jarak antara hentian melebihi sela rehat anda. Cuba sela yang lebih panjang." },
  "plan_needs": { en: "The available stops cannot meet these needs. Try different facilities or a longer range.", bm: "Hentian yang tersedia tidak dapat memenuhi keperluan ini. Cuba kemudahan lain atau jarak yang lebih panjang." },
  "plan_prayer": { en: "No confirmed surau fits the prayer window. Try a different departure time.", bm: "Tiada surau yang disahkan menepati waktu solat. Cuba waktu bertolak yang lain." },
  "plan_no-stops": { en: "There are no confirmed stops for this plan.", bm: "Tiada hentian yang disahkan untuk pelan ini." },
  "steps": { en: "Trip steps", bm: "Langkah perjalanan" },
  "stopSimulation": { en: "Stop simulation", bm: "Henti simulasi" },
  "simulation": { en: "Simulated drive", bm: "Simulasi pemanduan" },
  "tollIfExit": { en: "Class 1 if you exit here: RM {n}", bm: "Kelas 1 jika keluar di sini: RM {n}" },
  "completed": { en: "Completed", bm: "Selesai" },
  "eventFailed": { en: "Couldn’t save. Please try again.", bm: "Gagal disimpan. Sila cuba lagi." },
  "copied": { en: "Copied", bm: "Disalin" },
  "shareFailed": { en: "Couldn’t complete that action.", bm: "Tindakan gagal diselesaikan." },
  "shareOrSave": { en: "Share or save image", bm: "Kongsi atau simpan imej" },
  "copyCaption": { en: "Copy caption", bm: "Salin kapsyen" },
  "caption": { en: "Caption", bm: "Kapsyen" },
  "shareEmpty": { en: "Create a trip in Plan → Road → Go to generate your card.", bm: "Buat perjalanan dalam Rancang → Jalan → Mula untuk menjana kad." },
  "backToPlan": { en: "Back to Plan", bm: "Kembali ke Rancang" },
  "testerQr": { en: "Tester QR code", bm: "Kod QR penguji" },
  "testLink": { en: "Open tester mode", bm: "Buka mod penguji" },
  "adviceNote": { en: "Rough pattern for the selected day type. See the operator’s travel advisory in the PLUS app.", bm: "Corak anggaran untuk jenis hari yang dipilih. Lihat nasihat perjalanan dalam aplikasi PLUS." },
  "gpsUnavailable": { en: "Location is unavailable. Use Simulate drive instead.", bm: "Lokasi tidak tersedia. Guna Simulasi pemanduan." },
} as const;

export type Key = keyof typeof dict;

export function t(lang: Lang, key: Key, vars?: Record<string, string | number>) {
  let s: string = dict[key][lang];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

export function fmtTime(d: Date) {
  return d.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kuala_Lumpur" });
}
export function fmtDur(min: number) {
  const total = Math.round(min);
  const h = Math.floor(total / 60), m = total % 60;
  return h ? `${h} h ${m} min` : `${m} min`;
}

const englishForecasts: Record<string, string> = {
  "tiada hujan": "No rain",
  "hujan di beberapa tempat": "Rain in some areas",
  "hujan di kebanyakan tempat": "Rain in most areas",
  "hujan di satu dua tempat": "Rain in one or two areas",
  "ribut petir di beberapa tempat": "Thunderstorms in some areas",
  "ribut petir di kebanyakan tempat": "Thunderstorms in most areas",
  "ribut petir di satu dua tempat": "Thunderstorms in one or two areas",
  "ribut petir menyeluruh": "Widespread thunderstorms",
};

export function forecastSummary(lang: Lang, value: string) {
  return lang === "en" ? englishForecasts[value.trim().toLowerCase()] ?? value : value;
}