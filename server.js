const express = require('express');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');
// --- IMPORT THƯ VIỆN FIREBASE ---
const { initializeApp } = require("firebase/app");
const { getFirestore, doc, setDoc, getDoc, collection, getDocs, deleteDoc } = require("firebase/firestore");

const app = express();
const PORT = 7000;
const upload = multer({ dest: 'uploads/' });

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// ==========================================
// 1. CẤU HÌNH & HÀM BỔ TRỢ
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyCcnxWN4b_EyIBFQQBS8yXKRmI5hI8fb_o",
    authDomain: "sub-cloud-ai.firebaseapp.com",
    projectId: "sub-cloud-ai",
    storageBucket: "sub-cloud-ai.firebasestorage.app",
    messagingSenderId: "218842479130",
    appId: "1:218842479130:web:c180a63fef3a6c09a56fa3"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const activeTasks = {}; 

const getLoggedInUser = (req) => req.cookies.username || null;
const hashPwd = (pwd) => crypto.createHash('sha256').update(pwd).digest('hex');

const removeVietnameseTones = (str) => {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^a-zA-Z0-9\s()]/g, '').trim().replace(/\s+/g, '_');
};

const axiosConfig = { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } };

// ==========================================
// 2. GIAO DIỆN HTML TỔNG (Có Modal Xem Trước Sub)
// ==========================================
const renderHTML = (content, username = null, role = 'guest') => `
    <html>
    <head>
        <title>Nền Tảng Dịch Phụ Đề AI (Pro)</title>
        <meta charset="utf-8">
        <style>
            :root { --bg: #f4f6f9; --text: #333; --box-bg: white; --border: #dee2e6; --input-bg: white; }
            body.dark { --bg: #121212; --text: #e0e0e0; --box-bg: #1e1e1e; --border: #333; --input-bg: #2d2d2d; }
            body { font-family: 'Segoe UI', Tahoma, Geneva, sans-serif; padding: 20px; background: var(--bg); color: var(--text); transition: 0.3s; }
            .container { max-width: 900px; margin: auto; background: var(--box-bg); padding: 30px; border-radius: 12px; box-shadow: 0 5px 15px rgba(0,0,0,0.08); }
            input[type="text"], input[type="password"], input[type="number"], select, button { width: 100%; padding: 12px; margin-top: 8px; margin-bottom: 15px; border: 1px solid var(--border); border-radius: 6px; background: var(--input-bg); color: var(--text); }
            .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
            @media (max-width: 768px) { .grid-2 { grid-template-columns: 1fr; } }
            button.main-btn { background: #007bff; color: white; border: none; font-weight: bold; cursor: pointer; transition: 0.2s; }
            button.main-btn:hover { background: #0056b3; }
            .btn-dl { background: #28a745; color: white; border: none; padding: 6px 12px; border-radius: 5px; text-decoration: none; font-size: 13px; font-weight: bold; margin-right:5px; cursor: pointer;}
            .btn-preview { background: #17a2b8; color: white; border: none; padding: 6px 12px; border-radius: 5px; text-decoration: none; font-size: 13px; font-weight: bold; margin-right:5px; cursor: pointer;}
            .btn-del { background: #dc3545; color: white; border: none; padding: 6px 12px; border-radius: 5px; text-decoration: none; font-size: 13px; font-weight: bold; cursor: pointer;}
            .user-bar { display: flex; justify-content: space-between; align-items: center; background: #2c3e50; color: white; padding: 12px 20px; border-radius: 8px; margin-bottom: 20px; }
            .user-bar a { color: #f1c40f; text-decoration: none; font-weight: bold; margin-left: 15px; }
            .tab-nav { display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 2px solid var(--border); padding-bottom: 10px; overflow-x: auto;}
            .tab-btn { width: auto; background: transparent; border: none; color: var(--text); font-weight: bold; cursor: pointer; padding: 10px 15px; border-radius: 8px; margin: 0; white-space: nowrap;}
            .tab-btn.active { background: #007bff; color: white; }
            .tab-pane { display: none; animation: fadeIn 0.3s; }
            .tab-pane.active { display: block; }
            @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
            .card { background: var(--bg); padding: 20px; border-radius: 8px; border: 1px solid var(--border); margin-bottom: 20px; }
            .db-item { display: flex; justify-content: space-between; align-items: center; padding: 15px; border-bottom: 1px solid var(--border); }
            .leaderboard-item { display: flex; justify-content: space-between; padding: 10px; background: var(--input-bg); margin-bottom: 5px; border-radius: 5px; border: 1px solid var(--border);}
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid var(--border); padding: 10px; text-align: left; }
            th { background: rgba(0,0,0,0.05); }

            /* CSS cho Modal Xem Trước Sub */
            .modal { display: none; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); backdrop-filter: blur(3px); }
            .modal-content { background: var(--box-bg); margin: 5% auto; padding: 20px; border: 1px solid var(--border); width: 80%; max-width: 700px; border-radius: 10px; max-height: 80vh; display: flex; flex-direction: column; }
            .modal-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 10px; }
            .close-btn { background: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer; font-weight: bold; }
            pre#subPreviewText { background: var(--bg); color: var(--text); padding: 15px; border-radius: 5px; overflow-y: auto; flex-grow: 1; font-family: monospace; font-size: 14px; white-space: pre-wrap; word-wrap: break-word; }
        </style>
        <script>
            function openTab(id, btn) {
                document.querySelectorAll('.tab-pane').forEach(e => e.classList.remove('active'));
                document.querySelectorAll('.tab-btn').forEach(e => e.classList.remove('active'));
                document.getElementById(id).classList.add('active');
                if(btn) btn.classList.add('active');
            }
            function handleTypeChange(sel, targetId) {
                document.getElementById(targetId).style.display = sel.value === 'series' ? 'grid' : 'none';
            }

            // Hàm mở Modal Xem Trước Sub
            async function previewSub(id, movieName) {
                document.getElementById('modalTitle').innerText = "📄 Xem trước: " + movieName;
                document.getElementById('subPreviewText').innerText = "⏳ Đang tải nội dung phụ đề...";
                document.getElementById('subModal').style.display = "block";

                try {
                    const res = await fetch('/api/raw-sub/' + id);
                    const text = await res.text();
                    document.getElementById('subPreviewText').innerText = text;
                } catch(e) {
                    document.getElementById('subPreviewText').innerText = "❌ Không thể tải nội dung phụ đề.";
                }
            }
            function closeModal() { document.getElementById('subModal').style.display = "none"; }
            window.onclick = function(event) { if (event.target == document.getElementById('subModal')) closeModal(); }
        </script>
    </head>
    <body>
        <div class="container">
            <h2 style="text-align: center; color: #007bff; margin-bottom: 0;">☁️ KHO PHỤ ĐỀ AI ĐÁM MÂY</h2>
            <p style="text-align: center; font-size: 13px; margin-top: 5px;">Hệ thống Dịch Độc Lập (Groq / Gemini)</p>
            
            <div class="user-bar">
                <span>👋 Xin chào, <b>${username ? username : 'Khách vãng lai'}</b> ${role === 'admin' ? '(👑 Admin)' : (role === 'user' ? '(👤 User)' : '')}</span>
                <div>
                    ${username ? `<a href="/dashboard">🏠 Trang chủ</a><a href="/logout">🚪 Đăng xuất</a>` : `<a href="/auth">🔑 Đăng nhập / Đăng ký</a>`}
                </div>
            </div>
            ${content}
        </div>

        <!-- MODAL HTML -->
        <div id="subModal" class="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 id="modalTitle" style="margin:0;">Xem trước phụ đề</h3>
                    <button class="close-btn" onclick="closeModal()">✕ Đóng</button>
                </div>
                <pre id="subPreviewText">Đang tải...</pre>
            </div>
        </div>
    </body>
    </html>
`;

