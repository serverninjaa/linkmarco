import { useEffect } from "react";

/** Google sonucunda ve tarayıcı sekmesinde görünen alanları domaine göre ayarlar.
 *  index.html'deki statik başlık/açıklama, ziyaret edilen siteye ait değerlerle değiştirilir. */
export default function usePortalHead({
  title,
  description,
  faviconUrl,
}: {
  title: string;
  description: string;
  faviconUrl: string;
}) {
  useEffect(() => {
    if (title) document.title = title;

    if (description) {
      let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
      if (!meta) {
        meta = document.createElement("meta");
        meta.name = "description";
        document.head.appendChild(meta);
      }
      meta.content = description;

      let og = document.querySelector<HTMLMetaElement>('meta[property="og:description"]');
      if (!og) {
        og = document.createElement("meta");
        og.setAttribute("property", "og:description");
        document.head.appendChild(og);
      }
      og.content = description;
    }

    if (title) {
      let ogt = document.querySelector<HTMLMetaElement>('meta[property="og:title"]');
      if (!ogt) {
        ogt = document.createElement("meta");
        ogt.setAttribute("property", "og:title");
        document.head.appendChild(ogt);
      }
      ogt.content = title;
    }

    if (faviconUrl) {
      document
        .querySelectorAll('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')
        .forEach((el) => el.parentNode?.removeChild(el));
      const link = document.createElement("link");
      link.rel = "icon";
      link.href = faviconUrl;
      document.head.appendChild(link);
      const apple = document.createElement("link");
      apple.rel = "apple-touch-icon";
      apple.href = faviconUrl;
      document.head.appendChild(apple);
    }
  }, [title, description, faviconUrl]);
}
