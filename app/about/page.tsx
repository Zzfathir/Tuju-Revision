import { t } from "@/lib/i18n";

export default async function About({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const lang = (await searchParams).lang === "bm" ? "bm" : "en";
  const bm = lang === "bm";
  return <main className="page stack" lang={lang} data-testid="screen-about">
    <h1>{t(lang, "dataPrivacy")}</h1>
    <p>{t(lang, "tagline")}</p>
    <h2>{bm ? "Sumber perjalanan" : "Trip sources"}</h2>
    <ul>
      <li>{bm ? "Laluan dikira awal menggunakan OSRM. Peta dan titik hentian menggunakan " : "The route was calculated offline with OSRM. The map and stop locations use "}<a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>.</li>
      <li><a href="https://www.plus.com.my/#toll-fare-calculator">PLUS</a> {bm ? "membekalkan kadar tol yang disahkan. Kemudahan yang telah disemak dirujuk kepada" : "supplies confirmed toll fares. Verified facilities link to the"} <a href="https://www.plus.com.my/our-facilities/">{bm ? "direktori PLUS" : "PLUS directory"}</a>.</li>
      <li><a href="https://data.gov.my/data-catalogue/weather_warning">MET Malaysia</a> {bm ? "membekalkan cuaca. Nama tempat dalam amaran dipadankan dengan kawasan laluan." : "supplies weather. Warning place names are matched against the corridor."}</li>
      <li><a href="https://www.e-solat.gov.my/">JAKIM e-Solat</a> {bm ? "membekalkan jadual waktu solat. Jadual anggaran ditandakan." : "supplies prayer times. Approximate times are labelled."}</li>
      <li>{bm ? "Waktu bertolak ialah anggaran berdasarkan corak harian atau ramalan Google Routes yang telah disimpan." : "Departure advice uses an estimated daily pattern or a saved Google Routes prediction."}</li>
    </ul>
    <h2>{bm ? "Privasi" : "Privacy"}</h2>
    <p>{bm ? "Pelayar memproses GPS dan menyimpan kad perjalanan dalam tab ini. Kami menyimpan kiraan penggunaan dan maklum balas pilihan. Jangan masukkan nama atau butiran hubungan." :
      "Your browser processes GPS and saves your trip card in this tab. We store usage totals and optional written feedback. Leave names and contact details out of feedback."}</p>
    <p>{bm ? "Peta jalan dimuatkan daripada penyedia jubin peta. Google Maps atau Waze menerima destinasi dan hentian apabila anda membuka pautan." :
      "The street map loads from the map tile provider. Google Maps or Waze receives the destination and stops when you open a navigation link."}</p>
    <p>{bm ? "Ketibaan kumpulan menyimpan nama panggilan, laporan ketibaan dan butiran acara supaya tetamu dengan pautan jemputan boleh membaca kemas kini. Pautan ditutup dua hari selepas waktu mula acara." :
      "Group Arrival stores nicknames, arrival reports and event details so guests with the invite link can see updates. Event links close two days after the scheduled start."}</p>
    <a href="/plan" className="btn">{t(lang, "backToPlan")}</a>
  </main>;
}