// ==========================================
// 3. ĐĂNG NHẬP & ĐĂNG KÝ
// ==========================================
app.get('/auth', (req, res) => {
    if (getLoggedInUser(req)) return res.redirect('/dashboard');
    res.send(renderHTML(`
        <div class="grid-2">
            <div class="card" style="border-top: 4px solid #007bff; margin-bottom:0;">
                <h3>🔑 ĐĂNG NHẬP</h3>
                <form action="/api/login" method="POST">
                    <input type="text" name="username" placeholder="Tên tài khoản..." required>
                    <input type="password" name="password" placeholder="Mật khẩu..." required>
                    <button type="submit" class="main-btn">Đăng Nhập</button>
                </form>
            </div>
            <div class="card" style="border-top: 4px solid #28a745; margin-bottom:0;">
                <h3>📝 ĐĂNG KÝ MỚI</h3>
                <form action="/api/register" method="POST">
                    <input type="text" name="username" placeholder="Tạo tên tài khoản..." required>
                    <input type="password" name="password" placeholder="Tạo mật khẩu..." required>
                    <button type="submit" class="main-btn" style="background: #28a745;">Đăng Ký</button>
                </form>
                <p style="font-size:12px; color:#666; margin-bottom:0;">*Người đăng ký đầu tiên sẽ là Admin.</p>
            </div>
        </div>
    `));
});

