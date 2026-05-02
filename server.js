const express    = require('express');
const nodemailer = require('nodemailer');
const cors       = require('cors');
const multer     = require('multer');
const path       = require('path');
const fs         = require('fs');

const app  = express();
const PORT = process.env.PORT || 10000;

// ── 1. Middleware ──────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname)));

// ── 2. Root Route ──────────────────────────────────────────────
app.get('/', (req, res) => {
  // Change this filename to match your actual HTML file
  const htmlFile = path.join(__dirname, 'index_enhanced.html');
  if (fs.existsSync(htmlFile)) {
    res.sendFile(htmlFile);
  } else {
    // Fallback: list available HTML files
    const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.html'));
    res.send(`
      <h2>Server is running ✅</h2>
      <p>Available HTML files:</p>
      <ul>${files.map(f => `<li><a href="/${f}">${f}</a></li>`).join('')}</ul>
    `);
  }
});

// ── 3. Configuration ───────────────────────────────────────────
const SCHOOL_EMAIL = process.env.SCHOOL_EMAIL || 'jaf89575@gmail.com';
const SMTP_CONFIG  = {
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER || 'jaf89575@gmail.com',
    pass: process.env.SMTP_PASS || 'tmno oukh poys xdyg'
  }
};

// ── 4. In-Memory Student Store (works on Render free tier) ─────
//    NOTE: Data resets when Render restarts the server.
//    All registrations are also emailed, so no data is lost.
const students = [];
let nextId = 1;

// ── 5. Email & Upload Setup ────────────────────────────────────
const transporter = nodemailer.createTransport(SMTP_CONFIG);

// Verify email on startup
transporter.verify((err) => {
  if (err) {
    console.error('❌ Email config error:', err.message);
  } else {
    console.log('✅ Email server ready — sending to:', SCHOOL_EMAIL);
  }
});

// Use memory storage for uploads (no disk dependency on Render)
const upload = multer({ storage: multer.memoryStorage() });

// ── 6. Health / Status Check ───────────────────────────────────
// Both /api/health and /api/status are supported (different HTML files use different names)
const healthResponse = (res) => res.json({ 
  status: 'ok', 
  message: 'Server is running',
  timestamp: new Date().toISOString(),
  studentsRegistered: students.length
});
app.get('/api/health', (req, res) => healthResponse(res));
app.get('/api/status', (req, res) => healthResponse(res));

// Registration open/closed status (used by both HTML files)
app.get('/api/registration-status', (req, res) => {
  res.json({ isOpen: true, message: 'Usajili umefunguliwa' });
});

