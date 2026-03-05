const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

// 1. Express (Sunucu) uygulamasını oluştur
const app = express();
const PORT = 3001;

// 2. Ayarlar (Middleware)
app.use(cors()); // React (Frontend) kısmının buraya bağlanabilmesini sağlar
app.use(express.json()); // Gelen isteklerdeki JSON (metin) verilerini okumamızı sağlar

// 3. Veritabanı bağlantısı
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '1234',
    database: 'vapi_db',
    port: 3306
});

// Veritabanına bağlanmayı dene
db.connect((err) => {
    if (err) {
        console.log(' Bağlantı Hatası:', err.message);
    } else {
        console.log(' Bağlantı Başarılı');
    }
});

// 4. Test Yolu (Endpoint)
app.get('/api/test', (req, res) => {
    // Biri bu adrese girdiğinde ona bu JSON yanıtını gönderiyoruz
    res.json({ mesaj: 'Sunucu ve veritabanı harika çalışıyor!' });
});

// 5. Sunucuyu Başlat (Sürekli dinlemeye başlar)
app.listen(PORT, () => {
    console.log(`🚀 Sunucu http://localhost:${PORT} adresinde çalışıyor.`);
});
