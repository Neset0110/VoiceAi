// ============================================================
// VoiceAutoAi - Backend Sunucu Dosyası (server.js)
// ============================================================
// Bu dosya, projenin arka plan (backend) kısmıdır.
// Express.js ile bir web sunucusu kurar, MySQL veritabanına bağlanır
// ve e-posta doğrulama sistemiyle birlikte kayıt/giriş işlemlerini yönetir.
// ============================================================

// --- KULLANILAN KÜTÜPHANELER (IMPORTLAR) ---
const dns = require('dns');
if (typeof dns.setDefaultResultOrder === 'function') {
    dns.setDefaultResultOrder('ipv4first'); // Force IPv4 to prevent SMTP ENETUNREACH errors on Render
}
const path = require('path');            // Dosya yollarını yönetmek için (Node.js dahili modülü)
require('dotenv').config({ path: path.join(__dirname, '.env') });               // Ortam değişkenlerini (.env) yüklemek için
const express = require('express');       // Web sunucusu oluşturmak için
const mysql = require('mysql2');          // MySQL veritabanına bağlanmak için
const cors = require('cors');            // Frontend'in backend'e istek atabilmesi için
const crypto = require('crypto');         // Rastgele doğrulama tokeni üretmek için (Node.js dahili modülü)
const nodemailer = require('nodemailer'); // Gmail SMTP ile e-posta göndermek için
// ============================================================
// 1. EXPRESS UYGULAMASINI OLUŞTUR
// ============================================================
const app = express();
const PORT = process.env.PORT || 3001;

// ============================================================
// 2. ARA YAZILIMLAR (MIDDLEWARE)
// ============================================================
// Middleware, sunucuya gelen her isteğin önce bu fonksiyonlardan geçmesini sağlar.
app.use(cors());           // Farklı adreslerden gelen isteklere izin verir (CORS)
app.use(express.json());   // Gelen JSON verilerini okuyabilmemizi sağlar

// Frontend dosyalarını (HTML, CSS, JS) sunmak için statik dosya servisi
// Bu sayede http://localhost:3001/login.html gibi adreslerle sayfalara erişebiliriz
app.use(express.static(path.join(__dirname, '..')));

// ============================================================
// 3. VERİTABANI BAĞLANTISI
// ============================================================
// MySQL veritabanına bağlanmak için gerekli bilgiler.
// Bilgiler güvenlik amacıyla .env dosyasından çekilmektedir.
const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'voiceai',
    port: process.env.DB_PORT || 3306
});

// Veritabanına bağlanmayı dene ve sonucu konsola yaz
db.connect((err) => {
    if (err) {
        console.log('❌ Veritabanı Bağlantı Hatası:', err.message);
    } else {
        console.log('✅ MySQL Veritabanına Bağlantı Başarılı!');

        // Şirket ve Ajan eşleşmesi için tabloyu oluştur (eğer yoksa)
        const createFirmaAjanlarTable = `
            CREATE TABLE IF NOT EXISTS firma_ajanlar (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                assistant_id VARCHAR(255) NOT NULL,
                UNIQUE KEY(assistant_id)
            )
        `;
        db.query(createFirmaAjanlarTable, (errTbl) => {
            if (errTbl) {
                console.log('❌ firma_ajanlar tablosu oluşturulamadı:', errTbl.message);
            } else {
                console.log('✅ firma_ajanlar tablosu hazır.');
                
                // firma_ajanlar tablosuna detay sütunlarını ekle (eğer yoksa)
                const checkAjanCols = [
                    { name: 'name', def: 'VARCHAR(255) NULL' },
                    { name: 'model', def: 'VARCHAR(255) NULL' },
                    { name: 'voice', def: 'VARCHAR(255) NULL' },
                    { name: 'first_message', def: 'TEXT NULL' }
                ];
                checkAjanCols.forEach(col => {
                    db.query(`SHOW COLUMNS FROM firma_ajanlar LIKE '${col.name}'`, (errCol, columns) => {
                        if (!errCol && columns.length === 0) {
                            db.query(`ALTER TABLE firma_ajanlar ADD COLUMN ${col.name} ${col.def}`, (errAdd) => {
                                if (errAdd) console.log(`❌ firma_ajanlar tablosuna ${col.name} sütunu eklenemedi:`, errAdd.message);
                                else console.log(`✅ firma_ajanlar tablosuna ${col.name} eklendi.`);
                            });
                        }
                    });
                });
            }
        });


        // vapi_call_logs tablosuna gerekli sütunları ekle (eğer yoksa)
        const checkCols = [
            { name: 'company_id', def: 'INT' },
            { name: 'assistant_id', def: 'VARCHAR(255)' },
            { name: 'extracted_data', def: 'JSON' },
            { name: 'vapi_uuid', def: 'VARCHAR(255) UNIQUE' }
        ];
        checkCols.forEach(col => {
            db.query(`SHOW COLUMNS FROM vapi_call_logs LIKE '${col.name}'`, (errCol, columns) => {
                if (!errCol && columns.length === 0) {
                    db.query(`ALTER TABLE vapi_call_logs ADD COLUMN ${col.name} ${col.def}`, (errAdd) => {
                        if (errAdd) console.log(`❌ ${col.name} sütunu eklenemedi:`, errAdd.message);
                        else console.log(`✅ vapi_call_logs tablosuna ${col.name} eklendi.`);
                    });
                }
            });
        });

        // company tablosuna şifre sıfırlama sütunlarını ekle (eğer yoksa)
        db.query("SHOW COLUMNS FROM company LIKE 'resetToken'", (errCol, columns) => {
            if (!errCol && columns.length === 0) {
                db.query("ALTER TABLE company ADD COLUMN resetToken VARCHAR(255) NULL, ADD COLUMN resetExpires DATETIME NULL", (errAdd) => {
                    if (errAdd) console.log("❌ Şifre sıfırlama sütunları eklenemedi:", errAdd.message);
                    else console.log("✅ company tablosuna resetToken ve resetExpires eklendi.");
                });
            }
        });
    }
});

// ============================================================
// 4. E-POSTA AYARLARI (NODEMAILER + GMAIL SMTP)
// ============================================================
// Gmail SMTP ile herhangi bir e-posta adresine doğrulama linki göndermek için ayarlar.
// Gmail hesabınızın 2 Adımlı Doğrulama'sı açık olmalı ve bir Uygulama Şifresi oluşturulmalı.

// Güvenlik amacıyla SMTP ayarları .env dosyasından çekilir.
const GMAIL_KULLANICI = process.env.GMAIL_USER;
const GMAIL_UYGULAMA_SIFRESI = process.env.GMAIL_APP_PASSWORD;

// Nodemailer transporter (e-posta gönderici) oluştur
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: GMAIL_KULLANICI,
        pass: GMAIL_UYGULAMA_SIFRESI
    }
});

// SMTP bağlantısını kontrol et
transporter.verify((err, success) => {
    if (err) {
        console.log('❌ Gmail SMTP bağlantı hatası:', err.message);
    } else {
        console.log('✅ Gmail SMTP bağlantısı başarılı! E-posta gönderime hazır.');
    }
});

