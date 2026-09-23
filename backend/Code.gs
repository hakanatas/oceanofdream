/**
 * Hayaller Okyanusu · Google E-Tablolar arka ucu
 *
 * Kurulum (README → "Hayalleri tabloda topla"):
 *   1. Yeni bir Google E-Tablosu aç → Uzantılar → Apps Script.
 *   2. Bu dosyanın tamamını yapıştır, kaydet.
 *   3. Dağıt → Yeni dağıtım → Web uygulaması
 *        Şu kullanıcı olarak çalıştır: Ben
 *        Erişimi olanlar: Herkes
 *   4. Verilen /exec adresini js/app.js içindeki CONFIG.sheetUrl alanına yaz.
 *
 * Tabloda yapabileceklerin:
 *   - Bir hayali düzeltmek için hücreyi düzenle.
 *   - Silmek için satırı sil.
 *   - Gizlemek için "Durum" sütununu "gizli" yap (veya menüden: Hayaller → Gizle).
 *   - Menüden "Yalnızca bekleyenleri göster" ile onay bekleyenleri süz.
 *
 * Renkler: yeni = sarı (bekliyor), onaylı = yeşil, gizli = gri ve üstü çizili.
 */

// true: yalnızca "onaylı" hayaller okyanusta görünür (ön onay).
// false: "gizli" yapılmadıkça her hayal hemen görünür (sonradan denetim).
var ONAY_BEKLE = false;

var SAYFA = "Hayaller";
var BASLIKLAR = [
  "Zaman",
  "Kimlik",
  "Durum",
  "Hayal (1. cevap)",
  "2. soru",
  "2. cevap",
  "Sonrakine bırakılan soru",
  "İmza 1",
  "İmza 2",
  "İmza 3",
  "Simgeler",
];
var S = { zaman: 0, kimlik: 1, durum: 2, cevap1: 3, soru2: 4, cevap2: 5, sonrakiSoru: 6, imza: 7, simgeler: 10 };

function sayfa_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SAYFA) || ss.insertSheet(SAYFA);
  if (sh.getLastRow() === 0) {
    sh.appendRow(BASLIKLAR);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, BASLIKLAR.length).setFontWeight("bold");
    var kural = SpreadsheetApp.newDataValidation().requireValueInList(["yeni", "onaylı", "gizli"], true).build();
    sh.getRange(2, S.durum + 1, sh.getMaxRows() - 1, 1).setDataValidation(kural);
    // Cevaplar tarih/sayıya dönüşmesin
    sh.getRange(2, S.cevap1 + 1, sh.getMaxRows() - 1, BASLIKLAR.length - S.cevap1).setNumberFormat("@");
  }
  return sh;
}

// Satırları duruma göre renklendir. Her açılışta yeniden kurulur; elle eklenen
// başka koşullu biçimlendirmeler korunur.
var RENKLER = [
  { durum: "yeni", arka: "#FFF4C2", yazi: "#5C4700", cizili: false },
  { durum: "onaylı", arka: "#D8F0DC", yazi: "#1E4D2B", cizili: false },
  { durum: "gizli", arka: "#E8E8E8", yazi: "#8A8A8A", cizili: true },
];
function renklendir_(sh) {
  var aralik = sh.getRange(2, 1, sh.getMaxRows() - 1, BASLIKLAR.length);
  var sutun = String.fromCharCode(65 + S.durum); // C
  var bizim = RENKLER.map(function (r) {
    return '=$' + sutun + '2="' + r.durum + '"';
  });
  var digerleri = sh.getConditionalFormatRules().filter(function (kural) {
    var kosul = kural.getBooleanCondition();
    var degerler = kosul ? kosul.getCriteriaValues() : [];
    return !(degerler.length && bizim.indexOf(String(degerler[0])) >= 0);
  });
  var yeniler = RENKLER.map(function (r, i) {
    return SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(bizim[i])
      .setBackground(r.arka)
      .setFontColor(r.yazi)
      .setStrikethrough(r.cizili)
      .setRanges([aralik])
      .build();
  });
  sh.setConditionalFormatRules(digerleri.concat(yeniler));
}

