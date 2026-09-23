# Hayaller Okyanusu · FTC

MIT Media Lab Critical Matter Group'un [Ocean of Dreams](https://mitoceanofdreams.com/)
enstalasyonundan ilham alan, **FIRST Tech Challenge** topluluğu için Türkçe hazırlanmış
katılımcı bir web deneyimi. Kod ve metinler bu proje için sıfırdan yazıldı; orijinal
sitenin kodu, görselleri veya logoları kullanılmadı.

**Canlı site:** https://hakanatas.github.io/oceanofdream/
(`gh-pages` dalından yayınlanır; siteyi güncellemek için değişiklikleri bu dala da gönder.)

## Deneyim

1. **Giriş ve onay:** Katılımcı, sözlerinin kuma yazılacağını ve kimliğini belirten bilgi
   paylaşmaması gerektiğini onaylar.
2. **Üç soru:**
   - "Robotum dünyada tek bir şeyi değiştirebilseydi, ..."
   - Önceki katılımcının bıraktığı soru (zincir henüz başlamadıysa FTC temalı hazır sorular)
   - "Sıradaki katılımcıya ne sormak istersin?"
3. **Hayal imzası:** Katılımcıyı anlatan üç kelime.
4. **Kumu süsleme:** Dişli, robot, roket, kupa gibi simgeler sürüklenip boyutlandırılır.
5. **Okyanusa bırakma:** Büyük bir dalga yazıyı siler, hayal okyanusta süzülmeye başlar.
   Katılımcı kartpostal indirebilir veya paylaşabilir.
6. **Hayalimi bul:** Üç kelimelik imza (sırası ve büyük/küçük harf fark etmez) girilince hayal
   yeniden kuma yazılır.

Aşağıdaki bölümlerde FTC'nin ne olduğu, FIRST temel değerleri ve etkinlikte kurulum adımları var.

## Çalıştırma

Derleme adımı yok, bağımlılık yok. Herhangi bir statik sunucu yeterli:

```bash
python3 -m http.server 8000
# http://localhost:8000
```

GitHub Pages, Netlify veya Vercel'e olduğu gibi yüklenebilir.

### Modlar

| Adres | Ne yapar |
| --- | --- |
| `/` | Tam deneyim + bilgi bölümleri |
| `/?kiosk=1` | Tablet için: sayfa kaydırılmaz, 60 sn hareketsizlikte başa döner |
| `/?okyanus=1` | Sahne ekranı / projeksiyon: yalnızca dalgalar ve süzülen hayaller |

## Özelleştirme

`js/app.js` dosyasının başındaki `CONFIG` nesnesinde etkinlik adı, soru metinleri, hazır
sorular ve okyanusta süzülen örnek hayaller var.

## Hayalleri tabloda topla (Google E-Tablolar)

Her hayal bir Google E-Tablosu'na satır olarak düşer. Tabloda istediğin hayali
**düzenleyebilir**, **silebilir** veya **gizleyebilirsin**; okyanus ekranı ve "Hayalimi bul"
değişiklikleri birkaç saniye içinde görür. Sunucu kurmak veya ücret ödemek gerekmez.

**Kurulum (bir kez, ~5 dakika):**

1. [sheets.new](https://sheets.new) ile boş bir Google E-Tablosu aç, adını "Hayaller Okyanusu" koy.
2. Menüden **Uzantılar → Apps Script**'i aç.
3. Açılan editördeki her şeyi sil, [`backend/Code.gs`](backend/Code.gs) dosyasının tamamını
   yapıştır ve **Kaydet**'e bas.
4. Sağ üstten **Dağıt → Yeni dağıtım**. Tür olarak **Web uygulaması** seç:
   - *Şu kullanıcı olarak yürüt:* **Ben**
   - *Erişimi olan kullanıcılar:* **Herkes**
5. **Dağıt**'a bas, Google'ın istediği izinleri onayla ("Gelişmiş → güvenli olmayan sayfaya git"
   uyarısı kendi yazdığın betik için normaldir).
6. Verilen `https://script.google.com/macros/s/.../exec` adresini kopyala ve
   `js/app.js` içindeki `CONFIG.sheetUrl` alanına yapıştır. Değişikliği gönderdiğinde site bağlanır.
   (Önce denemek istersen: `https://hakanatas.github.io/oceanofdream/?tablo=<exec adresi>`)

**Tabloda moderasyon:**

| Ne yapmak istiyorsun | Nasıl |
| --- | --- |
| Yazım hatasını düzelt / cümleyi değiştir | Hücreyi doğrudan düzenle |
| Uygunsuz bir hayali kaldır | "Durum" sütununu **gizli** yap (menü: **Hayaller → Seçili satırları gizle**) ya da satırı sil |
| Önce onaylamadan hiçbir şey görünmesin | `Code.gs` içinde `ONAY_BEKLE = true` yap, sonra **Dağıt → Dağıtımları yönet → Düzenle → Yeni sürüm**. Bu durumda yalnızca **onaylı** satırlar okyanusta görünür |

Gizli satırlar okyanusta süzülmez, "Hayalimi bul" ile de bulunamaz ve soru zincirine girmez.
Formül gibi görünen girdiler (`=`, `+`, `-`, `@` ile başlayan) tabloya düz metin olarak yazılır.

`Code.gs` dosyasını değiştirirsen her seferinde **yeni sürüm** olarak yeniden dağıtman gerekir;
`/exec` adresi aynı kalır.

Tablo bağlantısı yokken veya internet koptuğunda hayaller cihazda kuyruğa alınır ve bağlantı
gelince tabloya gönderilir.

## Sınırlamalar

- Tablo bağlı değilse hayaller yalnızca o tarayıcıda (localStorage) kalır.
- Web uygulaması herkese açık olduğu için isteyen herkes hayal gönderebilir; bu yüzden
  moderasyon tablodan yapılır. Büyük etkinliklerde `ONAY_BEKLE = true` önerilir.
- Yalnızca Türkçe.

## Yasal not

Bağımsız bir topluluk projesidir; FIRST® veya MIT ile resmî bir bağlantısı yoktur. FIRST®,
FIRST® Tech Challenge, Gracious Professionalism® ve Coopertition® FIRST'ün tescilli markalarıdır.