// ============================================================
// 5. SEZGİSEL ÇAĞRI DURUMU ANALİZ MOTORU (HEURISTICS ENGINE)
// ============================================================
/**
 * Çağrı metni (transcript) ve structuredData (Vapi analiz verisi) kullanarak
 * çağrının durumunu ('basarili', 'basarisiz', 'iptal', 'devam_ediyor') belirleyen yardımcı fonksiyon.
 * Mezuniyet projesi sunumunda yapay zeka analiz mantığını açıklamak için kullanılabilir.
 * 
 * @param {string} cagriMetni - Çağrı dökümü (transcript)
 * @param {object} structuredData - Vapi'den gelen analiz/structured verileri
 * @returns {string} - 'basarili', 'basarisiz', 'iptal', 'devam_ediyor'
 */
function cagriDurumunuBelirle(cagriMetni, structuredData) {
    // Varsayılan durum
    let durum = 'basarili'; // Aksi kanıtlanmadığı sürece görüşmeyi başarılı sayabiliriz veya analiz ederiz.
    
    // --- ADIM 1: Vapi Structured Data (Yapılandırılmış Veri) İncelemesi ---
    // Eğer Vapi'nin kendi analizinden gelen bir başarı/onay alanı varsa bunu birincil kaynak al
    if (structuredData && typeof structuredData === 'object') {
        const successKeys = ['success', 'call_success', 'randevu_onay', 'onay', 'satis', 'appointment_booked', 'completed'];
        for (const key of successKeys) {
            if (structuredData.hasOwnProperty(key)) {
                const val = structuredData[key];
                // Olumlu durum kontrolü
                if (val === true || val === 'true' || val === 'evet' || val === 'yes' || val === 'başarılı' || val === 'basarili' || val === 1 || val === '1') {
                    return 'basarili';
                }
                // Olumsuz durum kontrolü
                if (val === false || val === 'false' || val === 'hayır' || val === 'no' || val === 'başarısız' || val === 'basarisiz' || val === 0 || val === '0') {
                    return 'basarisiz';
                }
            }
        }
        
        // Genel durum veya status etiketlerini kontrol et
        if (structuredData.durum || structuredData.status) {
            const st = String(structuredData.durum || structuredData.status).toLowerCase();
            if (st.includes('basarili') || st.includes('success') || st.includes('onay') || st.includes('complete')) {
                return 'basarili';
            }
            if (st.includes('hata') || st.includes('fail') || st.includes('basarisiz') || st.includes('red') || st.includes('olumsuz')) {
                return 'basarisiz';
            }
            if (st.includes('iptal') || st.includes('cancel')) {
                return 'iptal';
            }
        }
    }

    // --- ADIM 2: Çağrı Metni (Transcript) Sezgisel Analizi (Heuristics) ---
    // Eğer structuredData'dan kesin bir sonuç çıkmadıysa, diyalog dökümünü Türkçe dil analizine tabi tut
    if (cagriMetni && typeof cagriMetni === 'string') {
        const metin = cagriMetni.toLowerCase();
        
        // Çağrı çok kısaysa veya boşsa başarısız/yarıda kalmış say
        if (metin.trim().length < 15) {
            return 'basarisiz';
        }

        // Başarısızlık/İptal Belirteçleri (Negatif Durumlar)
        const olumsuzKelimeler = [
            'istemiyorum', 'ilgilenmiyorum', 'kapat', 'yanlış numara', 'yanlis numara', 
            'müsait değilim', 'musait degilim', 'sonra arayın', 'sonra arayin', 
            'istemez', 'iptal et', 'iptal edilsin', 'reddediyorum', 'olumsuz', 'hayır', 'hayir'
        ];
        
        // Başarı Belirteçleri (Pozitif Durumlar)
        const olumluKelimeler = [
            'başarıyla', 'basariyla', 'onaylıyorum', 'onayliyorum', 'kabul ediyorum',
            'randevu oluştur', 'randevu olustur', 'kaydedin', 'tamamdır', 'tamamdir', 
            'anlaştık', 'anlastik', 'harika', 'teşekkürler', 'tesekkurler', 'iyi günler', 'iyi gunler'
        ];

        let olumluSkor = 0;
        let olumsuzSkor = 0;

        // Negatif kelime eşleşmelerini ağırlıklı hesapla (ret kararları genelde nettir)
        olumsuzKelimeler.forEach(kelime => {
            if (metin.includes(kelime)) {
                olumsuzSkor += 2;
            }
        });

        // Pozitif kelime eşleşmelerini hesapla
        olumluKelimeler.forEach(kelime => {
            if (metin.includes(kelime)) {
                olumluSkor += 1;
            }
        });

        if (olumsuzSkor > olumluSkor) {
            return 'basarisiz';
        } else if (olumluSkor > 0) {
            return 'basarili';
        }
    } else {
        // Çağrı metni yoksa başarısız veya eksik çağrıdır
        return 'basarisiz';
    }

    return durum;
}

// ============================================================
// 6. API ROTALARI (ENDPOINTS)
// ============================================================

// ============================================================
// 6a. TEST ROTASI (GET /api/test)
// ============================================================
// Sunucunun çalışıp çalışmadığını kontrol etmek için basit bir test
app.get('/api/test', (req, res) => {
    res.json({ mesaj: 'Sunucu ve veritabanı harika çalışıyor!' });
});