app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    const userRef = doc(db, "users", username);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) return res.send("Tài khoản đã tồn tại! <a href='/auth'>Quay lại</a>");
    
    const usersSnapshot = await getDocs(collection(db, "users"));
    // THÊM GROQ KEY & MODE VÀO MẶC ĐỊNH
    await setDoc(userRef, { passwordHash: hashPwd(password), role: usersSnapshot.empty ? 'admin' : 'user', geminiKey: '', groqKey: '', geminiModel: 'gemini-2.5-flash', translationMode: 'gemini', createdAt: new Date().toISOString() });
    res.cookie('username', username, { maxAge: 30 * 24 * 60 * 60 * 1000 });
    res.redirect('/dashboard');
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const userSnap = await getDoc(doc(db, "users", username));
    if (!userSnap.exists() || userSnap.data().passwordHash !== hashPwd(password)) {
        return res.send("Sai thông tin! <a href='/auth'>Quay lại</a>");
    }
    res.cookie('username', username, { maxAge: 30 * 24 * 60 * 60 * 1000 });
    res.redirect('/dashboard');
});

app.get('/logout', (req, res) => { res.clearCookie('username'); res.redirect('/'); });

// ==========================================
// 4. TRANG CHỦ & PHÂN QUYỀN
// ==========================================
app.get('/', (req, res) => res.redirect('/dashboard'));

