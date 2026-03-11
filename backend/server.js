// ============================================================
// VoiceAutoAi - Backend Sunucu Dosyası (server.js)
// ============================================================
// Bu dosya, projenin arka plan (backend) kısmıdır.
// Express.js ile bir web sunucusu kurar, MySQL veritabanına bağlanır
// ve e-posta doğrulama sistemiyle birlikte kayıt/giriş işlemlerini yönetir.
// ============================================================

// --- KULLANILAN KÜTÜPHANELER (IMPORTLAR) ---
const express = require('express');       // Web sunucusu oluşturmak için
const mysql = require('mysql2');          // MySQL veritabanına bağlanmak için
const cors = require('cors');            // Frontend'in backend'e istek atabilmesi için
const path = require('path');            // Dosya yollarını yönetmek için (Node.js dahili modülü)
const crypto = require('crypto');         // Rastgele doğrulama tokeni üretmek için (Node.js dahili modülü)
const nodemailer = require('nodemailer'); // Gmail SMTP ile e-posta göndermek için
const bcrypt = require('bcryptjs');       // Şifreleri güvenli şekilde hashlemek için

// ============================================================
// 1. EXPRESS UYGULAMASINI OLUŞTUR
// ============================================================
const app = express();
const PORT = 3001;

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
// Bu bilgiler kendi bilgisayarıma göre ayarladığım yerel veritabanı bilgileri.
const db = mysql.createConnection({
    host: 'localhost',       // Veritabanı adresi (kendi bilgisayarım)
    user: 'root',            // MySQL kullanıcı adı
    password: '1234',        // MySQL şifresi
    database: 'voiceai',     // Kullandığımız veritabanı adı
    port: 3306               // MySQL'in varsayılan port numarası
});

// Veritabanına bağlanmayı dene ve sonucu konsola yaz
db.connect((err) => {
    if (err) {
        console.log('❌ Veritabanı Bağlantı Hatası:', err.message);
    } else {
        console.log('✅ MySQL Veritabanına Bağlantı Başarılı!');
    }
});

// ============================================================
// 5. E-POSTA AYARLARI (NODEMAILER + GMAIL SMTP)
// ============================================================
// Gmail SMTP ile herhangi bir e-posta adresine doğrulama linki göndermek için ayarlar.
// Gmail hesabınızın 2 Adımlı Doğrulama'sı açık olmalı ve bir Uygulama Şifresi oluşturulmalı.

// Gmail SMTP ayarları
const GMAIL_KULLANICI = 'nesetatalatist@gmail.com';     // Gmail adresiniz
const GMAIL_UYGULAMA_SIFRESI = 'rohs dhng bsbd txfl';  // Google Uygulama Şifresi

// Nodemailer transporter (e-posta gönderici) oluştur
const transporter = nodemailer.createTransport({
    service: 'gmail',           // Gmail SMTP servisini kullan
    auth: {
        user: GMAIL_KULLANICI,           // Gmail adresiniz
        pass: GMAIL_UYGULAMA_SIFRESI     // Uygulama şifreniz (normal Gmail şifresi DEĞİL)
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
// 6. API ROTALARI (ENDPOINTS)
// ============================================================

// --- Test Rotası ---
// Sunucunun çalışıp çalışmadığını kontrol etmek için basit bir test
app.get('/api/test', (req, res) => {
    res.json({ mesaj: 'Sunucu ve veritabanı harika çalışıyor!' });
});

// ============================================================
// 6a. KAYIT ROTASI (POST /api/kayit)
// ============================================================
// Kullanıcı bu adrese firma adı, e-posta ve şifre gönderir.
// Biz de:
//   1. Şifreyi hashleriz (güvenlik için)
//   2. Rastgele bir doğrulama tokeni üretiriz
//   3. Veritabanına kaydederiz
//   4. Doğrulama linki içeren bir e-posta göndeririz
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
        // Adım 1: Şifreyi hashle (düz metin olarak saklamak güvenli değil)
        // bcrypt.hash fonksiyonu şifreyi karıştırarak okunamaz hale getirir.
        // İkinci parametre (10) hash'in güçlüğünü belirler.
        const hashlenmis_sifre = await bcrypt.hash(sifre, 10);

        // Adım 2: Rastgele bir doğrulama tokeni üret
        // crypto.randomBytes(20) → 20 byte'lık rastgele veri üretir
        // .toString('hex') → Bunu okunabilir bir metin (hex) formatına çevirir
        const dogrulama_tokeni = crypto.randomBytes(20).toString('hex');

        // Adım 3: Veritabanına kaydet
        const sql = `INSERT INTO company (firma_adi, admin_eposta, admin_sifre, isVerified, verificationToken) 
                     VALUES (?, ?, ?, false, ?)`;

        db.query(sql, [firma_adi, email, hashlenmis_sifre, dogrulama_tokeni], (err, result) => {
            if (err) {
                // Eğer aynı e-posta zaten kayıtlıysa MySQL hata verir
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({ hata: 'Bu e-posta adresi zaten kayıtlı!' });
                }
                console.log('❌ Kayıt hatası:', err.message);
                return res.status(500).json({ hata: 'Kayıt sırasında bir hata oluştu.' });
            }

            // Adım 4: Doğrulama e-postası gönder
            const dogrulama_linki = `http://localhost:${PORT}/api/verify/${dogrulama_tokeni}`;

            // Konsola da yazdıralım (test için faydalı)
            console.log('');
            console.log('📧 ====================================');
            console.log('   DOĞRULAMA LİNKİ (test için):');
            console.log(`   ${dogrulama_linki}`);
            console.log('📧 ====================================');
            console.log('');

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
                mesaj: 'Kayıt başarılı! Lütfen e-postanızı kontrol edin ve hesabınızı onaylayın.'
            });
        });

    } catch (error) {
        console.log('❌ Beklenmeyen hata:', error.message);
        res.status(500).json({ hata: 'Sunucu hatası oluştu.' });
    }
});

// ============================================================
// 6b. DOĞRULAMA ROTASI (GET /api/verify/:token)
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
// 6c. GİRİŞ ROTASI (POST /api/giris)
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

        // Şifre kontrolü: Girilen şifreyi veritabanındaki hash ile karşılaştır
        const sifreDogruMu = await bcrypt.compare(sifre, kullanici.admin_sifre);

        if (!sifreDogruMu) {
            return res.status(401).json({ hata: 'E-posta veya şifre hatalı.' });
        }

        // E-posta onay kontrolü
        // Eğer kullanıcı e-postasını henüz onaylamamışsa giriş yapmasına izin verme
        if (!kullanici.isVerified) {
            return res.status(401).json({
                hata: 'Lütfen önce e-postanıza gelen linke tıklayarak hesabınızı onaylayın.'
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
// 6d. DOĞRULAMA KONTROL ROTASI (GET /api/check-verification/:email)
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
// 7. SUNUCUYU BAŞLAT
// ============================================================
// Sunucu belirlenen portta sürekli dinlemeye başlar.
// Artık dışarıdan gelen istekleri (kayıt, giriş, doğrulama) karşılayabilir.
app.listen(PORT, () => {
    console.log(`🚀 Sunucu http://localhost:${PORT} adresinde çalışıyor.`);
    console.log('');
    console.log('📌 Kullanılabilir rotalar:');
    console.log(`   GET  http://localhost:${PORT}/api/test`);
    console.log(`   POST http://localhost:${PORT}/api/kayit`);
    console.log(`   GET  http://localhost:${PORT}/api/verify/:token`);
    console.log(`   POST http://localhost:${PORT}/api/giris`);
    console.log('');
});