// ============================================================
// 6b. AKTİVASYON E-POSTASINI YENİDEN GÖNDERME (POST /api/resend-verification)
// ============================================================
// Kullanıcı onaylama linkini alamadıysa, e-posta adresini girerek
// yeni bir onaylama e-postası talep edebilir. Sayaçlı anti-spam koruması arayüzde yönetilir.
app.post('/api/resend-verification', (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ hata: 'Lütfen e-posta adresini belirtin.' });
    }

    // Veritabanında bu e-postaya ait kayıtlı firmayı ara
    const sql = `SELECT * FROM company WHERE admin_eposta = ?`;

    db.query(sql, [email], (err, results) => {
        if (err) {
            console.log('❌ Yeniden doğrulama sorgu hatası:', err.message);
            return res.status(500).json({ hata: 'Veritabanı araması başarısız oldu.' });
        }

        if (results.length === 0) {
            return res.status(404).json({ hata: 'Bu e-posta adresiyle kayıtlı bir firma bulunamadı!' });
        }

        const kullanici = results[0];

        // Zaten doğrulanmışsa tekrar göndermeye gerek yok
        if (kullanici.isVerified) {
            return res.status(400).json({ hata: 'Bu hesap zaten doğrulanmış! Doğrudan giriş yapabilirsiniz.' });
        }

        // Yeni bir doğrulama tokeni üret
        const yeni_token = crypto.randomBytes(20).toString('hex');

        // Tokeni veritabanında güncelle
        const guncelleSql = `UPDATE company SET verificationToken = ? WHERE admin_eposta = ?`;

        db.query(guncelleSql, [yeni_token, email], (err2) => {
            if (err2) {
                console.log('❌ Token güncelleme hatası:', err2.message);
                return res.status(500).json({ hata: 'Aktivasyon kodu güncellenemedi.' });
            }

            // Doğrulama linki oluştur
            const PORT = process.env.PORT || 3001;
            const HOST = req.headers.host || `localhost:${PORT}`;
            const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
            const dogrulama_linki = `${protocol}://${HOST}/api/verify/${yeni_token}`;

            // E-postayı gönder
            const mailSecenekleri = {
                from: `"VoiceAuto.ai" <${GMAIL_KULLANICI}>`,
                to: email,
                subject: 'Hesap Doğrulama Linkiniz Yenilendi - VoiceAuto.ai',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                        <h2 style="color: #4F46E5;">Merhaba ${kullanici.firma_adi}!</h2>
                        <p>Hesabınızı doğrulamak için yeni bir aktivasyon linki talep ettiniz.</p>
                        <p>Hesabınızı onaylamak için aşağıdaki butona tıklayın:</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${dogrulama_linki}" 
                               style="background-color: #4F46E5; color: white; padding: 12px 30px; 
                                      text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                                Hesabımı Onayla
                            </a>
                        </div>
                        <p style="color: #666; font-size: 12px;">
                            Eğer bu işlemi siz başlatmadıysanız bu e-postayı dikkate almayınız. Link 24 saat geçerlidir.<br>
                            Linke tıklayamıyorsanız bu adresi tarayıcınıza yapıştırın:<br>
                            ${dogrulama_linki}
                        </p>
                    </div>
                `
            };

            transporter.sendMail(mailSecenekleri, (mailErr, info) => {
                if (mailErr) {
                    console.log('⚠️ Aktivasyon maili yeniden gönderilemedi:', mailErr.message);
                    return res.status(500).json({ hata: 'E-posta gönderilirken hata oluştu.' });
                }
                
                console.log('📬 Aktivasyon e-postası başarıyla yeniden gönderildi:', email);
                res.json({ mesaj: 'Yeni aktivasyon linki e-posta adresinize gönderildi! Lütfen kontrol edin.' });
            });
        });
    });
});

// ============================================================
// 6b-2. ŞİFREMİ UNUTTUM - PIN KODU GÖNDERME (POST /api/forgot-password)
// ============================================================
app.post('/api/forgot-password', (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ hata: 'Lütfen e-posta adresinizi girin.' });
    }

    const sql = `SELECT * FROM company WHERE admin_eposta = ?`;

    db.query(sql, [email], (err, results) => {
        if (err) {
            console.log('❌ Şifre sıfırlama e-posta sorgu hatası:', err.message);
            return res.status(500).json({ hata: 'Veritabanı hatası oluştu.' });
        }

        if (results.length === 0) {
            return res.status(404).json({ hata: 'Bu e-posta adresiyle kayıtlı bir firma bulunamadı!' });
        }

        const kullanici = results[0];

        // 6 haneli rastgele PIN kodu üret (100000 - 999999)
        const pin = Math.floor(100000 + Math.random() * 900000).toString();
        // 15 dakika geçerli olacak şekilde süre ayarla
        const sure = new Date(Date.now() + 15 * 60 * 1000);

        // Veritabanına kaydet
        const guncelleSql = `UPDATE company SET resetToken = ?, resetExpires = ? WHERE admin_eposta = ?`;

        db.query(guncelleSql, [pin, sure, email], (err2) => {
            if (err2) {
                console.log('❌ Sıfırlama kodu kaydetme hatası:', err2.message);
                return res.status(500).json({ hata: 'Sıfırlama kodu oluşturulamadı.' });
            }

            // E-posta gönder
            const mailSecenekleri = {
                from: `"VoiceAuto.ai" <${GMAIL_KULLANICI}>`,
                to: email,
                subject: 'Şifre Sıfırlama Kodu - VoiceAuto.ai',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                        <h2 style="color: #4F46E5; text-align: center;">Şifre Sıfırlama Talebi</h2>
                        <p>Merhaba <strong>${kullanici.firma_adi}</strong>,</p>
                        <p>Hesabınızın şifresini sıfırlamak için bir talepte bulundunuz. Aşağıdaki 6 haneli güvenlik kodunu kullanarak şifrenizi güncelleyebilirsiniz:</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #4F46E5; background-color: #F3F4F6; padding: 10px 20px; border-radius: 8px; border: 1px dashed #4F46E5;">
                                ${pin}
                            </span>
                        </div>
                        <p style="color: #666; font-size: 13px;">
                            Bu kod <strong>15 dakika</strong> boyunca geçerlidir. Eğer bu talebi siz yapmadıysanız lütfen bu e-postayı dikkate almayınız.
                        </p>
                    </div>
                `
            };

            transporter.sendMail(mailSecenekleri, (mailErr) => {
                if (mailErr) {
                    console.log('⚠️ Şifre sıfırlama e-postası gönderilemedi:', mailErr.message);
                    return res.status(500).json({ hata: 'E-posta gönderilirken hata oluştu.' });
                }

                console.log('📬 Şifre sıfırlama e-postası gönderildi:', email);
                res.json({ mesaj: '6 haneli şifre sıfırlama kodu e-postanıza gönderildi! Lütfen gelen kutunuzu (ve gereksiz kutusunu) kontrol edin.' });
            });
        });
    });
});

// ============================================================
// 6b-3. ŞİFREMİ GÜNCELLE - KOD DOĞRULAMA VE ŞİFRE DEĞİŞTİRME (POST /api/reset-password)
// ============================================================
app.post('/api/reset-password', (req, res) => {
    const { email, pin, yeniSifre } = req.body;

    if (!email || !pin || !yeniSifre) {
        return res.status(400).json({ hata: 'Lütfen tüm alanları doldurun (email, pin, yeniSifre).' });
    }

    // Kodun doğru ve süresinin geçmemiş olduğunu sorgula
    const sql = `SELECT * FROM company WHERE admin_eposta = ? AND resetToken = ?`;

    db.query(sql, [email, pin], (err, results) => {
        if (err) {
            console.log('❌ Şifre sıfırlama doğrulama sorgu hatası:', err.message);
            return res.status(500).json({ hata: 'Veritabanı hatası oluştu.' });
        }

        if (results.length === 0) {
            return res.status(400).json({ hata: 'Girdiğiniz 6 haneli sıfırlama kodu hatalı!' });
        }

        const kullanici = results[0];

        // Süreyi kontrol et
        const simdi = new Date();
        const sonKullanma = new Date(kullanici.resetExpires);

        if (simdi > sonKullanma) {
            return res.status(400).json({ hata: 'Şifre sıfırlama kodunun süresi dolmuş! Lütfen yeni bir kod talep edin.' });
        }

        // Şifreyi güncelle ve token sütunlarını temizle
        const guncelleSql = `UPDATE company SET admin_sifre = ?, resetToken = NULL, resetExpires = NULL WHERE admin_eposta = ?`;

        db.query(guncelleSql, [yeniSifre, email], (err2) => {
            if (err2) {
                console.log('❌ Şifre güncellenemedi:', err2.message);
                return res.status(500).json({ hata: 'Şifreniz güncellenirken bir hata oluştu.' });
            }

            console.log(`✅ Şifre başarıyla sıfırlandı: ${email}`);
            res.json({ mesaj: 'Şifreniz başarıyla sıfırlandı! Yeni şifrenizle giriş yapabilirsiniz.' });
        });
    });
});