app.get('/dashboard', async (req, res) => {
    const username = getLoggedInUser(req);
    let role = 'guest', geminiKey = '', groqKey = '', currentModel = 'gemini-2.5-flash', translationMode = 'gemini';
    
    if (username) {
        const userSnap = await getDoc(doc(db, "users", username));
        if (userSnap.exists()) {
            const data = userSnap.data();
            role = data.role;
            geminiKey = data.geminiKey || '';
            groqKey = data.groqKey || '';
            currentModel = data.geminiModel || 'gemini-2.5-flash';
            translationMode = data.translationMode || 'gemini';
        }
    }

    const subsSnapshot = await getDocs(collection(db, "shared_subs"));
    const allSubs = [];
    const leaderBoardData = {};

    subsSnapshot.forEach(docSnap => {
        const data = docSnap.data();
        allSubs.push({ id: docSnap.id, ...data });
        leaderBoardData[data.translatedBy] = (leaderBoardData[data.translatedBy] || 0) + 1;
    });

    allSubs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const sortedLeaders = Object.entries(leaderBoardData).sort((a,b) => b[1] - a[1]).slice(0, 5);
    let leaderHtml = sortedLeaders.length ? sortedLeaders.map((l, i) => `
        <div class="leaderboard-item">
            <span>${i===0?'🏆':i===1?'🥈':i===2?'🥉':'🏅'} <b>${l[0]}</b></span>
            <span style="color:#28a745; font-weight:bold;">${l[1]} phim</span>
        </div>
    `).join('') : '<p style="font-size:13px;">Chưa có dữ liệu</p>';

    let dbHtml = '';
    if (allSubs.length === 0) dbHtml = '<p style="text-align:center;">Kho trống.</p>';
    else {
        allSubs.forEach(sub => {
            dbHtml += `
                <div class="db-item">
                    <div>
                        <b style="font-size: 15px;">${sub.movieName}</b><br>
                        <span style="font-size: 12px; color: #888;">⏱️ ${new Date(sub.createdAt).toLocaleDateString()} | 👤 ${sub.translatedBy}</span>
                    </div>
                    <div style="display:flex; flex-wrap: wrap; gap: 5px; justify-content: flex-end;">
                        <button onclick="previewSub('${sub.id}', '${sub.movieName}')" class="btn-preview">📄 Xem trước</button>
                        <a href="/download/${sub.id}?mode=bilingual" class="btn-dl">📥 Song Ngữ</a>
                        <a href="/download/${sub.id}?mode=vi" class="btn-dl" style="background:#17a2b8;">📥 Tiếng Việt</a>
                        ${(role === 'admin' || sub.translatedBy === username) ? `<a href="/delete-sub/${sub.id}" class="btn-del" onclick="return confirm('Xóa?')">🗑️</a>` : ''}
                    </div>
                </div>`;
        });
    }

    let adminHtml = '';
    if (role === 'admin') {
        const usersSnap = await getDocs(collection(db, "users"));
        adminHtml += `<table><tr><th>Username</th><th>Phân quyền</th><th>Ngày tham gia</th><th>Hành động</th></tr>`;
        usersSnap.forEach(u => {
            const ud = u.data();
            adminHtml += `<tr>
                <td><b>${u.id}</b></td>
                <td>${ud.role === 'admin' ? '👑 Admin' : '👤 User'}</td>
                <td>${new Date(ud.createdAt).toLocaleDateString()}</td>
                <td>${u.id !== username ? `<a href="/admin/delete-user/${u.id}" class="btn-del" onclick="return confirm('Xóa user?')">Xóa</a>` : '<i>(Bạn)</i>'}</td>
            </tr>`;
        });
        adminHtml += `</table>`;
    }

    res.send(renderHTML(`
        <div class="card" style="border-top: 4px solid #f39c12;">
            <h3 style="margin-top:0;">🏆 BẢNG VÀNG CỐNG HIẾN</h3>
            ${leaderHtml}
        </div>

        <div class="tab-nav">
            <button class="tab-btn active" onclick="openTab('tab-storage', this)">☁️ Kho Phụ Đề</button>
            ${role !== 'guest' ? `
                <button class="tab-btn" onclick="openTab('tab-search', this)">🔍 Tìm & Dịch Phim</button>
                <button class="tab-btn" onclick="openTab('tab-upload', this)">📤 Dịch File Thủ Công</button>
                <button class="tab-btn" onclick="openTab('tab-api', this)">⚙️ Cấu hình API</button>
            ` : ''}
            ${role === 'admin' ? `<button class="tab-btn" onclick="openTab('tab-admin', this)" style="color:#dc3545;">👑 Quản Trị Admin</button>` : ''}
        </div>

        <div id="tab-storage" class="tab-pane active">
            <div class="card">
                <h3 style="margin-top: 0;">☁️ KHO PHỤ ĐỀ CHUNG</h3>
                <div style="max-height: 600px; overflow-y: auto;">${dbHtml}</div>
            </div>
        </div>

        ${role !== 'guest' ? `
        <div id="tab-search" class="tab-pane">
            <div class="card">
                <h3 style="margin-top: 0;">🔍 TÌM KIẾM PHIM ĐỂ DỊCH (Từ Stremio)</h3>
                <form action="/search" method="GET">
                    <input type="text" name="query" placeholder="Nhập mã IMDb (VD: tt1046141) hoặc Tên phim..." required>
                    <select name="type" onchange="handleTypeChange(this, 'autoSeasonGroup')">
                        <option value="movie">Phim lẻ (Movie)</option>
                        <option value="series">Phim bộ (Series)</option>
                    </select>
                    <div id="autoSeasonGroup" class="grid-2" style="display: none;">
                        <input type="number" name="season" placeholder="Mùa mấy? (VD: 1)" min="1">
                        <input type="number" name="episode" placeholder="Tập mấy? (VD: 2)" min="1">
                    </div>
                    <button type="submit" class="main-btn">🔍 Bắt Đầu Quét</button>
                </form>
            </div>
        </div>

        <div id="tab-upload" class="tab-pane">
            <div class="card">
                <h3 style="margin-top: 0;">📤 TẢI FILE GỐC LÊN ĐỂ DỊCH</h3>
                <form action="/upload-translate" method="POST" enctype="multipart/form-data">
                    <input type="file" name="subFile" accept=".srt,.vtt" required style="padding: 10px; background: #e9ecef;">
                    <input type="text" name="movieName" placeholder="Tên phim hiển thị trên hệ thống..." required>
                    <button type="submit" class="main-btn">🚀 Dịch File Này</button>
                </form>
            </div>
        </div>

        <div id="tab-api" class="tab-pane">
            <div class="card" style="border-top: 4px solid #17a2b8;">
                <h3 style="margin-top: 0; color: #17a2b8;">🔑 CẤU HÌNH API AI (ĐỘC LẬP)</h3>
                <form action="/save-key" method="POST">
                    <label style="font-weight: bold; font-size: 14px;">1. Chọn Bộ Máy Dịch:</label>
                    <select name="translationMode" style="margin-bottom: 15px;">
                        <option value="gemini" ${translationMode === 'gemini' ? 'selected' : ''}>🧠 Google Gemini (Ổn định)</option>
                        <option value="groq" ${translationMode === 'groq' ? 'selected' : ''}>🚀 Groq Llama (Tốc độ)</option>
                    </select>

                    <label style="font-weight: bold; font-size: 14px;">2. API Key (Groq):</label>
                    <input type="text" name="groqKey" value="${groqKey}" placeholder="Nhập Key Groq (gsk_...)" style="margin-bottom: 15px;">

                    <label style="font-weight: bold; font-size: 14px;">3. API Key (Google Gemini):</label>
                    <input type="text" name="geminiKey" value="${geminiKey}" placeholder="Nhập Key Gemini (AIza...)" style="margin-bottom: 15px;">

                    <label style="font-weight: bold; font-size: 14px;">Phiên bản Gemini Model:</label>
                    <select name="geminiModel">
                        <option value="gemini-2.5-flash" selected>Gemini 2.5 Flash</option>
                    </select>
                    <button type="submit" class="main-btn" style="background: #17a2b8; margin-top: 15px;">💾 Lưu Cấu Hình</button>
                </form>
            </div>
        </div>
        ` : ''}

        ${role === 'admin' ? `
        <div id="tab-admin" class="tab-pane">
            <div class="card" style="border: 2px solid #dc3545;">
                <h3 style="margin-top: 0; color: #dc3545;">👑 QUẢN TRỊ HỆ THỐNG</h3>
                <div style="overflow-x:auto;">${adminHtml}</div>
            </div>
        </div>
        ` : ''}
    `, username, role));
});

