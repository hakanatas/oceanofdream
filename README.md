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

## Sınırlamalar ve sonraki adımlar

- **Veriler yalnızca tarayıcıda (localStorage) saklanıyor.** Kiosk tablet ile okyanus
  ekranının aynı hayalleri görmesi için `js/app.js` içindeki `store` nesnesini bir sunucuya
  (ör. Supabase, Firebase) bağlamak gerekir. Arayüzün geri kalanı değişmez.
- **Moderasyon yok.** Hayaller okyanus ekranında herkese gösterilecekse, sunucu tarafında
  onay adımı eklenmeli.
- Yalnızca Türkçe; gerekirse İngilizce eklemek için metinler tek bir sözlüğe taşınabilir.

## Yasal not

Bağımsız bir topluluk projesidir; FIRST® veya MIT ile resmî bir bağlantısı yoktur. FIRST®,
FIRST® Tech Challenge, Gracious Professionalism® ve Coopertition® FIRST'ün tescilli markalarıdır.