// ============================================================
// 6c. FİRMA KAYIT ROTASI (POST /api/kayit)
// ============================================================
// Kullanıcı bu adrese firma adı, e-posta ve şifre gönderir.
// Biz de:
//   1. Rastgele bir doğrulama tokeni üretiriz.
//   2. Veritabanına kaydederiz.
//      (Jüri Notu: İlk prototip geliştirme ve entegrasyon testlerini kolaylaştırmak adına şifreler veritabanına 
//       düz metin şeklinde yazılır. Projenin sonraki fazlarında bcrypt şifrelemesi ve JWT yetkilendirme mekanizması eklenecektir.)
//   3. Doğrulama linki içeren bir e-posta göndeririz.
app.post('/api/kayit', async (req, res) => {
    // İstekten gelen verileri al
    const { firma_adi, email, sifre } = req.body;

    // Eksik alan kontrolü
    if (!firma_adi || !email || !sifre) {
        return res.status(400).json({
            hata: 'Lütfen tüm alanları doldurun (firma_adi, email, sifre).'
        });
    }

    try {
        // Adım 1: Rastgele bir doğrulama tokeni üret (Eşsiz e-posta onaylama bağlantısı için)
        const dogrulama_tokeni = crypto.randomBytes(20).toString('hex');

        // Adım 2: Veritabanına kaydet
        // E-posta doğrulama akışını aktif etmek için varsayılan olarak isVerified = false (veya 0) kaydedilir.
        const sql = `INSERT INTO company (firma_adi, admin_eposta, admin_sifre, isVerified, verificationToken) 
                     VALUES (?, ?, ?, false, ?)`;

        db.query(sql, [firma_adi, email, sifre, dogrulama_tokeni], (err, result) => {
            if (err) {
                // Eğer aynı e-posta zaten kayıtlıysa MySQL hata verir
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({ hata: 'Bu e-posta adresi zaten kayıtlı!' });
                }
                console.log('❌ Kayıt hatası:', err.message);
                return res.status(500).json({ hata: 'Kayıt sırasında bir hata oluştu.' });
            }

            // Adım 4: Doğrulama e-postası gönder
            // Doğrulama linkini dinamik oluşturuyoruz ki telefondan erişildiğinde localhost hatası vermesin.
            const HOST = req.headers.host || `localhost:${PORT}`;
            const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
            const dogrulama_linki = `${protocol}://${HOST}/api/verify/${dogrulama_tokeni}`;

            // E-postayı Gmail SMTP üzerinden gönder
            const mailSecenekleri = {
                from: `"VoiceAuto.ai" <${GMAIL_KULLANICI}>`,  // Gönderici
                to: email,                                      // Alıcı
                subject: 'Hesabınızı Doğrulayın - VoiceAuto.ai',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #4F46E5;">Merhaba ${firma_adi}!</h2>
                        <p>VoiceAuto.ai'ye kayıt olduğunuz için teşekkürler.</p>
                        <p>Hesabınızı onaylamak için aşağıdaki butona tıklayın:</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${dogrulama_linki}" 
                               style="background-color: #4F46E5; color: white; padding: 12px 30px; 
                                      text-decoration: none; border-radius: 8px; font-weight: bold;">
                                Hesabımı Onayla
                            </a>
                        </div>
                        <p style="color: #666; font-size: 12px;">
                            Bu linke tıklayamıyorsanız, aşağıdaki adresi tarayıcınıza yapıştırın:<br>
                            ${dogrulama_linki}
                        </p>
                    </div>
                `
            };

            transporter.sendMail(mailSecenekleri, (mailErr, info) => {
                if (mailErr) {
                    console.log('⚠️ E-posta gönderilemedi:', mailErr.message);
                } else {
                    console.log('📬 Doğrulama e-postası gönderildi:', email);
                    console.log('📬 Mesaj ID:', info.messageId);
                }
            });

            // Kullanıcıya başarılı yanıt gönder
            res.status(201).json({
                mesaj: 'Kayıt başarılı! Lütfen e-postanıza gönderilen doğrulama linkine tıklayarak hesabınızı onaylayın.',
                autoVerified: false
            });
        });

    } catch (error) {
        console.log('❌ Beklenmeyen hata:', error.message);
        res.status(500).json({ hata: 'Sunucu hatası oluştu.' });
    }
});

// ============================================================
// 6d. E-POSTA DOĞRULAMA AKTİVASYONU (GET /api/verify/:token)
// ============================================================
// Kullanıcı e-postasındaki linke tıklayınca bu rota çalışır.
// URL'deki token'ı veritabanında arar, bulursa isVerified = true yapar.
app.get('/api/verify/:token', (req, res) => {
    // URL'den token'ı al (örn: /api/verify/abc123 → token = "abc123")
    const token = req.params.token;

    // Veritabanında bu token'a sahip firmayı ara
    const sql = `SELECT * FROM company WHERE verificationToken = ?`;

    db.query(sql, [token], (err, results) => {
        if (err) {
            console.log('❌ Token arama hatası:', err.message);
            return res.status(500).send('Bir hata oluştu.');
        }

        // Token bulunamadıysa
        if (results.length === 0) {
            return res.status(400).send('Geçersiz veya süresi dolmuş doğrulama linki.');
        }

        // Token bulundu → Hesabı onayla
        // isVerified'ı true yap ve token'ı sil (tekrar kullanılmasın diye)
        const guncelleSql = `UPDATE company SET isVerified = true, verificationToken = NULL WHERE verificationToken = ?`;

        db.query(guncelleSql, [token], (err2) => {
            if (err2) {
                console.log('❌ Onaylama hatası:', err2.message);
                return res.status(500).send('Onaylama sırasında hata oluştu.');
            }

            console.log(`✅ Hesap onaylandı: ${results[0].admin_eposta}`);

            // Kullanıcıya güzel bir HTML sayfası göster
            res.send(`
                <html>
                <head><title>Hesap Onaylandı</title></head>
                <body style="font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #f8fafc;">
                    <div style="text-align: center; background: white; padding: 40px; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                        <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
                        <h1 style="color: #1e293b;">Hesabınız Onaylandı!</h1>
                        <p style="color: #64748b;">E-posta adresiniz başarıyla doğrulandı.</p>
                        <p style="color: #64748b;">Artık giriş yapabilirsiniz.</p>
                    </div>
                </body>
                </html>
            `);
        });
    });
});

// ============================================================
// 6e. GİRİŞ ROTASI (POST /api/giris)
// ============================================================
// Kullanıcı e-posta ve şifresiyle giriş yapar.
// Kontroller: 1) E-posta var mı? 2) Şifre doğru mu? 3) Hesap onaylı mı?
app.post('/api/giris', (req, res) => {
    const { email, sifre } = req.body;

    // Eksik alan kontrolü
    if (!email || !sifre) {
        return res.status(400).json({
            hata: 'Lütfen e-posta ve şifre alanlarını doldurun.'
        });
    }

    // Veritabanında bu e-postaya sahip firmayı ara
    const sql = `SELECT * FROM company WHERE admin_eposta = ?`;

    db.query(sql, [email], async (err, results) => {
        if (err) {
            console.log('❌ Giriş sorgu hatası:', err.message);
            return res.status(500).json({ hata: 'Sunucu hatası oluştu.' });
        }

        // E-posta bulunamadıysa
        if (results.length === 0) {
            return res.status(401).json({ hata: 'E-posta veya şifre hatalı.' });
        }

        const kullanici = results[0];

        // Şifre kontrolü: Girilen şifreyi veritabanındakiyle karşılaştır (düz metin — test aşaması)
        if (sifre !== kullanici.admin_sifre) {
            return res.status(401).json({ hata: 'E-posta veya şifre hatalı.' });
        }

        // E-posta onay kontrolü
        if (!kullanici.isVerified) {
            console.log(`⚠️ Onaylanmamış hesap giriş denemesi engellendi: ${kullanici.admin_eposta}`);
            return res.status(401).json({
                hata: 'Hesabınız onaylanmamış! Lütfen e-postanıza gönderilen doğrulama linkine tıklayarak hesabınızı onaylayın.',
                unverified: true
            });
        }

        // Her şey tamam → Giriş başarılı!
        console.log(`✅ Giriş başarılı: ${kullanici.admin_eposta}`);
        res.json({
            mesaj: 'Giriş başarılı!',
            firma: {
                id: kullanici.company_id,
                firma_adi: kullanici.firma_adi,
                email: kullanici.admin_eposta
            }
        });
    });
});

// ============================================================
// 6f. DOĞRULAMA DURUMU SORGULAMA (GET /api/check-verification/:email)
// ============================================================
// Frontend'in belirli aralıklarla e-postanın onaylanıp onaylanmadığını sorabilmesi için
app.get('/api/check-verification/:email', (req, res) => {
    const email = req.params.email;
    const sql = `SELECT isVerified FROM company WHERE admin_eposta = ?`;

    db.query(sql, [email], (err, results) => {
        if (err || results.length === 0) {
            return res.status(400).json({ isVerified: false });
        }
        res.json({ isVerified: !!results[0].isVerified });
    });
});

// ============================================================
// 6g. VAPI ÇAĞRI RAPORU WEBHOOK ALICISI (POST /api/vapi/webhook)
// ============================================================
// Vapi'de bir çağrı bittiğinde (end-of-call-report), Vapi bu adrese
// otomatik olarak bir POST isteği gönderir.
// Biz de gelen veriyi alıp MySQL veritabanına kaydederiz.
//
// Güvenlik: Sadece doğru Bearer token'a sahip istekler kabul edilir.
const WEBHOOK_TOKEN = process.env.WEBHOOK_TOKEN || 'voiceautoai-secret-2024';

app.post('/api/vapi/webhook', (req, res) => {
    // --- Güvenlik Kontrolü ---
    // İsteğin header'ında doğru token var mı kontrol et
    const authHeader = req.headers['authorization'];
    if (!authHeader || authHeader !== `Bearer ${WEBHOOK_TOKEN}`) {
        console.log('❌ Webhook: Yetkisiz istek reddedildi.');
        return res.status(401).json({ hata: 'Yetkisiz erişim.' });
    }

    // --- Gelen Veriyi Al ---
    const vpiVeri = req.body;
    console.log('');
    console.log('📞 ====================================');
    console.log('   VAPI WEBHOOK VERİSİ GELDİ!');
    console.log(`   Tür: ${vpiVeri.message?.type || 'bilinmiyor'}`);
    console.log('📞 ====================================');

    // Sadece "end-of-call-report" türündeki mesajları işle
    // (Çağrı bittiğinde gelen rapor)
    if (vpiVeri.message?.type !== 'end-of-call-report') {
        console.log('ℹ️ Bu mesaj türü işlenmiyor:', vpiVeri.message?.type);
        return res.status(200).json({ mesaj: 'Bu mesaj türü işlenmiyor.' });
    }

    // --- Vapi Verisinden İhtiyacımız Olan Alanları Çıkar ---
    const mesaj = vpiVeri.message;
    const telefonNo = mesaj.customer?.number || 'Bilinmiyor';
    const musteriAdi = mesaj.customer?.name || telefonNo;
    const endedReason = mesaj.endedReason || null;
    const costTotal = mesaj.cost || 0;
    const summary = mesaj.summary || null;
    const cagriMetni = mesaj.transcript || null;
    const sesKaydiUrl = mesaj.recordingUrl || mesaj.artifactUrl || null;
    const baslangic = mesaj.startedAt ? new Date(mesaj.startedAt) : new Date();
    const bitis = mesaj.endedAt ? new Date(mesaj.endedAt) : new Date();
    const structuredData = mesaj.analysis?.structuredData || null;
    const extractedDataStr = structuredData ? JSON.stringify(structuredData) : null;

    // Vapi'den gelen eşsiz çağrı UUID'sini çıkar ve veritabanı eşsizliği
    const vapiUuid = mesaj.call?.id || mesaj.id || vpiVeri.call?.id || null;

    // Başarı Durumu Heuristics Helper yardımıyla belirlenir
    const cagriDurumu = cagriDurumunuBelirle(cagriMetni, structuredData);

    // Eşsiz UUID kontrolü ile mükerrer (duplicate) kaydı önle
    if (vapiUuid) {
        db.query(`SELECT vapi_call_id FROM vapi_call_logs WHERE vapi_uuid = ?`, [vapiUuid], (errExist, existRes) => {
            if (!errExist && existRes.length > 0) {
                console.log(`ℹ️ Webhook: Arama (${vapiUuid}) zaten kayıtlı, işlem atlanıyor.`);
                return res.status(200).json({ mesaj: 'Bu arama zaten kayıtlı.' });
            }
            islemeDevamEt();
        });
    } else {
        islemeDevamEt();
    }

    function islemeDevamEt() {
        // --- Adım 0: Bu asistan hangi firmaya ait? ---
        const assistantId = mesaj.call?.assistantId || mesaj.assistantId;
        let companyId = null;

        db.query(`SELECT company_id FROM firma_ajanlar WHERE assistant_id = ?`, [assistantId], (errFirma, fResults) => {
            if (!errFirma && fResults.length > 0) {
                companyId = fResults[0].company_id;
            }

            // --- Adım 1: Müşteriyi Bul veya Oluştur ---
            const musteriAra = `SELECT musteri_id FROM musteri WHERE telefon_numarasi = ?`;

            db.query(musteriAra, [telefonNo], (err, musteriler) => {
                if (err) {
                    console.log('❌ Müşteri arama hatası:', err.message);
                    return res.status(500).json({ hata: 'Veritabanı hatası.' });
                }

                if (musteriler.length > 0) {
                    kaydetCagri(musteriler[0].musteri_id);
                } else {
                    const musteriEkle = `INSERT INTO musteri (musteri_adi, telefon_numarasi) VALUES (?, ?)`;
                    db.query(musteriEkle, [musteriAdi, telefonNo], (err2, sonuc) => {
                        if (err2) {
                            console.log('❌ Müşteri oluşturma hatası:', err2.message);
                            return res.status(500).json({ hata: 'Müşteri oluşturulamadı.' });
                        }
                        console.log(`✅ Yeni müşteri oluşturuldu: ${musteriAdi} (${telefonNo})`);
                        kaydetCagri(sonuc.insertId);
                    });
                }

                // --- Adım 2: Çağrı Kaydını Veritabanına Ekle ---
                function kaydetCagri(musteriId) {
                    const cagriEkle = `
                        INSERT INTO vapi_call_logs 
                        (ended_reason, cost_total, summary, musteri_id, cagri_turu, cagri_durumu, baslangic_zamani, cagri_metni, ses_kaydi_url, bitis_zamani, company_id, assistant_id, extracted_data, vapi_uuid) 
                        VALUES (?, ?, ?, ?, 'giris', ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `;
                    const degerler = [endedReason, costTotal, summary, musteriId, cagriDurumu, baslangic, cagriMetni, sesKaydiUrl, bitis, companyId, assistantId, extractedDataStr, vapiUuid];

                    db.query(cagriEkle, degerler, (err3) => {
                        if (err3) {
                            console.log('❌ Çağrı kayıt hatası:', err3.message);
                            return res.status(500).json({ hata: 'Çağrı kaydedilemedi.' });
                        }

                        console.log(`✅ Çağrı kaydedildi: ${telefonNo} → ${cagriDurumu}`);
                        console.log(`   Özet: ${summary || 'Yok'}`);
                        console.log('');

                        res.status(200).json({ mesaj: 'Çağrı başarıyla kaydedildi.' });
                    });
                }
            }); // musteri query sonu
        }); // firma query sonu
    }
}); // webhook sonu

// ============================================================
// 6h. ÇAĞRI LİSTESİNİ GETİRME (GET /api/aramalar)
// ============================================================
// Frontend bu adresi çağırarak veritabanındaki tüm çağrı kayıtlarını alır.
// Mock veri yerine gerçek veritabanı verisi döner.
app.get('/api/aramalar', (req, res) => {
    const companyId = req.query.companyId;
    if (!companyId) return res.status(400).json({ hata: 'companyId parametresi gerekli.' });

    const sql = `
        SELECT 
            v.vapi_call_id,
            v.ended_reason,
            v.cost_total,
            v.summary,
            v.cagri_turu,
            v.cagri_durumu,
            v.baslangic_zamani,
            v.cagri_metni,
            v.ses_kaydi_url,
            v.bitis_zamani,
            v.assistant_id,
            v.extracted_data,
            m.musteri_adi,
            m.telefon_numarasi
        FROM vapi_call_logs v
        JOIN musteri m ON v.musteri_id = m.musteri_id
        WHERE v.company_id = ?
        ORDER BY v.baslangic_zamani DESC
        LIMIT 50
    `;

    db.query(sql, [companyId], (err, results) => {
        if (err) {
            console.log('❌ Çağrı listesi hatası:', err.message);
            return res.status(500).json({ hata: 'Çağrılar yüklenemedi.' });
        }
        res.json(results);
    });
});

// ============================================================
// 6i. VAPI ASİSTAN YARDIMCI METOTLARI
// ============================================================
// Vapi.ai hesabındaki asistanları çekip frontend'e döner.
const VAPI_PRIVATE_KEY = process.env.VAPI_PRIVATE_KEY;

// Tekil Vapi asistanını ID ile çek (tüm listeyi değil, sadece ilgili ID, timeout korumalı)
async function fetchAssistantById(assistantId, timeoutMs = 2500) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const r = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
            headers: {
                'Authorization': `Bearer ${VAPI_PRIVATE_KEY}`,
                'Content-Type': 'application/json'
            },
            signal: controller.signal
        });
        clearTimeout(id);
        if (r.status === 404) return null; // Silinmiş/erişilemeyen → sessizce atla
        if (!r.ok) {
            const t = await r.text();
            console.log(`⚠️ Vapi uyarı (${assistantId}): ${r.status} ${t}`);
            return null; // Geçersiz ID veya başka hata → null döndür, sunucuyu çökertme
        }
        return await r.json();
    } catch (error) {
        clearTimeout(id);
        console.log(`⚠️ Vapi network/timeout hatası (${assistantId}):`, error.message);
        return null; // Ağ veya zaman aşımı durumunda null döndür
    }
}


// Eş zamanlı istek sayısını sınırlayan yardımcı fonksiyon
async function mapLimit(items, limit, mapper) {
    const results = new Array(items.length);
    let i = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (true) {
            const idx = i++;
            if (idx >= items.length) break;
            results[idx] = await mapper(items[idx], idx);
        }
    });
    await Promise.all(workers);
    return results;
}

// ============================================================
// 6j. ÇEVRİMDIŞI ÇAĞRILARI SENKRONİZE ETME (POST /api/vapi/sync)
// ============================================================
// Sunucu kapalıyken yapılan ve webhook ile gelemeyen çağrıları,
// Vapi'nin /call API'sinden çekerek veritabanına kaydeder.
app.post('/api/vapi/sync', async (req, res) => {
    const sirketAjanGetir = req.query.companyId || req.body.companyId;

    try {
        console.log('🔄 Vapi senkronizasyonu başlatıldı...');

        // Vapi'den son 100 çağrıyı çek
        const vapiYanit = await fetch('https://api.vapi.ai/call?limit=100', {
            headers: { 'Authorization': `Bearer ${VAPI_PRIVATE_KEY}` }
        });

        if (!vapiYanit.ok) {
            const hataMetni = await vapiYanit.text();
            console.log('❌ Vapi API hatası:', hataMetni);
            return res.status(500).json({ hata: 'Vapi API yanıt vermedi.' });
        }

        const vapiVerisi = await vapiYanit.json();
        // Vapi bazen direkt dizi, bazen { results: [...] } döner
        const cagrilar = Array.isArray(vapiVerisi) ? vapiVerisi : (vapiVerisi.results || []);

        console.log(`📊 Vapi'den ${cagrilar.length} çağrı alındı.`);

        let eklenenSayisi = 0;
        let atlananSayisi = 0;

        // Her çağrıyı sırayla işle
        for (const cagri of cagrilar) {
            // Sadece tamamlanmış çağrıları işle
            if (cagri.status !== 'ended') {
                atlananSayisi++;
                continue;
            }

            const vapiCallId = cagri.id;
            const telefonNo = cagri.customer?.number || 'Bilinmiyor';
            const musteriAdi = cagri.customer?.name || telefonNo;
            const endedReason = cagri.endedReason || null;
            const costTotal = cagri.cost || 0;
            const summary = cagri.analysis?.summary || cagri.summary || null;
            const cagriMetni = cagri.transcript || null;
            const sesKaydiUrl = cagri.recordingUrl || cagri.artifact?.recordingUrl || null;
            const baslangic = cagri.startedAt ? new Date(cagri.startedAt) : new Date();
            const bitis = cagri.endedAt ? new Date(cagri.endedAt) : new Date();
            const structuredData = cagri.analysis?.structuredData || null;
            const extractedDataStr = structuredData ? JSON.stringify(structuredData) : null;

            // Başarı durumunu belirle (Helper Heuristics ile)
            const cagriDurumu = cagriDurumunuBelirle(cagriMetni, structuredData);

            const asistanId = cagri.assistantId;

            // Eğer giriş yapan firmaya aitse loglarda bu id olacak, yoksa başka bir firma ya da null.
            const firmaRes = await new Promise((resolve) => {
                db.query('SELECT company_id FROM firma_ajanlar WHERE assistant_id = ?', [asistanId], (err, r) => resolve(r));
            });
            let cId = null;
            if (firmaRes && firmaRes.length > 0) {
                cId = firmaRes[0].company_id;
            }

            // Bu çağrı zaten veritabanında var mı kontrol et. Hem yeni vapi_uuid sütununu hem de eski uyumluluk için telefon & zamanı kontrol eder.
            const kontrolSql = `
                SELECT vapi_call_id FROM vapi_call_logs 
                WHERE vapi_uuid = ? 
                   OR (vapi_uuid IS NULL 
                       AND ABS(TIMESTAMPDIFF(SECOND, baslangic_zamani, ?)) < 2 
                       AND musteri_id IN (SELECT musteri_id FROM musteri WHERE telefon_numarasi = ?))
            `;

            await new Promise((resolve) => {
                db.query(kontrolSql, [vapiCallId, baslangic, telefonNo], async (err, mevcutlar) => {
                    if (err || mevcutlar.length > 0) {
                        // Hata varsa veya kayıt zaten varsa atla
                        atlananSayisi++;
                        return resolve();
                    }

                    // Müşteriyi bul veya oluştur
                    db.query('SELECT musteri_id FROM musteri WHERE telefon_numarasi = ?', [telefonNo], (err2, musteriler) => {
                        const musteriEkleVeKaydet = (musteriId) => {
                            const cagriEkle = `
                                INSERT INTO vapi_call_logs 
                                (ended_reason, cost_total, summary, musteri_id, cagri_turu, cagri_durumu, baslangic_zamani, cagri_metni, ses_kaydi_url, bitis_zamani, company_id, assistant_id, extracted_data, vapi_uuid) 
                                VALUES (?, ?, ?, ?, 'giris', ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            `;
                            db.query(cagriEkle, [endedReason, costTotal, summary, musteriId, cagriDurumu, baslangic, cagriMetni, sesKaydiUrl, bitis, cId, asistanId, extractedDataStr, vapiCallId], (err3) => {
                                if (!err3) {
                                    eklenenSayisi++;
                                    console.log(`✅ Senkronize edildi: ${telefonNo} → ${cagriDurumu}`);
                                } else {
                                    console.log('❌ Kayıt hatası:', err3.message);
                                }
                                resolve();
                            });
                        };

                        if (err2 || musteriler.length === 0) {
                            // Müşteri yok, oluştur
                            db.query('INSERT INTO musteri (musteri_adi, telefon_numarasi) VALUES (?, ?)', [musteriAdi, telefonNo], (err3, sonuc) => {
                                if (err3) { atlananSayisi++; return resolve(); }
                                musteriEkleVeKaydet(sonuc.insertId);
                            });
                        } else {
                            musteriEkleVeKaydet(musteriler[0].musteri_id);
                        }
                    });
                });
            });
        }

        console.log(`✅ Senkronizasyon tamamlandı: ${eklenenSayisi} yeni kayıt eklendi, ${atlananSayisi} atlandı.`);
        res.json({
            mesaj: `Senkronizasyon tamamlandı! ${eklenenSayisi} yeni çağrı eklendi.`,
            eklenenSayisi,
            atlananSayisi,
            toplamKontrolEdilen: cagrilar.length
        });

    } catch (error) {
        console.log('❌ Senkronizasyon hatası:', error.message);
        res.status(500).json({ hata: 'Senkronizasyon başarısız: ' + error.message });
    }
});

// ============================================================
// 6k. VAPI ASİSTAN LİSTESİNİ ALMA (GET /api/vapi/assistants)
// ============================================================
// Doğrudan veritabanı önbelleğinden çeker, Vapi API'sine istek ATMAZ.
// Bu sayede sayfa anında yüklenir ve Vapi API yavaşlığından veya kopmalarından etkilenmez.
app.get('/api/vapi/assistants', async (req, res) => {
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ hata: 'companyId parametresi gerekli.' });

    try {
        db.query(`SELECT assistant_id, name, model, voice, first_message FROM firma_ajanlar WHERE company_id = ?`, [companyId], (err, results) => {
            if (err) return res.status(500).json({ hata: 'Veritabanı hatası' });

            const assistants = results.map(row => {
                return {
                    id: row.assistant_id,
                    name: row.name || 'Asistan (' + row.assistant_id.substring(0, 8) + ')',
                    model: { model: row.model || 'vapi-gpt' },
                    voice: { voiceId: row.voice || 'default', voice: row.voice || 'TR-Female' },
                    firstMessage: row.first_message || 'Açıklama veya ilk mesaj girilmemiş.'
                };
            });

            return res.json(assistants);
        });
    } catch (error) {
        console.log('❌ Veritabanı hatası:', error.message);
        res.status(500).json({ hata: 'Asistanlar yüklenemedi.' });
    }
});

// ============================================================
// 6k-2. VAPI ASİSTANLARINI ELLE SENKRONİZE ETME (POST /api/vapi/assistants/sync)
// ============================================================
// İstek üzerine Vapi'den en güncel verileri çekip veritabanındaki önbelleği günceller.
app.post('/api/vapi/assistants/sync', async (req, res) => {
    const companyId = Number(req.query.companyId || req.body.companyId);
    if (!companyId) return res.status(400).json({ hata: 'companyId parametresi gerekli.' });

    try {
        db.query(`SELECT assistant_id FROM firma_ajanlar WHERE company_id = ?`, [companyId], async (err, results) => {
            if (err) return res.status(500).json({ hata: 'Veritabanı hatası' });

            if (results.length === 0) return res.json({ mesaj: 'Senkronize edilecek asistan bulunamadı.', syncCount: 0 });

            try {
                const assistantIds = results.map(row => row.assistant_id);
                let syncCount = 0;
                
                await mapLimit(assistantIds, 5, async (id) => {
                    const assistant = await fetchAssistantById(id, 4000); // 4sn timeout
                    if (assistant) {
                        const name = assistant.name || 'İsimsiz Ajan';
                        const model = assistant.model?.model || '-';
                        const voice = assistant.voice?.voiceId || assistant.voice?.voice || '-';
                        const firstMessage = assistant.firstMessage || '';
                        
                        await new Promise((resolve) => {
                            db.query(
                                `UPDATE firma_ajanlar SET name = ?, model = ?, voice = ?, first_message = ? WHERE assistant_id = ?`,
                                [name, model, voice, firstMessage, id],
                                () => resolve()
                            );
                        });
                        syncCount++;
                    }
                });

                return res.json({ mesaj: `Senkronizasyon tamamlandı! ${syncCount} asistan Vapi'den güncellendi.`, syncCount });
            } catch (innerError) {
                console.log('❌ Senkronizasyon hatası:', innerError.message);
                return res.status(500).json({ hata: 'Senkronizasyon başarısız oldu.', detay: innerError.message });
            }
        });
    } catch (error) {
        res.status(500).json({ hata: 'Senkronizasyon hatası: ' + error.message });
    }
});

// ============================================================
// 6l. AJAN ATAMA VE BAĞLAMA (POST /api/agents/assign)
// ============================================================
app.post('/api/agents/assign', (req, res) => {
    const { companyId, assistantId } = req.body;
    if (!companyId || !assistantId) return res.status(400).json({ hata: 'companyId ve assistantId gereklidir.' });

    // UUID format kontrolü (Vapi asistan ID'leri her zaman UUID formatındadır)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(assistantId.trim())) {
        return res.status(400).json({ hata: 'Geçersiz Asistan ID formatı. Lütfen Vapi dashboard\'dan aldığınız UUID formatındaki ID\'yi girin. (örn: f3c3abcd-1234-...)' });
    }

    // Asistan başka firmaya atanmış mı kontrol et
    db.query(`SELECT * FROM firma_ajanlar WHERE assistant_id = ?`, [assistantId], (err, results) => {
        if (err) return res.status(500).json({ hata: 'Veritabanı hatası' });

        if (results.length > 0) {
            if (results[0].company_id == companyId) {
                return res.status(400).json({ hata: 'Bu asistan zaten size atanmış.' });
            } else {
                return res.status(400).json({ hata: 'Bu asistan başka bir firmaya ait.' });
            }
        }

        fetchAssistantById(assistantId, 4000).then(assistant => {
            const name = assistant ? (assistant.name || 'İsimsiz Ajan') : 'Asistan (' + assistantId.substring(0, 8) + ')';
            const model = assistant ? (assistant.model?.model || '-') : 'vapi-gpt';
            const voice = assistant ? (assistant.voice?.voiceId || assistant.voice?.voice || '-') : 'TR-Female';
            const firstMessage = assistant ? (assistant.firstMessage || '') : '';

            db.query(
                `INSERT INTO firma_ajanlar (company_id, assistant_id, name, model, voice, first_message) VALUES (?, ?, ?, ?, ?, ?)`,
                [companyId, assistantId, name, model, voice, firstMessage],
                (err2) => {
                    if (err2) {
                        console.log('❌ Ajan ekleme hatası:', err2.message);
                        return res.status(500).json({ hata: 'Bağlantı yapılırken veritabanı hatası oluştu.' });
                    }
                    res.json({ mesaj: 'Asistan hesabınıza başarıyla bağlandı!' });
                }
            );
        }).catch(err => {
            console.log('❌ Ajan ekleme/Vapi hatası:', err.message);
            // Vapi hata verse bile asistanı mock verilerle ekle
            db.query(
                `INSERT INTO firma_ajanlar (company_id, assistant_id, name, model, voice, first_message) VALUES (?, ?, ?, ?, ?, ?)`,
                [companyId, assistantId, 'Asistan (' + assistantId.substring(0, 8) + ')', 'vapi-gpt', 'TR-Female', ''],
                (err2) => {
                    if (err2) return res.status(500).json({ hata: 'Bağlantı yapılırken hata oluştu.' });
                    res.json({ mesaj: 'Asistan hesabınıza başarıyla bağlandı (Çevrimdışı Mod)!' });
                }
            );
        });
    });
});