// ── 7. Registration Endpoint ───────────────────────────────────
app.post('/api/register', upload.single('pdf'), async (req, res) => {
  try {
    const d = JSON.parse(req.body.studentData);

    // Support both old field names (jina1/jina2/jina3) and new ones (firstName/middleName/lastName)
    const fullName = (
      [d.firstName, d.middleName, d.lastName].filter(Boolean).join(' ') ||
      [d.jina1, d.jina2, d.jina3].filter(Boolean).join(' ') ||
      'Haijajulikana'
    );

    const submissionDate = new Date().toLocaleString('en-GB', { timeZone: 'Africa/Dar_es_Salaam' });

    // Save to in-memory store
    const studentRecord = {
      id: nextId++,
      fullName,
      psleIndex: d.psleIndex || d.admissionNo || '—',
      registeredAt: new Date().toISOString(),
      data: d
    };
    students.push(studentRecord);

    // ── Build HTML Email ───────────────────────────────────────
    const row = (label, val) => `
      <tr>
        <td style="padding:8px 14px;font-weight:600;color:#555;background:#f7f9fc;width:35%;border-bottom:1px solid #eef2f7;">${label}</td>
        <td style="padding:8px 14px;color:#1a1a2e;border-bottom:1px solid #eef2f7;">${val || '—'}</td>
      </tr>`;

    const section = (icon, title, rows) => `
      <div style="margin-bottom:20px;">
        <div style="background:#1a365d;color:white;padding:8px 14px;font-size:13px;font-weight:700;border-radius:6px 6px 0 0;">
          ${icon} ${title}
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid #dde3ed;border-top:none;">
          ${rows}
        </table>
      </div>`;

    const emailHTML = `<!DOCTYPE html>
<html lang="sw">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif;">
<div style="max-width:650px;margin:24px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.1);">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#0d1f3c,#1a365d);padding:28px 32px;">
    <div style="color:white;font-size:17px;font-weight:800;letter-spacing:0.5px;">🏫 SHULE YA SEKONDARI TABORA WAVULANA</div>
    <div style="color:#f0c84a;font-size:11px;margin-top:6px;font-weight:600;text-transform:uppercase;">Usajili Mpya — Kidato cha Kwanza 2026</div>
  </div>
  <div style="height:4px;background:linear-gradient(90deg,#c8962a,#f0c84a,#c8962a);"></div>

  <!-- Alert -->
  <div style="padding:16px 28px;background:#e8f5e9;border-left:4px solid #2d6a4f;">
    <div style="font-weight:700;color:#1b5e20;font-size:14px;">✅ Mwanafunzi Mpya Amejisajili</div>
    <div style="color:#2e7d32;font-size:12px;margin-top:2px;">Fomu imewasilishwa: ${submissionDate} (EAT)</div>
  </div>

  <!-- Body -->
  <div style="padding:24px 28px;">
    ${section('👤', 'TAARIFA ZA KIBINAFSI',
      row('Jina Kamili', `<strong style="color:#1a365d;">${fullName}</strong>`) +
      row('Tarehe ya Kuzaliwa', d.dateOfBirth ? new Date(d.dateOfBirth).toLocaleDateString('en-GB') : '—') +
      row('Wilaya ya Kuzaliwa', d.birthDistrict) +
      row('Uraia', d.nationality) +
      row('Dini', d.religion) +
      row('Shule ya Msingi', d.previousSchool) +
      row('PSLE Index No.', `<strong style="color:#2b5fa5;">${d.psleIndex || '—'}</strong>`) +
      row('Anwani ya Sasa', d.currentAddress) +
      row('Wilaya / Kata', [d.currentWard, d.currentDistrict].filter(Boolean).join(', '))
    )}

    ${section('👨‍👩‍👦', 'TAARIFA ZA FAMILIA',
      row('Jina la Baba', d.fatherName) +
      row('Simu ya Baba', d.fatherPhone) +
      row('Jina la Mama', d.motherName) +
      row('Simu ya Mama', d.motherPhone) +
      row('Ndugu wa Karibu', [d.nextOfKinName, d.nextOfKinPhone].filter(Boolean).join(' — ')) +
      row('Mkoa / Wilaya (Nyumbani)', [d.homeRegion, d.homeDistrict].filter(Boolean).join(', '))
    )}

    ${section('🤝', 'TAARIFA ZA MZAZI / MLEZI MKUU',
      row('Jina la Mzazi/Mlezi', `<strong>${d.parentName || '—'}</strong>`) +
      row('Uhusiano', d.relationship) +
      row('Namba ya Simu', `<strong style="color:#2b5fa5;">${d.parentPhone || '—'}</strong>`) +
      row('Barua Pepe', d.parentEmail || 'Haitolewa') +
      row('Kazi / Uchumi', d.parentOccupation || 'Haijabainishwa') +
      row('Anwani Kamili', d.parentAddress)
    )}

    ${section('🏥', 'UCHUNGUZI WA AFYA',
      row('Kundi la Damu', `<strong style="color:#c0392b;">${d.bloodGroup || '—'}</strong>`) +
      row('Hali ya Ujumla ya Afya', d.generalHealth || '—') +
      row('Daktari', d.doctorName || 'Haijajazwa') +
      row('Hospitali / Zahanati', d.hospitalName || 'Haijajazwa') +
      row('Bima ya Afya', d.insuranceStatus || '—') +
      row('Maelezo ya Ziada', d.additionalMedical || 'Hakuna')
    )}

    <div style="margin-top:20px;padding:14px 18px;background:#fffbf0;border:1px solid #ffe082;border-radius:8px;font-size:12px;color:#7a5400;">
      📎 PDF iliyo kamili ya fomu ya usajili imeambatishwa kwenye barua pepe hii (kama ilitolewa).
    </div>
  </div>

  <!-- Footer -->
  <div style="background:#f7f9fc;padding:16px 28px;border-top:1px solid #eef2f7;text-align:center;font-size:11px;color:#888;line-height:1.8;">
    <strong style="color:#1a365d;">Shule ya Sekondari Tabora Wavulana</strong><br>
    S.L.P 374, Tabora &nbsp;·&nbsp; Simu: 0755 297 005<br>
    <span style="color:#c8962a;">jaf89575@gmail.com</span><br>
    Barua pepe hii imetumwa kiotomatiki na mfumo wa usajili.
  </div>
</div>
</body>
</html>`;

    // ── Attach PDF if provided ─────────────────────────────────
    const attachments = [];
    if (req.file && req.file.buffer) {
      attachments.push({
        filename: `TaboraBoys_${fullName.replace(/\s+/g, '_')}_2026.pdf`,
        content: req.file.buffer,
        contentType: 'application/pdf'
      });
    }

    // ── Send Email ─────────────────────────────────────────────
    const info = await transporter.sendMail({
      from: `"Tabora Boys Registration" <${SMTP_CONFIG.auth.user}>`,
      to: SCHOOL_EMAIL,
      subject: `🎓 Usajili Mpya: ${fullName} | PSLE: ${d.psleIndex || '—'} | ${submissionDate}`,
      html: emailHTML,
      attachments
    });

    console.log(`✅ Registered: ${fullName} [ID: ${studentRecord.id}] — email: ${info.messageId}`);
    res.json({ 
      success: true, 
      message: 'Usajili umefanikiwa na barua pepe imetumwa',
      emailSent: true,
      studentId: studentRecord.id,
      messageId: info.messageId
    });

  } catch (err) {
    console.error('❌ Registration error:', err);
    res.status(500).json({ success: false, error: err.message, emailSent: false });
  }
});

// ── 8. Get All Students (Admin) ────────────────────────────────
app.get('/api/students', (req, res) => {
  res.json({ 
    success: true, 
    count: students.length, 
    students: students.map(s => ({
      id: s.id,
      fullName: s.fullName,
      psleIndex: s.psleIndex,
      registeredAt: s.registeredAt
    }))
  });
});

// ── 9. Test Email Endpoint ─────────────────────────────────────
app.post('/api/test-email', async (req, res) => {
  try {
    const info = await transporter.sendMail({
      from: `"Tabora Boys System" <${SMTP_CONFIG.auth.user}>`,
      to: SCHOOL_EMAIL,
      subject: 'Test — Mfumo wa Usajili wa Tabora Boys',
      html: '<p>✅ Barua pepe ya majaribio. Mfumo unafanya kazi vizuri!</p>'
    });
    res.json({ success: true, messageId: info.messageId });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── 10. Start Server ───────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  Tabora Boys Secondary School — Registration Server          ║
║  Port: ${PORT}                                                  ║
║  School Email: ${SCHOOL_EMAIL}                    ║
╚══════════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
