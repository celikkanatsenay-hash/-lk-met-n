// app.js
// Görünmez karakter temizleyici
//
// Metindeki görünmez / gizli Unicode karakterlerini (sıfır genişlikli boşluk,
// yön işaretleri, etiket karakterleri vb.) bulur, raporlar ve temizler.
// Olağandışı boşluk karakterlerini (bölünmez boşluk vb.) normal boşluğa çevirir.
//
// Kullanım (Node.js):
//   node app.js dosya.txt                -> raporu gösterir, temiz metni ekrana yazar
//   node app.js dosya.txt -o temiz.txt   -> temiz metni dosyaya yazar
//   node app.js dosya.txt --yerinde      -> dosyanın kendisini temizler
//   node app.js --rapor dosya.txt        -> yalnızca rapor, metin yazılmaz
//   cat dosya.txt | node app.js          -> standart girdiden okur
//
// Kullanım (tarayıcı): index.html dosyasını açın.

(function (root) {
  'use strict';

  // Silinecek görünmez karakterler: kod noktası -> açıklama
  var GORUNMEZ = {
    0x00AD: 'Yumuşak tire (soft hyphen)',
    0x034F: 'Birleştirici grafem birleştirici (CGJ)',
    0x061C: 'Arapça harf işareti (ALM)',
    0x115F: 'Hangul choseong dolgu',
    0x1160: 'Hangul jungseong dolgu',
    0x17B4: 'Khmer görünmez ünlü (KIV AQ)',
    0x17B5: 'Khmer görünmez ünlü (KIV AA)',
    0x180E: 'Moğolca ünlü ayırıcı',
    0x200B: 'Sıfır genişlikli boşluk (ZWSP)',
    0x200C: 'Sıfır genişlikli birleştirmeyen (ZWNJ)',
    0x200D: 'Sıfır genişlikli birleştirici (ZWJ)',
    0x200E: 'Soldan sağa işareti (LRM)',
    0x200F: 'Sağdan sola işareti (RLM)',
    0x202A: 'Soldan sağa gömme (LRE)',
    0x202B: 'Sağdan sola gömme (RLE)',
    0x202C: 'Yön biçimlendirmesini kapat (PDF)',
    0x202D: 'Soldan sağa zorlama (LRO)',
    0x202E: 'Sağdan sola zorlama (RLO)',
    0x2060: 'Kelime birleştirici (WJ)',
    0x2061: 'Görünmez fonksiyon uygulaması',
    0x2062: 'Görünmez çarpma',
    0x2063: 'Görünmez ayırıcı',
    0x2064: 'Görünmez artı',
    0x2066: 'Soldan sağa yalıtım (LRI)',
    0x2067: 'Sağdan sola yalıtım (RLI)',
    0x2068: 'İlk güçlü yalıtım (FSI)',
    0x2069: 'Yön yalıtımını kapat (PDI)',
    0x206A: 'Simetrik takası engelle',
    0x206B: 'Simetrik takası etkinleştir',
    0x206C: 'Arapça biçim şekillendirmeyi engelle',
    0x206D: 'Arapça biçim şekillendirmeyi etkinleştir',
    0x206E: 'Ulusal rakam şekilleri',
    0x206F: 'Nominal rakam şekilleri',
    0x3164: 'Hangul dolgu',
    0xFEFF: 'Bayt sırası işareti / sıfır genişlikli bölünmez boşluk (BOM)',
    0xFFA0: 'Yarım genişlikli Hangul dolgu',
    0xFFF9: 'Satır arası açıklama bağlantısı',
    0xFFFA: 'Satır arası açıklama ayırıcısı',
    0xFFFB: 'Satır arası açıklama sonlandırıcısı'
  };

  // Normal boşluğa (U+0020) çevrilecek olağandışı boşluklar
  var OZEL_BOSLUK = {
    0x00A0: 'Bölünmez boşluk (NBSP)',
    0x1680: 'Ogham boşluk işareti',
    0x2000: 'En dörtlük boşluk',
    0x2001: 'Em dörtlük boşluk',
    0x2002: 'En boşluk',
    0x2003: 'Em boşluk',
    0x2004: 'Üçte bir em boşluk',
    0x2005: 'Dörtte bir em boşluk',
    0x2006: 'Altıda bir em boşluk',
    0x2007: 'Rakam boşluğu',
    0x2008: 'Noktalama boşluğu',
    0x2009: 'İnce boşluk',
    0x200A: 'Kıl boşluk',
    0x2028: 'Satır ayırıcı',
    0x2029: 'Paragraf ayırıcı',
    0x202F: 'Dar bölünmez boşluk',
    0x205F: 'Orta matematiksel boşluk',
    0x3000: 'İdeografik boşluk'
  };

  // Normal satır sonuna çevrilecekler
  var SATIR_SONU = { 0x2028: true, 0x2029: true };

  function aciklama(kp) {
    if (GORUNMEZ[kp]) return GORUNMEZ[kp];
    if (OZEL_BOSLUK[kp]) return OZEL_BOSLUK[kp];
    if (kp >= 0xFE00 && kp <= 0xFE0F) return 'Varyasyon seçici';
    if (kp >= 0xE0100 && kp <= 0xE01EF) return 'Ek varyasyon seçici';
    if (kp >= 0xE0000 && kp <= 0xE007F) return 'Etiket karakteri (tag)';
    if (kp >= 0x1D173 && kp <= 0x1D17A) return 'Müzik biçimlendirme karakteri';
    if (kp >= 0xFFF0 && kp <= 0xFFF8) return 'Atanmamış özel karakter';
    if (kp >= 0xE000 && kp <= 0xF8FF) return 'Özel kullanım alanı karakteri';
    if (kp >= 0xF0000) return 'Özel kullanım alanı karakteri';
    return 'Görünmez biçim karakteri';
  }

  var BICIM_KARAKTERI = /^\p{Cf}$/u;
  var EMOJI = /^\p{Extended_Pictographic}$/u;
  var EMOJI_DEVAMI = /^[\p{Extended_Pictographic}\p{Emoji_Modifier}\u{1F1E6}-\u{1F1FF}]$/u;

  // Bir karakter için ne yapılacağını belirler: null (dokunma), 'sil', 'bosluk', 'satir'
  function islem(kp, ch) {
    if (OZEL_BOSLUK[kp]) return SATIR_SONU[kp] ? 'satir' : 'bosluk';
    if (GORUNMEZ[kp]) return 'sil';
    if (kp >= 0xFE00 && kp <= 0xFE0F) return 'sil';
    if (kp >= 0xE0100 && kp <= 0xE01EF) return 'sil';
    if (kp >= 0xE0000 && kp <= 0xE007F) return 'sil';
    if (kp >= 0x1D173 && kp <= 0x1D17A) return 'sil';
    if (kp >= 0xFFF0 && kp <= 0xFFF8) return 'sil';
    if ((kp >= 0xE000 && kp <= 0xF8FF) || kp >= 0xF0000) return 'sil';
    // Satır sonu, sekme vb. dışındaki kontrol karakterleri
    if ((kp < 0x20 && kp !== 0x09 && kp !== 0x0A && kp !== 0x0D) || (kp >= 0x7F && kp <= 0x9F)) {
      return 'sil';
    }
    if (BICIM_KARAKTERI.test(ch)) return 'sil';
    return null;
  }

  function kodGoster(kp) {
    var h = kp.toString(16).toUpperCase();
    while (h.length < 4) h = '0' + h;
    return 'U+' + h;
  }

  /**
   * Metni tarar ve temizler.
   * @param {string} metin
   * @param {object} [secenekler]
   * @param {boolean} [secenekler.emojiKoru=true]  Emoji içindeki ZWJ ve U+FE0F'yi korur
   *                                               (silinirse aile/bayrak gibi emojiler bozulur).
   * @param {boolean} [secenekler.bosluklariCevir=true] Olağandışı boşlukları normal boşluğa çevirir.
   * @returns {{temiz: string, bulunanlar: Array, ozet: Array, toplam: number}}
   */
  function temizle(metin, secenekler) {
    secenekler = secenekler || {};
    var emojiKoru = secenekler.emojiKoru !== false;
    var bosluklariCevir = secenekler.bosluklariCevir !== false;

    var karakterler = Array.from(String(metin));
    var cikti = [];
    var bulunanlar = [];
    var sayac = {};
    var satir = 1;
    var sutun = 1;

    for (var i = 0; i < karakterler.length; i++) {
      var ch = karakterler[i];
      var kp = ch.codePointAt(0);
      var yap = islem(kp, ch);

      if (yap && emojiKoru) {
        var onceki = karakterler[i - 1] || '';
        var sonraki = karakterler[i + 1] || '';
        if (kp === 0xFE0F && (EMOJI.test(onceki) || /^[0-9#*]$/.test(onceki))) yap = null;
        if (kp === 0x200D && EMOJI_DEVAMI.test(onceki.length ? onceki : ' ') && EMOJI.test(sonraki)) yap = null;
        if (kp === 0x200D && (karakterler[i - 1] === '️') && EMOJI.test(sonraki)) yap = null;
        // Bayrak etiket dizileri (ör. İskoçya bayrağı) için etiket karakterleri
        if (kp >= 0xE0020 && kp <= 0xE007F) {
          var j = i - 1;
          while (j >= 0 && karakterler[j].codePointAt(0) >= 0xE0020 && karakterler[j].codePointAt(0) <= 0xE007F) j--;
          if (j >= 0 && karakterler[j].codePointAt(0) === 0x1F3F4) yap = null;
        }
      }
      if ((yap === 'bosluk' || yap === 'satir') && !bosluklariCevir) yap = null;

      if (yap) {
        var anahtar = kodGoster(kp);
        bulunanlar.push({
          kod: anahtar,
          ad: aciklama(kp),
          satir: satir,
          sutun: sutun,
          islem: yap === 'sil' ? 'silindi' : (yap === 'satir' ? 'satır sonuna çevrildi' : 'boşluğa çevrildi')
        });
        if (!sayac[anahtar]) sayac[anahtar] = { kod: anahtar, ad: aciklama(kp), adet: 0 };
        sayac[anahtar].adet++;
        if (yap === 'bosluk') cikti.push(' ');
        else if (yap === 'satir') cikti.push('\n');
      } else {
        cikti.push(ch);
      }

      if (ch === '\n' || yap === 'satir') {
        satir++;
        sutun = 1;
      } else {
        sutun++;
      }
    }

    var ozet = Object.keys(sayac).map(function (k) { return sayac[k]; })
      .sort(function (a, b) { return b.adet - a.adet; });

    return { temiz: cikti.join(''), bulunanlar: bulunanlar, ozet: ozet, toplam: bulunanlar.length };
  }

  function raporMetni(sonuc) {
    if (sonuc.toplam === 0) return 'Görünmez veya olağandışı karakter bulunamadı. Metin temiz.';
    var satirlar = ['Toplam ' + sonuc.toplam + ' görünmez/olağandışı karakter bulundu:', ''];
    sonuc.ozet.forEach(function (o) {
      satirlar.push('  ' + o.kod + '  ' + o.ad + '  x' + o.adet);
    });
    satirlar.push('', 'Konumlar (satır:sütun):');
    sonuc.bulunanlar.slice(0, 200).forEach(function (b) {
      satirlar.push('  ' + b.satir + ':' + b.sutun + '  ' + b.kod + '  ' + b.ad + ' -> ' + b.islem);
    });
    if (sonuc.bulunanlar.length > 200) {
      satirlar.push('  ... ve ' + (sonuc.bulunanlar.length - 200) + ' tane daha');
    }
    return satirlar.join('\n');
  }

  var api = { temizle: temizle, raporMetni: raporMetni };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.GorunmezTemizleyici = api;
  }

  // ---- Komut satırı ----
  if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
    var fs = require('fs');
    var argv = process.argv.slice(2);
    var girdi = null;
    var cikis = null;
    var yerinde = false;
    var yalnizRapor = false;
    var emojiKoru = true;

    for (var a = 0; a < argv.length; a++) {
      var arg = argv[a];
      if (arg === '-o' || arg === '--cikti') cikis = argv[++a];
      else if (arg === '--yerinde') yerinde = true;
      else if (arg === '--rapor') yalnizRapor = true;
      else if (arg === '--emojileri-de-temizle') emojiKoru = false;
      else if (arg === '-h' || arg === '--yardim') {
        console.log([
          'Kullanım: node app.js [dosya] [seçenekler]',
          '',
          '  -o, --cikti <dosya>       Temiz metni bu dosyaya yaz',
          '  --yerinde                 Girdi dosyasının kendisini temizle',
          '  --rapor                   Yalnızca raporu göster',
          '  --emojileri-de-temizle    Emoji içindeki ZWJ / U+FE0F karakterlerini de sil',
          '  -h, --yardim              Bu yardımı göster',
          '',
          'Dosya verilmezse standart girdiden okunur.'
        ].join('\n'));
        process.exit(0);
      } else girdi = arg;
    }

    var metin = girdi ? fs.readFileSync(girdi, 'utf8') : fs.readFileSync(0, 'utf8');
    var sonuc = temizle(metin, { emojiKoru: emojiKoru });

    process.stderr.write(raporMetni(sonuc) + '\n');

    if (yalnizRapor) {
      process.exit(sonuc.toplam > 0 ? 1 : 0);
    }
    if (yerinde) {
      if (!girdi) {
        process.stderr.write('Hata: --yerinde için bir dosya adı verin.\n');
        process.exit(2);
      }
      fs.writeFileSync(girdi, sonuc.temiz, 'utf8');
      process.stderr.write('Dosya temizlendi: ' + girdi + '\n');
    } else if (cikis) {
      fs.writeFileSync(cikis, sonuc.temiz, 'utf8');
      process.stderr.write('Temiz metin yazıldı: ' + cikis + '\n');
    } else {
      process.stdout.write(sonuc.temiz);
    }
  }
})(typeof window !== 'undefined' ? window : this);