// ==========================================
// 5. CÁC ROUTE XỬ LÝ CHÍNH
// ==========================================
app.post('/save-key', async (req, res) => {
    const username = getLoggedInUser(req);
    // LƯU CẢ 2 KEY VÀ CHẾ ĐỘ DỊCH
    if (username) await setDoc(doc(db, "users", username), { geminiKey: req.body.geminiKey, groqKey: req.body.groqKey, geminiModel: req.body.geminiModel, translationMode: req.body.translationMode }, { merge: true });
    res.redirect('/dashboard');
});

app.get('/admin/delete-user/:id', async (req, res) => {
    const username = getLoggedInUser(req);
    const userSnap = await getDoc(doc(db, "users", username));
    if (userSnap.exists() && userSnap.data().role === 'admin') {
        await deleteDoc(doc(db, "users", req.params.id));
    }
    res.redirect('/dashboard');
});

// API Trả về nội dung thô để xem trước
app.get('/api/raw-sub/:id', async (req, res) => {
    const subSnap = await getDoc(doc(db, "shared_subs", req.params.id));
    if (!subSnap.exists()) return res.send("Không tìm thấy dữ liệu phụ đề.");
    res.send(subSnap.data().vttContent);
});

// Tải file với tên chuẩn tiếng Anh
app.get('/download/:id', async (req, res) => {
    const { id } = req.params;
    const { mode } = req.query;
    const subSnap = await getDoc(doc(db, "shared_subs", id));
    if (!subSnap.exists()) return res.send("File không tồn tại.");
    
    const data = subSnap.data();
    const safeName = removeVietnameseTones(data.movieName);
    const filename = `${safeName}_${mode === 'vi' ? 'Vietnamese' : 'Bilingual'}_CloudAI.vtt`;
    
    let content = data.vttContent;
    if (mode === 'vi') {
        content = content.replace(/^([^\n]+)\n(<font color='#f1c40f'>.*?<\/font>)$/gm, '$2');
    }

    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
});

app.get('/delete-sub/:id', async (req, res) => {
    const username = getLoggedInUser(req);
    const userSnap = await getDoc(doc(db, "users", username));
    const subSnap = await getDoc(doc(db, "shared_subs", req.params.id));
    if (userSnap.data().role === 'admin' || (subSnap.exists() && subSnap.data().translatedBy === username)) {
        await deleteDoc(doc(db, "shared_subs", req.params.id));
    }
    res.redirect('/dashboard');
});

