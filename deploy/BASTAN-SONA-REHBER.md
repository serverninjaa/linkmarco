# SIFIRDAN KURULUM REHBERİ (Windows CMD ile)
Sunucu: **203.161.57.207** · Panel domaini: **marcopanel.site** · Repo: **https://github.com/serverninjaa/linkmarco**

Aşağıdaki adımları sırayla uygula. Her bloğun çıktısını bana yapıştır, birlikte kontrol edelim.

---

# BÖLÜM 1 — Sunucuya CMD ile bağlanma

## 1.1 CMD'yi aç
Windows tuşu → `cmd` yaz → **Enter**. (Windows 10/11'de SSH hazır gelir.)

## 1.2 Bağlan
```
ssh root@203.161.57.207
```
- İlk bağlantıda `Are you sure you want to continue connecting (yes/no)?` sorusuna **yes** yaz → Enter.
- `root@203.161.57.207's password:` çıkınca sunucu sağlayıcının verdiği **root şifresini** yaz → Enter.
  (Şifre yazarken ekranda hiçbir şey görünmez, bu normaldir. Şifreyi kopyala-yapıştır için CMD'de **sağ tık** yap.)
- Bağlanınca satır başı şöyle olur: `root@sunucu:~#`

## 1.3 Sık hatalar
| Hata | Çözüm |
|---|---|
| `ssh: command not found` | Windows → Ayarlar → Uygulamalar → Ek özellikler → **OpenSSH Client** kur |
| `Permission denied` | Şifre yanlış. Sağlayıcı panelinden root şifresini sıfırla |
| `Connection timed out` | Sunucu kapalı veya güvenlik duvarı; sağlayıcı panelinden sunucuyu başlat |
| Kopyala-yapıştır çalışmıyor | CMD'de **sağ tık** = yapıştır. Veya Windows Terminal kullan (Ctrl+Shift+V) |

## 1.4 Bağlandığını doğrula
```bash
whoami && lsb_release -a
```
`root` ve `Ubuntu 22.04 / 24.04` görmelisin.

---

# BÖLÜM 2 — Ubuntu üzerinde kurulum

Aşağıdaki komutları **sunucuda** (yani `root@sunucu:~#` satırında) çalıştır.

## 2.1 Kodu GitHub'dan indir ve kurulumu başlat
```bash
apt-get update -y && apt-get install -y git
rm -rf /opt/adcore
git clone https://github.com/serverninjaa/linkmarco.git /opt/adcore
bash /opt/adcore/deploy/install.sh marcopanel.site /opt/adcore 2>&1 | tail -30
```
**Ne yapar:** Node.js 20 + yarn, MongoDB 7, Python sanal ortamı + bağımlılıklar,
frontend production build (`yarn build`), `adcore-backend` systemd servisi,
Nginx yapılandırması ve güvenlik duvarı (22/80/443).
**Süre:** 5-10 dakika. Bittiğinde "BİTTİ. Sıradaki adımlar:" yazısını görürsün.
→ Çıktının son 30 satırını bana yapıştır.

## 2.2 Ayar dosyası (.env) ve mevcut verinin yüklenmesi
```bash
cat > /opt/adcore/backend/.env <<'EOF'
MONGO_URL="mongodb://127.0.0.1:27017"
DB_NAME="adcore"
CORS_ORIGINS="https://marcopanel.site"
APP_URL="https://marcopanel.site"
ADMIN_USER="admin"
ADMIN_PASSWORD="1727Fd40."
CLOUDFLARE_API_TOKEN="<CLOUDFLARE_API_TOKEN>"
EOF

mongorestore --uri="mongodb://127.0.0.1:27017" \
  --archive=/opt/adcore/deploy/seed-data/adcore-data.archive --gzip \
  --nsFrom='app.*' --nsTo='adcore.*' 2>&1 | tail -5

systemctl restart adcore-backend
```

## 2.3 Her şey çalışıyor mu? (doğrulama)
```bash
echo "--- API ---";    curl -s localhost:8001/api/; echo
echo "--- SERVIS ---"; systemctl is-active adcore-backend
echo "--- NGINX ---";  nginx -t 2>&1 | tail -2
echo "--- SITELER ---"; curl -s -c /tmp/c -X POST localhost:8001/api/auth/login \
  -H 'Content-Type: application/json' -d '{"username":"admin","password":"1727Fd40."}' >/dev/null; \
  curl -s -b /tmp/c localhost:8001/api/sites | head -c 200; echo
echo "--- PANEL ---";  curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1/
```
**Görmen gerekenler:** `{"message":"Hello World"}` · `active` · `syntax is ok` · site listesi · `200`
→ Tüm çıktıyı bana yapıştır.

## 2.4 Tarayıcıdan ilk test (domain gelmeden)
Bilgisayarında tarayıcıya `http://203.161.57.207/admin` yaz.
Panel giriş ekranı açılmalı: kullanıcı `admin`, şifre `1727Fd40.`
(Not: IP ile girişte tarayıcı "güvenli değil" der; domain + SSL sonrası düzelir.)

---

# BÖLÜM 3 — Domain bağlama (marcopanel.site)

## 3.1 Domaini Cloudflare'a ekle (bilgisayardan, tarayıcıda)
1. https://dash.cloudflare.com → giriş yap.
2. **Add a domain** (veya "Add site") → `marcopanel.site` yaz → **Continue**.
3. **Free** planı seç → **Continue**.
4. Cloudflare mevcut kayıtları tarar → **Continue**.
5. Ekranda **2 nameserver** verir, örnek:
   `dina.ns.cloudflare.com` ve `rick.ns.cloudflare.com` → ikisini kopyala.

## 3.2 Nameserver'ları domain firmasında değiştir
Domain Namecheap'te görünüyor:
1. Namecheap → **Domain List** → `marcopanel.site` → **Manage**.
2. **Nameservers** bölümünde `Namecheap BasicDNS` yerine **Custom DNS** seç.
3. İki satıra Cloudflare'ın verdiği NS'leri yaz → yeşil tik ile **kaydet**.
4. Cloudflare'da site "Pending" → 5-60 dakika içinde **Active** olur (Cloudflare e-posta atar).

## 3.3 DNS kayıtlarını oluştur
Zone **Active** olunca iki yol var:

**Kolay yol (panelden):** `http://203.161.57.207/admin` → **Cloudflare / DNS** →
"Tek tıkla domain bağla" → `marcopanel.site` yaz → **Bağla**.
(Kök ve www A kayıtları 203.161.57.207'ye otomatik yazılır.)

**Elle yol (Cloudflare arayüzü → DNS → Records → Add record):**
```
Type: A    Name: @      IPv4: 203.161.57.207    Proxy: DNS only (gri bulut)
Type: A    Name: www    IPv4: 203.161.57.207    Proxy: DNS only (gri bulut)
```
⚠️ Sertifika alınana kadar **proxy gri (DNS only)** kalsın; SSL'den sonra turuncuya çevireceğiz.

## 3.4 Sunucuda DNS kontrolü
```bash
getent hosts marcopanel.site
curl -s -o /dev/null -w "%{http_code}\n" http://marcopanel.site/
```
IP olarak `203.161.57.207` ve `200` görmelisin. Görmüyorsan 10-15 dk bekle, tekrar dene.

---

# BÖLÜM 4 — SSL (https) kurulumu

```bash
bash /opt/adcore/deploy/ssl.sh marcopanel.site 2>&1 | tail -15
curl -s -o /dev/null -w "%{http_code}\n" https://marcopanel.site/admin
```
`200` aldıysan tamam. Sonra Cloudflare'da:
1. **DNS → Records**: iki A kaydının bulutunu **turuncuya** çevir (proxy açık).
2. **SSL/TLS → Overview**: **Full (strict)** seç.
3. **SSL/TLS → Edge Certificates**: **Always Use HTTPS** açık.
(2 ve 3'ü panelden de yapabilirsin: Cloudflare / DNS → SSL & Önbellek.)

**Backoffice adresin:** https://marcopanel.site/admin — `admin` / `1727Fd40.`

---

# BÖLÜM 5 — Reklam domainlerini bağlama (her yeni domain için)
1. Domaini Cloudflare'a ekle (Bölüm 3.1-3.2 ile aynı) — NS'leri çevir.
2. Panel → **Cloudflare / DNS** → "Tek tıkla domain bağla": domaini yaz, **hangi siteye** bağlanacağını seç → **Bağla**.
3. Panel → **Domain Doğrulama** → satır yeşil olmalı (NS active + A kaydı doğru + proxy açık).
Sunucuda hiçbir ek ayar gerekmez; Nginx tüm domainleri karşılar, uygulama Host başlığına göre doğru siteyi gösterir.

---

# BÖLÜM 6 — Günlük kullanım komutları
```bash
systemctl status adcore-backend --no-pager   # servis durumu
journalctl -u adcore-backend -n 50 --no-pager # son 50 log satırı
systemctl restart adcore-backend             # yeniden başlat
bash /opt/adcore/deploy/update.sh /opt/adcore # yeni kod çek + build + restart
```
Yedek (günde bir, otomatik):
```bash
(crontab -l 2>/dev/null; echo '0 4 * * * mongodump --uri="mongodb://127.0.0.1:27017" --db=adcore --archive=/var/backups/adcore-$(date +\%F).gz --gzip') | crontab -
```

---

# Sorun giderme
| Belirti | Çözüm |
|---|---|
| `502 Bad Gateway` | `journalctl -u adcore-backend -n 40 --no-pager` çıktısını bana at |
| Panel açılıyor, veriler gelmiyor | `.env` içindeki `DB_NAME=adcore` doğru mu; `systemctl restart adcore-backend` |
| Giriş kabul etmiyor | Şifre `.env` içindeki `ADMIN_PASSWORD` ile aynı olmalı; değiştirdiysen servisi yeniden başlat |
| Logo yüklerken hata | Dosya 10 MB'ı geçmesin (Nginx limiti 12 MB) |
| Certbot hata verdi | Cloudflare proxy'yi **DNS only** yap, tekrar dene |