// Tek satır metin, uzunluk sınırı ve formül enjeksiyonuna karşı koruma.
function temiz_(v, max) {
  var t = String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max);
  return /^[=+\-@]/.test(t) ? "'" + t : t;
}
function metin_(v) {
  return String(v == null ? "" : v).replace(/^'/, "");
}
function kucuk_(s) {
  return String(s).trim().replace(/I/g, "ı").replace(/İ/g, "i").toLowerCase();
}
function imzaAnahtari_(kelimeler) {
  return kelimeler.map(kucuk_).sort().join("|");
}
function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function satirlar_() {
  var sh = sayfa_();
  if (sh.getLastRow() < 2) return [];
  return sh
    .getRange(2, 1, sh.getLastRow() - 1, BASLIKLAR.length)
    .getValues()
    .filter(function (r) {
      return metin_(r[S.cevap1]);
    })
    .map(function (r) {
      var simgeler = [];
      try {
        simgeler = JSON.parse(r[S.simgeler] || "[]");
      } catch (e) {}
      return {
        durum: String(r[S.durum] || "yeni").trim(),
        answers: [metin_(r[S.cevap1]), metin_(r[S.cevap2])],
        nextQuestion: metin_(r[S.sonrakiSoru]),
        signature: [metin_(r[S.imza]), metin_(r[S.imza + 1]), metin_(r[S.imza + 2])],
        stickers: simgeler,
      };
    });
}

function gorunur_(r) {
  return ONAY_BEKLE ? r.durum === "onaylı" : r.durum !== "gizli";
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  var rows = satirlar_();

  if (p.action === "find") {
    var anahtar = imzaAnahtari_(String(p.sig || "").split("|"));
    var bulunan = null;
    for (var i = rows.length - 1; i >= 0; i--) {
      if (rows[i].durum !== "gizli" && imzaAnahtari_(rows[i].signature) === anahtar) {
        bulunan = rows[i];
        break;
      }
    }
    return json_({
      ok: true,
      dream: bulunan && { answers: bulunan.answers, signature: bulunan.signature, stickers: bulunan.stickers },
    });
  }

  // action=list: okyanusta süzülecek hayaller ve sıradaki soru
  var acik = rows.filter(gorunur_);
  var sorular = acik
    .map(function (r) {
      return r.nextQuestion;
    })
    .filter(String);
  return json_({
    ok: true,
    dreams: acik.slice(-200).map(function (r) {
      return r.answers[0];
    }),
    question: sorular.length ? sorular[sorular.length - 1] : null,
  });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var body = JSON.parse(e.postData.contents);
    var d = body.dream || {};
    var cevaplar = d.answers || [];
    var imza = (d.signature || []).slice(0, 3).map(function (w) {
      return temiz_(w, 18);
    });
    if (!temiz_(cevaplar[0], 120) || imza.length !== 3 || imza.some(function (w) {
      return !w;
    })) {
      return json_({ ok: false, error: "eksik" });
    }
    var kimlik = Utilities.getUuid().slice(0, 8);
    sayfa_().appendRow([
      new Date(),
      kimlik,
      "yeni",
      temiz_(cevaplar[0], 120),
      temiz_(d.question2, 160),
      temiz_(cevaplar[1], 120),
      temiz_(d.nextQuestion, 120),
      imza[0],
      imza[1],
      imza[2],
      JSON.stringify((d.stickers || []).slice(0, 30)),
    ]);
    return json_({ ok: true, id: kimlik });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// ---------------------------------------------------------------
// Tablo menüsü: seçili satırları tek tıkla onayla / gizle
// ---------------------------------------------------------------
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Hayaller")
    .addItem("Seçili satırları onayla", "onayla")
    .addItem("Seçili satırları gizle", "gizle")
    .addSeparator()
    .addItem("Yalnızca bekleyenleri göster", "bekleyenler")
    .addItem("Hepsini göster", "hepsi")
    .addToUi();
  renklendir_(sayfa_());
}

// "Durum" sütununa filtre: yalnızca "yeni" satırlar görünür.
function bekleyenler() {
  var sh = sayfa_();
  SpreadsheetApp.setActiveSheet(sh);
  var filtre = sh.getFilter() || sh.getRange(1, 1, sh.getMaxRows(), BASLIKLAR.length).createFilter();
  filtre.setColumnFilterCriteria(
    S.durum + 1,
    SpreadsheetApp.newFilterCriteria().setHiddenValues(["onaylı", "gizli"]).build()
  );
}
function hepsi() {
  var filtre = sayfa_().getFilter();
  if (filtre) filtre.removeColumnFilterCriteria(S.durum + 1);
}
function durumYaz_(deger) {
  var sh = SpreadsheetApp.getActiveSheet();
  if (sh.getName() !== SAYFA) return;
  var aralik = sh.getActiveRange();
  for (var r = aralik.getRow(); r < aralik.getRow() + aralik.getNumRows(); r++) {
    if (r > 1) sh.getRange(r, S.durum + 1).setValue(deger);
  }
}
function onayla() {
  durumYaz_("onaylı");
}
function gizle() {
  durumYaz_("gizli");
}