app.get('/search', async (req, res) => {
    const username = getLoggedInUser(req);
    if (!username) return res.redirect('/');
    const { query, type, season, episode } = req.query;
    let searchUrl = query.startsWith('tt') ? `https://v3-cinemeta.strem.io/meta/${type}/${query}.json` : `https://v3-cinemeta.strem.io/catalog/${type}/top/search=${encodeURIComponent(query)}.json`;

    try {
        const response = await axios.get(searchUrl, axiosConfig);
        const metas = query.startsWith('tt') ? [response.data.meta] : response.data.metas;
        if (!metas || metas.length === 0 || !metas[0]) return res.send(renderHTML(`<h3>❌ Không tìm thấy phim</h3><br><a href="/dashboard">⬅ Trở về</a>`, username));
        
        let resultsHTML = `<h3>Kết quả tìm kiếm cho "${query}":</h3>`;
        for (const meta of metas) {
            let fullId = meta.imdb_id || meta.id;
            let displayName = `${meta.name} (${meta.releaseInfo || meta.year || ''})`;
            if (type === 'series' && season && episode) {
                fullId = `${fullId}:${season}:${episode}`;
                displayName = `${meta.name} (Mùa ${season} Tập ${episode})`;
            }

            const subSnap = await getDoc(doc(db, "shared_subs", fullId));
            if (subSnap.exists()) {
                resultsHTML += `<div class="card"><img src="${meta.poster}" style="width:50px;float:left;margin-right:10px;"><b>${displayName}</b><br><span style="color:green;">⚡ Đã có trong Kho!</span><br><br><a href="/download/${fullId}?mode=bilingual" class="btn-dl">Tải Song Ngữ</a></div>`;
            } else {
                resultsHTML += `<div class="card"><img src="${meta.poster}" style="width:50px;float:left;margin-right:10px;"><b>${displayName}</b><br><span style="color:orange;">☁️ Cần dịch AI</span><br><br><a href="/trigger-translate?type=${type}&id=${fullId}&name=${encodeURIComponent(displayName)}" class="btn-dl" style="background:#007bff;">🚀 Bắt Đầu Dịch</a></div>`;
            }
        }
        res.send(renderHTML(resultsHTML + `<br><a href="/dashboard" class="main-btn" style="text-decoration:none;">⬅ Trở Về</a>`, username));
    } catch (e) { res.send(renderHTML(`<h3>Lỗi: ${e.message}</h3><br><a href="/dashboard">⬅ Trở về</a>`, username)); }
});

app.post('/upload-translate', upload.single('subFile'), async (req, res) => {
    const username = getLoggedInUser(req);
    if (!username || !req.file) return res.redirect('/dashboard');
    fs.readFile(req.file.path, 'utf8', async (err, data) => {
        fs.unlinkSync(req.file.path);
        const userSnap = await getDoc(doc(db, "users", username));
        const uData = userSnap.data();

        // Check điều kiện theo Mode
        if (uData.translationMode === 'groq' && !uData.groqKey) return res.send("Lỗi: Bạn đã chọn Groq nhưng chưa nhập API Key Groq.");
        if ((uData.translationMode === 'gemini' || !uData.translationMode) && !uData.geminiKey) return res.send("Lỗi: Bạn đã chọn Gemini nhưng chưa nhập API Key Gemini.");
        
        const taskId = `upload-${Date.now()}`;
        activeTasks[taskId] = { status: 'Đang nạp file...', progress: 0, movieName: req.body.movieName, movieId: taskId, isCancelled: false };
        runTranslation(taskId, 'manual', taskId, req.body.movieName, username, uData, data);
        res.redirect(`/status-page?taskId=${taskId}`);
    });
});

// ==========================================
// 6. TIẾN ĐỘ NỀN & API CALL
// ==========================================
app.get('/api/cancel-task', (req, res) => {
    if (activeTasks[req.query.taskId]) activeTasks[req.query.taskId].isCancelled = true;
    res.json({ success: true });
});

app.get('/trigger-translate', async (req, res) => {
    const username = getLoggedInUser(req);
    const { type, id, name } = req.query;
    const userSnap = await getDoc(doc(db, "users", username));
    const uData = userSnap.data();

    // Check điều kiện theo Mode
    const mode = uData.translationMode || 'gemini';
    if (mode === 'groq' && !uData.groqKey) return res.send("Lỗi: Bạn đã chọn Groq nhưng chưa nhập API Key Groq.");
    if (mode === 'gemini' && !uData.geminiKey) return res.send("Lỗi: Bạn đã chọn Gemini nhưng chưa nhập API Key Gemini.");
    
    const taskId = `${id}-${Date.now()}`;
    activeTasks[taskId] = { status: 'Đang chuẩn bị...', progress: 0, movieName: name, movieId: id, isCancelled: false };
    runTranslation(taskId, type, id, name, username, uData);
    res.redirect(`/status-page?taskId=${taskId}`);
});

