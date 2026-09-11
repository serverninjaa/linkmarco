import { useRef, useState } from "react";
import { Smartphone, Tablet, Monitor, RotateCw, ExternalLink } from "lucide-react";

type Device = "mobile" | "tablet" | "desktop";

const DEVICES: { key: Device; label: string; width: number; height: number; icon: typeof Smartphone }[] = [
  { key: "mobile", label: "Mobil", width: 390, height: 720, icon: Smartphone },
  { key: "tablet", label: "Tablet", width: 820, height: 760, icon: Tablet },
  { key: "desktop", label: "Masaüstü", width: 0, height: 760, icon: Monitor }, // 0 = panel genişliği
];

/**
 * Panelde canlı cihaz önizlemesi.
 * iframe TEK KEZ mount edilir; cihaz değişiminde yalnızca sarmalayıcının genişliği
 * değişir (iframe yeniden mount edilirse boş/boyanmamış kalabiliyor). "Yenile" ise
 * aynı origin'deki iframe'i contentWindow üzerinden yeniler.
 */
export default function LiveSitePreview({ slug }: { slug: string }) {
  const [device, setDevice] = useState<Device>("mobile");
  const frameRef = useRef<HTMLIFrameElement>(null);

  const active = DEVICES.find((d) => d.key === device) ?? DEVICES[0];
  const url = `/?site=${encodeURIComponent(slug)}&preview=1`;

  const refresh = () => {
    const frame = frameRef.current;
    if (!frame) return;
    // Aynı origin: doğrudan yeniden yükle, remount yok.
    if (frame.contentWindow) frame.contentWindow.location.replace(url);
    else frame.src = url;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#1E293B] bg-[#121620] p-4">
        {DEVICES.map(({ key, label, width, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setDevice(key)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors duration-150 ${
              device === key
                ? "border-amber-500 bg-amber-500/10 text-amber-400"
                : "border-[#1E293B] text-slate-400 hover:text-slate-100"
            }`}
            data-testid={`preview-device-${key}`}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
            <span className="font-mono text-[10px] text-slate-500">{width ? `${width}px` : "tam"}</span>
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={refresh}
            className="flex items-center gap-1.5 rounded-lg border border-[#1E293B] px-3 py-2 text-xs font-semibold text-slate-300 transition-colors duration-150 hover:border-amber-500/60 hover:text-amber-400"
            data-testid="preview-refresh-button"
          >
            <RotateCw className="h-3.5 w-3.5" /> Yenile
          </button>
          <a
            href={`/?site=${encodeURIComponent(slug)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-[#1E293B] px-3 py-2 text-xs font-semibold text-slate-300 transition-colors duration-150 hover:border-slate-500"
            data-testid="preview-open-tab-link"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Yeni sekme
          </a>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Kaydettiğiniz değişiklikleri görmek için "Yenile"ye basın. Kartlar mobilde de masaüstüyle
        aynı kolon sırasında ve yan yana görünür.
      </p>

      <div className="flex justify-center overflow-x-auto rounded-xl border border-[#1E293B] bg-[#05070B] p-4 sm:p-6">
        <div
          className={`overflow-hidden border-4 border-[#1E293B] bg-[#090B10] shadow-2xl transition-[width] duration-200 ease-out ${
            device === "mobile" ? "rounded-[32px]" : device === "tablet" ? "rounded-2xl" : "rounded-xl"
          } ${active.width ? "" : "w-full"}`}
          style={{ width: active.width ? active.width : undefined, height: active.height, maxWidth: "100%" }}
          data-testid="preview-frame"
        >
          <iframe
            ref={frameRef}
            src={url}
            title="Canlı önizleme"
            className="h-full w-full border-0"
            data-testid="preview-iframe"
          />
        </div>
      </div>
    </div>
  );
}