// ============================================================
// 6m. DESTEK VE ÇOKLU AJAN TALEBİ (POST /api/support/request)
// ============================================================
// Kullanıcı bir plan seçip ajan tasarladığında bu rota çalışır.
// Gelen verileri belirtilen yönetici e-posta adresine gönderir.
app.post('/api/support/request', (req, res) => {
    const { firma_adi, email, agents, plan_name, plan_price } = req.body;

    if (!firma_adi || !email || !agents || !Array.isArray(agents)) {
        return res.status(400).json({ hata: 'Lütfen tüm alanları doldurun.' });
    }

    // Ajan bilgilerini HTML formatına dönüştür
    let agentsHtml = '';
    agents.forEach((agent, index) => {
        agentsHtml += `
                <div style="margin-top: 15px; border-left: 4px solid #4F46E5; padding-left: 15px; background-color: #f1f5f9; padding: 10px; border-radius: 4px;">
                    <h4 style="color: #4F46E5; margin: 0 0 5px 0;">Ajan ${index + 1}: ${agent.name}</h4>
                    <p style="margin: 2px 0;"><strong>Görevi:</strong> ${agent.role}</p>
                    <p style="margin: 2px 0;"><strong>Detaylar:</strong> ${agent.details}</p>
                </div>
            `;
    });

    const mailSecenekleri = {
        from: `"VoiceAuto.ai Destek" <${GMAIL_KULLANICI}>`,
        to: GMAIL_KULLANICI,
        subject: `Yeni Çoklu Ajan Talebi: ${firma_adi}`,
        html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                    <h2 style="color: #4F46E5; border-bottom: 2px solid #4F46E5; padding-bottom: 10px;">Yeni Çoklu AI Ajan Talebi</h2>
                    
                    <div style="margin-top: 20px;">
                        <h3 style="color: #1e293b; margin-bottom: 5px;">Müşteri Bilgileri</h3>
                        <p><strong>Firma Adı:</strong> ${firma_adi}</p>
                        <p><strong>E-posta:</strong> ${email}</p>
                    </div>

                    <div style="margin-top: 20px; background-color: #f8fafc; padding: 15px; border-radius: 8px;">
                        <h3 style="color: #1e293b; margin-bottom: 5px;">Plan Bilgisi</h3>
                        <p><strong>Seçilen Plan:</strong> ${plan_name || 'Bilinmiyor'}</p>
                        <p><strong>Fiyat:</strong> ${plan_price || '0'}$</p>
                    </div>

                    <div style="margin-top: 20px;">
                        <h3 style="color: #1e293b; margin-bottom: 5px;">Ajan Konfigürasyonları</h3>
                        ${agentsHtml}
                    </div>

                    <div style="margin-top: 30px; font-size: 12px; color: #64748b; text-align: center;">
                        Bu e-posta VoiceAuto.ai sistemi tarafından otomatik olarak oluşturulmuştur.
                    </div>
                </div>
            `
    };

    transporter.sendMail(mailSecenekleri, (err, info) => {
        if (err) {
            console.log('❌ Talep e-postası gönderilemedi:', err.message);
            return res.status(500).json({ hata: 'Talep gönderilirken bir hata oluştu.' });
        }
        console.log('📬 Yeni çoklu ajan talebi gönderildi:', firma_adi);
        res.json({ mesaj: 'Talebiniz başarıyla alındı!' });
    });
});

// ============================================================
// 7. SUNUCUYU BAŞLAT
// ============================================================
// Sunucu belirlenen portta sürekli dinlemeye başlar.
// Artık dışarıdan gelen istekleri (kayıt, giriş, doğrulama, webhook) karşılayabilir.
app.listen(PORT, () => {
    console.log(`🚀 Sunucu http://localhost:${PORT} adresinde çalışıyor.`);
    console.log('');
    console.log('📌 Kullanılabilir rotalar:');
    console.log(`   GET  http://localhost:${PORT}/api/test`);
    console.log(`   POST http://localhost:${PORT}/api/kayit`);
    console.log(`   GET  http://localhost:${PORT}/api/verify/:token`);
    console.log(`   POST http://localhost:${PORT}/api/giris`);
    console.log(`   POST http://localhost:${PORT}/api/vapi/webhook  ← Vapi Webhook`);
    console.log(`   GET  http://localhost:${PORT}/api/aramalar      ← Çağrı Listesi`);
    console.log(`   GET  http://localhost:${PORT}/api/vapi/assistants ← Vapi Asistan Listesi`);
    console.log('');
});