app.get('/status-page', (req, res) => {
    res.send(renderHTML(`
        <div style="text-align: center; padding: 20px;">
            <h3 id="movieName">🎬 Đang xử lý...</h3>
            <div style="background: #eee; border-radius: 20px; height: 25px; margin: 20px 0; overflow: hidden;">
                <div id="progressBar" style="background: #007bff; height: 100%; width: 0%; transition: 0.5s;"></div>
            </div>
            <p id="statusText" style="font-weight: bold; font-size: 18px; color: #d35400;">Khởi tạo...</p>
            <div id="cancelArea" style="margin-top: 15px;"><button onclick="fetch('/api/cancel-task?taskId=${req.query.taskId}')" class="btn-del">🛑 Hủy Dịch</button></div>
            <div id="downloadArea" style="margin-top: 30px; display: none;">
                <a id="dlBi" href="" class="btn-dl" style="font-size: 16px; padding: 10px;">📥 TẢI SONG NGỮ</a>
                <a id="dlVi" href="" class="btn-dl" style="font-size: 16px; padding: 10px; background:#17a2b8;">📥 TẢI THUẦN VIỆT</a>
            </div>
            <a href="/dashboard" style="margin-top: 20px; display: inline-block;">⬅ Trở về Dashboard</a>
        </div>
        <script>
            let isDone = false;
            async function checkStatus() {
                if (isDone) return;
                const res = await fetch('/api/task-status?taskId=${req.query.taskId}');
                const task = await res.json();
                if(task) {
                    document.getElementById('movieName').innerText = "🎬: " + task.movieName;
                    document.getElementById('statusText').innerText = task.status;
                    document.getElementById('progressBar').style.width = task.progress + "%";
                    if(task.isCancelled || task.status.includes('Lỗi')) {
                        document.getElementById('progressBar').style.background = '#dc3545';
                        document.getElementById('cancelArea').style.display = 'none'; isDone = true;
                    } else if(task.status === 'Hoàn thành 🎉') {
                        document.getElementById('progressBar').style.background = '#28a745';
                        document.getElementById('downloadArea').style.display = 'block'; 
                        document.getElementById('cancelArea').style.display = 'none';
                        document.getElementById('dlBi').href = '/download/' + task.movieId + '?mode=bilingual';
                        document.getElementById('dlVi').href = '/download/' + task.movieId + '?mode=vi';
                        isDone = true;
                    }
                }
            }
            setInterval(checkStatus, 1500); checkStatus();
        </script>
    `, getLoggedInUser(req), 'user'));
});

app.get('/api/task-status', (req, res) => res.json(activeTasks[req.query.taskId] || { status: 'Lỗi', progress: 0 }));

