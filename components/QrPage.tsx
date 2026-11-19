"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { t } from "@/lib/i18n";

export function QrPage() {
  const [url, setUrl] = useState("");
  const [image, setImage] = useState("");
  useEffect(() => {
    const link = new URL("/?t=1", window.location.origin).href;
    setUrl(link);
    void QRCode.toDataURL(link, { width: 512, errorCorrectionLevel: "M" }).then(setImage).catch(() => {});
  }, []);
  return <main className="page stack" data-testid="screen-qr">
    <h1>{t("en", "testerQr")}</h1>
    <div>{image && <img className="print-qr" src={image} alt={t("en", "testerQr")} width={512} height={512} />}</div>
    <p><a href="/?t=1">{url || t("en", "testLink")}</a></p>
    <a href="/plan" className="btn">{t("en", "backToPlan")}</a>
  </main>;
}
