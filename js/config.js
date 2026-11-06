/* ตั้งค่าหลักของเว็บ
 *
 * API_URL  : ใส่ลิงก์ Web app ของ Google Apps Script หลังติดตั้งเสร็จ
 *            (ดูขั้นตอนใน README.md) เช่น 'https://script.google.com/macros/s/AKfy.../exec'
 *            ถ้าเว้นว่างไว้ เว็บจะทำงานใน "โหมดสาธิต" คือเก็บข้อมูลในเบราว์เซอร์เครื่องนี้เท่านั้น
 *
 * DEMO_PASSWORD : รหัสเข้าระบบแอดมินในโหมดสาธิตเท่านั้น
 *                 (เมื่อใช้งานจริง รหัสผ่านจะตั้งใน Code.gs ฝั่ง Google)
 */
window.SITE_CONFIG = {
  API_URL: '',
  DEMO_PASSWORD: 'admin1234'
};