async function runTranslation(taskId, type, id, movieName, username, uData, rawSubData = null) {
    const updateTask = (status, progress) => { if (activeTasks[taskId] && !activeTasks[taskId].isCancelled) { activeTasks[taskId].status = status; activeTasks[taskId].progress = progress; } };
    try {
        let subContent = "";
        if (rawSubData) { updateTask('Phân tích file...', 5); subContent = rawSubData; } 
        else {
            updateTask('Tải sub gốc...', 5);
            const osResponse = await axios.get(`https://opensubtitles-v3.strem.io/subtitles/${type}/${id}.json`, axiosConfig);
            const engSubs = (osResponse.data.subtitles || []).filter(sub => sub.lang === 'eng' || sub.lang === 'en');
            if (engSubs.length === 0) return updateTask('❌ Lỗi: Chưa có sub Tiếng Anh.', 0);
            const subResponse = await axios.get(engSubs[0].url, axiosConfig);
            subContent = subResponse.data;
        }

        const blocks = subContent.trim().split(/\n\s*\n/);
        const parsedBlocks = [], originalTexts = [];
        blocks.forEach(block => {
            const lines = block.split('\n'), tsIdx = lines.findIndex(l => l.includes('-->')); 
            if (tsIdx !== -1) { parsedBlocks.push({ isMeta: false, meta: lines.slice(0, tsIdx + 1).join('\n'), text: lines.slice(tsIdx + 1).join('\n') }); originalTexts.push(lines.slice(tsIdx + 1).join(' ')); } 
            else parsedBlocks.push({ isMeta: true, raw: block });
        });

        const chunkSize = 100, translatedTexts = [];
        const mode = uData.translationMode || 'gemini';

        for (let i = 0; i < originalTexts.length; i += chunkSize) {
            if (activeTasks[taskId].isCancelled) return; 
            const chunk = originalTexts.slice(i, i + chunkSize);
            let chunkObj = {}; chunk.forEach((text, idx) => chunkObj[idx] = text);
            let success = false, retries = 0;

            while (!success && retries < 3) {
                if (activeTasks[taskId].isCancelled) return;
                try {
                    let parsedData;
                    if (mode === 'groq') {
                        // Gọi Groq API chuẩn OpenAI
                        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                            model: "llama-3.3-70b-versatile",
                            messages: [
                                { role: "system", content: "Bạn là hệ thống dịch phụ đề phim tự động. Nhiệm vụ của bạn là dịch các giá trị văn bản trong định dạng JSON từ tiếng Anh sang tiếng Việt. TUYỆT ĐỐI GIỮ NGUYÊN CÁC KHÓA (KEYS) SỐ NGUYÊN. CHỈ TRẢ VỀ ĐÚNG CẤU TRÚC ĐỐI TƯỢNG JSON, không kèm bất kỳ giải thích nào khác." },
                                { role: "user", content: JSON.stringify(chunkObj) }
                            ],
                            temperature: 0.3
                        }, { headers: { 'Authorization': `Bearer ${uData.groqKey}`, 'Content-Type': 'application/json' }});
                        
                        let text = response.data.choices[0].message.content.replace(/```json/g, '').replace(/```/g, '').trim();
                        // Trích xuất chính xác chuỗi JSON
                        const jsonMatch = text.match(/\{[\s\S]*\}/);
                        parsedData = JSON.parse(jsonMatch ? jsonMatch[0] : text);
                    }
                    } else {
                        // Gọi Gemini API (Mặc định)
                        const aiResponse = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${uData.geminiKey}`, { 
                            contents: [{ parts: [{ text: `Dịch mảng JSON sau sang tiếng Việt đời thường. TRẢ VỀ ĐÚNG CẤU TRÚC JSON.\n${JSON.stringify(chunkObj)}` }] }] 
                        });
                        
                        let transRes = aiResponse.data.candidates[0].content.parts[0].text.replace(/```json/g, '').replace(/```/g, '').trim();
                        const arrayMatch = transRes.match(/\{[\s\S]*\}/);
                        parsedData = JSON.parse(arrayMatch ? arrayMatch[0] : transRes);
                    }

                    for (let j = 0; j < chunk.length; j++) translatedTexts.push(parsedData[j] || chunk[j]);
                    success = true;
                } catch (err) {
                    retries++;
                    if (retries >= 3) translatedTexts.push(...chunk);
                    else {
                        let waitTime = mode === 'groq' ? 5000 : 25000;
                        const match = (err.message || '').match(/retry in (\d+(\.\d+)?)s/); 
                        if (match) waitTime = (parseFloat(match[1]) + 2) * 1000;
                        
                        updateTask(`API quá tải. Đợi ${Math.ceil(waitTime/1000)}s...`, Math.floor(10 + (i / originalTexts.length) * 80));
                        await new Promise(r => setTimeout(r, waitTime));
                    }
                }
            }
            updateTask(`Đang xử lý ${Math.min(i + chunkSize, originalTexts.length)}/${originalTexts.length}...`, Math.floor(10 + (i / originalTexts.length) * 80));
            
            // Xử lý thời gian nghỉ độc lập
            if (mode === 'gemini') await new Promise(r => setTimeout(r, 6000)); 
            else await new Promise(r => setTimeout(r, 1000));
        }

        if (activeTasks[taskId].isCancelled) return;
        updateTask('Lưu lên Firebase...', 95);
        let finalVttContent = "", textIndex = 0;
        parsedBlocks.forEach(block => {
            if (block.isMeta) finalVttContent += block.raw + "\n\n";
            else { finalVttContent += block.meta + "\n" + block.text + "\n<font color='#f1c40f'>" + (translatedTexts[textIndex] || block.text) + "</font>\n\n"; textIndex++; }
        });

        await setDoc(doc(db, "shared_subs", id), { movieName: movieName, vttContent: finalVttContent, translatedBy: username, createdAt: new Date().toISOString() });
        updateTask('Hoàn thành 🎉', 100);
    } catch (err) { if (!activeTasks[taskId].isCancelled) updateTask(`❌ Lỗi: ${err.message}`, 0); }
}

app.listen(PORT, () => { console.log(`🚀 KHO PHỤ ĐỀ AI (BẢN V2.1 NÂNG CẤP GROQ ĐỘC LẬP) CHẠY TẠI CỔNG 7000`); });
