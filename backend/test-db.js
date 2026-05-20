// ============================================================
// VoiceAutoAi - Veritabanı Bağlantı Testi
// Kullanım: node test-db.js
// ============================================================

const mysql = require('mysql2/promise');
require('dotenv').config();

async function testConnection() {
  console.log('================================================');
  console.log('  VoiceAutoAi - Veritabanı Bağlantı Testi');
  console.log('================================================');
  console.log('');
  console.log('🔄 Bağlantı bilgileri:');
  console.log(`   Host     : ${process.env.DB_HOST || 'localhost'}`);
  console.log(`   Port     : ${process.env.DB_PORT || 3306}`);
  console.log(`   Kullanıcı: ${process.env.DB_USER || 'root'}`);
  console.log(`   Veritabanı: ${process.env.DB_NAME || 'voiceai'}`);
  console.log('');

  try {
    // Bağlantıyı kur
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'voiceai',
      connectTimeout: 5000
    });

    console.log('✅ Bağlantı BAŞARILI!');
    console.log('');

    // MySQL versiyonu
    const [versionRows] = await connection.query('SELECT VERSION() as version, DATABASE() as db_name, NOW() as server_time;');
    console.log('ℹ️  MySQL Versiyonu  :', versionRows[0].version);
    console.log('ℹ️  Aktif Veritabanı:', versionRows[0].db_name);
    console.log('ℹ️  Sunucu Saati    :', versionRows[0].server_time);
    console.log('');

    // Tabloları listele
    const [tables] = await connection.query('SHOW TABLES;');
    if (tables.length === 0) {
      console.log('⚠️  Veritabanında henüz tablo yok!');
      console.log('   → voiceai.sql dosyasını çalıştırarak tabloları oluşturun.');
    } else {
      console.log(`📋 Veritabanındaki tablolar (${tables.length} adet):`);
      for (const row of tables) {
        const tableName = Object.values(row)[0];
        const [countRows] = await connection.query(`SELECT COUNT(*) as cnt FROM \`${tableName}\``);
        console.log(`   - ${tableName.padEnd(30)} (${countRows[0].cnt} kayıt)`);
      }
    }

    console.log('');
    await connection.end();
    console.log('✅ Bağlantı düzgünce kapatıldı.');
    console.log('');
    console.log('🎉 Test BAŞARILI - Veritabanı hazır!');

  } catch (err) {
    console.error('❌ Bağlantı HATASI!');
    console.error('');

    if (err.code === 'ECONNREFUSED') {
      console.error('🔴 MySQL sunucusu çalışmıyor veya bağlantı reddedildi.');
      console.error('   → MySQL servisinin çalıştığından emin olun.');
      console.error('   → XAMPP/WAMP/MySQL Workbench üzerinden MySQL\'i başlatın.');
    } else if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('🔴 Kullanıcı adı veya şifre hatalı.');
      console.error('   → .env dosyasındaki DB_USER ve DB_PASSWORD bilgilerini kontrol edin.');
    } else if (err.code === 'ER_BAD_DB_ERROR') {
      console.error('🔴 Veritabanı bulunamadı: "voiceai"');
      console.error('   → voiceai.sql dosyasını çalıştırarak veritabanını oluşturun:');
      console.error('   → mysql -u root -p voiceai < voiceai.sql');
    } else {
      console.error('Hata kodu   :', err.code);
      console.error('Hata mesajı :', err.message);
    }

    process.exit(1);
  }
}

testConnection();
