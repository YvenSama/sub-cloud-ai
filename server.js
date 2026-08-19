const express = require('express');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const fs = require('fs');
// --- IMPORT THƯ VIỆN FIREBASE ---
const { initializeApp } = require("firebase/app");
const { getFirestore, doc, setDoc, getDoc, collection, getDocs, deleteDoc } = require("firebase/firestore");

const app = express();
const PORT = 7000;

// Cấu hình Multer để lưu file tạm thời
const upload = multer({ dest: 'uploads/' });

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// ==========================================
// 1. CẤU HÌNH FIREBASE CỦA BẠN
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

const axiosConfig = {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
};

// ==========================================
// 2. GIAO DIỆN HTML & CSS 
// ==========================================
const renderHTML = (content, username = null, isAdmin = false) => `
    <html>
    <head>
        <title>Nền Tảng Dịch Phụ Đề Đám Mây AI</title>
        <meta charset="utf-8">
        <style>
            :root { --bg: #f0f2f5; --text: #333; --box-bg: white; --border: #ccc; --input-bg: white; }
            body.dark { --bg: #18191a; --text: #e4e6eb; --box-bg: #242526; --border: #3e4042; --input-bg: #3a3b3c; }
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; background: var(--bg); color: var(--text); transition: 0.3s; }
            .container { max-width: 800px; margin: auto; background: var(--box-bg); padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); position: relative; }
            input, select, button { width: 100%; padding: 12px; margin-top: 8px; margin-bottom: 15px; border: 1px solid var(--border); border-radius: 5px; font-size: 16px; box-sizing: border-box; background: var(--input-bg); color: var(--text); }
            .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px; }
            .grid-2 input { margin-bottom: 0; }
            button.main-btn { background: #007bff; color: white; border: none; font-weight: bold; cursor: pointer; transition: 0.3s; }
            button.main-btn:hover { background: #0056b3; }
            .btn-dl { background: #28a745; color: white; border: none; font-weight: bold; padding: 10px 15px; cursor: pointer; border-radius: 5px; text-decoration: none; display: inline-block; text-align: center; font-size: 14px; }
            .btn-del { background: #dc3545; color: white; border: none; font-weight: bold; padding: 8px 12px; cursor: pointer; border-radius: 5px; text-decoration: none; font-size: 14px; }
            .theme-toggle { position: absolute; top: 15px; right: 15px; background: transparent; border: 1px solid var(--border); width: auto; padding: 5px 10px; font-size: 12px; cursor: pointer; border-radius: 20px; color: var(--text); }
            .user-bar { display: flex; justify-content: space-between; align-items: center; background: #34495e; color: white; padding: 10px 15px; border-radius: 5px; margin-bottom: 20px; font-size: 14px; }
            .user-bar a { color: #f1c40f; text-decoration: none; font-weight: bold; margin-left: 15px; }
            .card { background: var(--bg); padding: 15px; border-radius: 8px; border: 1px solid var(--border); margin-bottom: 20px; }
            
            .tab-nav { display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 2px solid var(--border); padding-bottom: 10px; }
            .tab-btn { width: auto; background: transparent; border: none; color: var(--text); font-size: 15px; font-weight: bold; cursor: pointer; padding: 10px 20px; border-radius: 8px; transition: 0.2s; margin: 0; }
            .tab-btn.active { background: #007bff; color: white; }
            .tab-btn:hover:not(.active) { background: var(--border); }
            .tab-pane { display: none; animation: fadeIn 0.3s; }
            .tab-pane.active { display: block; }
            @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
            
            .result-item { display: flex; align-items: center; margin-bottom: 15px; background: var(--bg); padding: 10px; border-radius: 8px; border: 1px solid var(--border); }
            .result-item img { width: 60px; height: 90px; object-fit: cover; border-radius: 4px; margin-right: 15px; }
            .result-info { flex-grow: 1; }
            .result-info h4 { margin: 0 0 5px 0; }
            .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; margin-top: 5px;}
            .badge.success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb;}
            .badge.error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb;}
            .db-list { list-style: none; padding: 0; margin: 0; }
            .db-item { display: flex; justify-content: space-between; align-items: center; padding: 15px 10px; border-bottom: 1px solid var(--border); }
            .db-item:last-child { border-bottom: none; }
            
            .toggle-switch { display: inline-flex; align-items: center; cursor: pointer; margin-bottom: 15px; }
            .toggle-switch input { display: none; }
            .toggle-slider { width: 40px; height: 20px; background-color: #ccc; border-radius: 20px; position: relative; transition: 0.3s; margin-right: 10px; }
            .toggle-slider:before { content: ""; position: absolute; width: 16px; height: 16px; border-radius: 50%; background-color: white; top: 2px; left: 2px; transition: 0.3s; }
            .toggle-switch input:checked + .toggle-slider { background-color: #007bff; }
            .toggle-switch input:checked + .toggle-slider:before { transform: translateX(20px); }
        </style>
        <script>
            function toggleDark() {
                document.body.classList.toggle('dark');
                localStorage.setItem('darkMode', document.body.classList.contains('dark'));
            }
            
            function openTab(tabId, btnElement) {
                document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
                document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
                document.getElementById(tabId).classList.add('active');
                if(btnElement) btnElement.classList.add('active');
            }

            window.onload = () => { 
                if(localStorage.getItem('darkMode') === 'true') document.body.classList.add('dark'); 
            }
            
            async function testAndSaveKey() {
                const keyInput = document.getElementById('geminiKey').value.trim();
                const modelSelect = document.getElementById('geminiModel').value;
                const statusBox = document.getElementById('keyStatus');
                const btn = document.getElementById('btnTestKey');
                
                if(!keyInput) {
                    statusBox.innerHTML = '<span class="badge error">Vui lòng nhập Key!</span>';
                    return;
                }
                
                btn.innerText = "⏳ Đang kiểm tra...";
                btn.disabled = true;
                
                try {
                    const res = await fetch('/api/test-gemini', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ apiKey: keyInput, modelName: modelSelect })
                    });
                    const result = await res.json();
                    
                    if(result.success) {
                        statusBox.innerHTML = '<span class="badge success">✅ Key & Model Hợp Lệ! Đã lưu thành công.</span>';
                        await fetch('/save-key', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ geminiKey: keyInput, modelName: modelSelect })
                        });
                    } else {
                        statusBox.innerHTML = '<span class="badge error">❌ Lỗi: ' + result.message + '</span>';
                    }
                } catch(e) {
                    statusBox.innerHTML = '<span class="badge error">❌ Không thể kết nối đến máy chủ.</span>';
                }
                
                btn.innerText = "🔌 Kiểm Tra & Lưu Key";
                btn.disabled = false;
            }

            function toggleManualInput() {
                const isManual = document.getElementById('manualMode').checked;
                document.getElementById('autoSearchGroup').style.display = isManual ? 'none' : 'block';
                document.getElementById('manualSearchGroup').style.display = isManual ? 'block' : 'none';
            }

            // Hiện khung Mùa/Tập khi chọn Phim Bộ
            function handleTypeChange(selectElement, targetId) {
                const group = document.getElementById(targetId);
                if (selectElement.value === 'series') {
                    group.style.display = 'grid';
                } else {
                    group.style.display = 'none';
                }
            }
        </script>
    </head>
    <body>
        <div class="container">
            <button class="theme-toggle" onclick="toggleDark()">🌓 Đổi Giao Diện</button>
            <h2 style="text-align: center; color: #007bff; margin-bottom: 5px;">☁️ KHO PHỤ ĐỀ AI ĐÁM MÂY</h2>
            <p style="text-align: center; font-size: 13px; margin-top: -10px;">Lưu trữ Firebase - Tốc độ ánh sáng</p>
            ${username ? `<div class="user-bar">
                <span>👋 Xin chào, <b>${username}</b> ${isAdmin ? '(👑 Admin)' : '(👤 User)'}</span>
                <div>
                    <a href="/dashboard">🏠 Bảng Điều Khiển</a>
                    <a href="/logout">🚪 Thoát</a>
                </div>
            </div>` : ''}
            ${content}
        </div>
    </body>
    </html>
`;

// ==========================================
// 3. ROUTE ĐĂNG NHẬP (Giữ nguyên)
// ==========================================
app.get('/', (req, res) => {
    if (getLoggedInUser(req)) return res.redirect('/dashboard');
    res.send(renderHTML(`
        <div style="margin-top: 20px;">
            <h3>🔑 ĐĂNG NHẬP HỆ THỐNG</h3>
            <form action="/login" method="POST">
                <input type="text" name="username" placeholder="Nhập tên tài khoản của bạn..." required>
                <button type="submit" class="main-btn">🚀 Truy Cập</button>
            </form>
            <p style="font-size: 12px; opacity: 0.7; text-align: center;">*Tài khoản đầu tiên khởi tạo sẽ tự động nắm quyền Admin.</p>
        </div>
    `));
});

app.post('/login', async (req, res) => {
    const { username } = req.body;
    if (!username) return res.redirect('/');
    
    const userRef = doc(db, "users", username);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
        const usersSnapshot = await getDocs(collection(db, "users"));
        const isAdmin = usersSnapshot.empty; 
        
        await setDoc(userRef, { 
            role: isAdmin ? 'admin' : 'user', 
            geminiKey: '',
            geminiModel: 'gemini-2.5-flash', 
            createdAt: new Date().toISOString()
        });
    }
    
    res.cookie('username', username, { maxAge: 86400000 });
    res.redirect('/dashboard');
});

app.get('/logout', (req, res) => {
    res.clearCookie('username');
    res.redirect('/');
});

// ==========================================
// 4. API TEST KEY & DASHBOARD
// ==========================================
app.post('/api/test-gemini', async (req, res) => {
    const { apiKey, modelName } = req.body;
    try {
        const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
            contents: [{ parts: [{ text: "Respond with the word 'OK' only." }] }]
        });
        if (response.data.candidates) res.json({ success: true });
    } catch (error) {
        const errorMsg = error.response?.data?.error?.message || "Key không hợp lệ hoặc Model này không khả dụng.";
        res.json({ success: false, message: errorMsg });
    }
});

app.post('/save-key', async (req, res) => {
    const username = getLoggedInUser(req);
    const { geminiKey, modelName } = req.body;
    if (username && geminiKey) {
        await setDoc(doc(db, "users", username), { geminiKey, geminiModel: modelName }, { merge: true });
    }
    res.json({ success: true });
});

app.get('/dashboard', async (req, res) => {
    const username = getLoggedInUser(req);
    if (!username) return res.redirect('/');

    const userSnap = await getDoc(doc(db, "users", username));
    const userData = userSnap.data();
    const isAdmin = userData.role === 'admin';
    const currentModel = userData.geminiModel || 'gemini-2.5-flash';

    const subsSnapshot = await getDocs(collection(db, "shared_subs"));
    let dbHtml = '';
    if (subsSnapshot.empty) {
        dbHtml = `<div style="text-align: center; padding: 40px 0; opacity: 0.6;"><p style="font-size: 40px; margin: 0;">📭</p><p>Kho chung hiện đang trống.</p></div>`;
    } else {
        dbHtml = `<ul class="db-list">`;
        subsSnapshot.forEach(docSnap => {
            const sub = docSnap.data();
            const id = docSnap.id;
            dbHtml += `
                <li class="db-item">
                    <div>
                        <b style="font-size: 16px;">${sub.movieName}</b> <br>
                        <span style="font-size: 12px; color: #888;">Dịch bởi: <b style="color: #007bff">${sub.translatedBy}</b> | ${new Date(sub.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <a href="/download-direct/${id}" class="btn-dl">⬇️ Tải Về</a>
                        ${isAdmin ? `<a href="/delete-sub/${id}" class="btn-del" onclick="return confirm('Bạn muốn xóa?')">🗑️ Xóa</a>` : ''}
                    </div>
                </li>`;
        });
        dbHtml += `</ul>`;
    }

    res.send(renderHTML(`
        <div class="tab-nav">
            <button class="tab-btn active" onclick="openTab('tab-search', this)">🔍 Tìm Phim</button>
            <button class="tab-btn" onclick="openTab('tab-upload', this)">📤 Tải File Lên</button>
            <button class="tab-btn" onclick="openTab('tab-storage', this)">☁️ Kho Phụ Đề</button>
            <button class="tab-btn" onclick="openTab('tab-api', this)">⚙️ Cài đặt API</button>
        </div>

        <!-- TAB TÌM KIẾM ĐÃ NÂNG CẤP NHẬP MÙA/TẬP -->
        <div id="tab-search" class="tab-pane active">
            <div class="card" style="border-left: 4px solid #007bff;">
                <h3 style="margin-top: 0; display: flex; justify-content: space-between; align-items: center;">
                    🎬 TÌM KIẾM PHIM VÀ DỊCH
                    <label class="toggle-switch">
                        <input type="checkbox" id="manualMode" onchange="toggleManualInput()">
                        <span class="toggle-slider"></span>
                        <span style="font-size: 12px; font-weight: normal; color: var(--text);">Nhập ID thủ công</span>
                    </label>
                </h3>
                
                <!-- Tìm kiếm Tự động -->
                <div id="autoSearchGroup">
                    <form action="/search" method="GET">
                        <input type="text" name="query" placeholder="Tên phim (VD: Adventure Time, Avatar...)" required>
                        <select name="type" onchange="handleTypeChange(this, 'autoSeasonGroup')">
                            <option value="movie">Phim lẻ (Movie)</option>
                            <option value="series">Phim bộ (Series)</option>
                        </select>
                        <div id="autoSeasonGroup" class="grid-2" style="display: none;">
                            <input type="number" name="season" placeholder="Mùa mấy? (VD: 1)" min="1">
                            <input type="number" name="episode" placeholder="Tập mấy? (VD: 2)" min="1">
                        </div>
                        <button type="submit" class="main-btn" style="padding: 15px; font-size: 16px;">🔍 Tìm Kiếm Ngay</button>
                    </form>
                </div>

                <!-- Tìm kiếm bằng IMDb ID -->
                <div id="manualSearchGroup" style="display: none; background: #e9ecef; padding: 15px; border-radius: 8px; border-left: 3px solid #6c757d;">
                    <p style="font-size: 12px; color: #666; margin-top: 0;">Lấy ID trên IMDb (vd: tt1046141).</p>
                    <form action="/search-manual" method="GET">
                        <input type="text" name="imdbId" placeholder="Mã IMDb ID gốc..." required style="background: white;">
                        <input type="text" name="customName" placeholder="Tên phim hiển thị..." required style="background: white;">
                        <select name="type" onchange="handleTypeChange(this, 'manualSeasonGroup')" style="background: white;">
                            <option value="movie">Phim lẻ (Movie)</option>
                            <option value="series">Phim bộ (Series)</option>
                        </select>
                        <div id="manualSeasonGroup" class="grid-2" style="display: none;">
                            <input type="number" name="season" placeholder="Mùa mấy? (VD: 1)" min="1" style="background: white;">
                            <input type="number" name="episode" placeholder="Tập mấy? (VD: 2)" min="1" style="background: white;">
                        </div>
                        <button type="submit" class="main-btn" style="padding: 15px; font-size: 16px; background: #6c757d;">🔍 Truy Xuất ID Này</button>
                    </form>
                </div>
            </div>
        </div>

        <!-- TAB UPLOAD FILE -->
        <div id="tab-upload" class="tab-pane">
            <div class="card" style="border-left: 4px solid #17a2b8;">
                <h3 style="margin-top: 0;">📤 DỊCH FILE PHỤ ĐỀ TỪ MÁY TÍNH</h3>
                <form action="/upload-translate" method="POST" enctype="multipart/form-data">
                    <input type="file" name="subFile" accept=".srt,.vtt" required style="padding: 10px; background: #e9ecef;">
                    <input type="text" name="movieName" placeholder="Tên phim (để lưu vào kho chung)..." required>
                    <button type="submit" class="main-btn" style="padding: 15px; font-size: 16px; background: #17a2b8;">🚀 Dịch File Này</button>
                </form>
            </div>
        </div>

        <div id="tab-storage" class="tab-pane">
            <div class="card" style="border-left: 4px solid #28a745;">
                <h3 style="margin-top: 0; margin-bottom: 20px;">☁️ DANH SÁCH KHO PHỤ ĐỀ CHUNG</h3>
                <div style="max-height: 500px; overflow-y: auto; padding-right: 10px;">
                    ${dbHtml}
                </div>
            </div>
        </div>

        <div id="tab-api" class="tab-pane">
            <div class="card" style="border-left: 4px solid #f1c40f;">
                <h3 style="margin-top: 0;">🔑 CẤU HÌNH GOOGLE GEMINI API</h3>
                <label style="font-weight: bold; font-size: 14px;">1. Chọn Phiên Bản Model AI:</label>
                <select id="geminiModel" style="margin-top: 8px; margin-bottom: 20px; padding: 12px; background: var(--bg);">
                    <option value="gemini-2.5-flash" ${currentModel === 'gemini-2.5-flash' ? 'selected' : ''}>Gemini 2.5 Flash</option>
                    <option value="gemini-1.5-flash" ${currentModel === 'gemini-1.5-flash' ? 'selected' : ''}>Gemini 1.5 Flash</option>
                </select>
                <label style="font-weight: bold; font-size: 14px;">2. Dán API Key Của Bạn:</label>
                <div style="display: flex; gap: 10px; margin-top: 8px; margin-bottom: 10px;">
                    <input type="text" id="geminiKey" value="${userData.geminiKey || ''}" placeholder="Nhập mã API..." style="margin: 0; flex: 1;">
                    <button id="btnTestKey" onclick="testAndSaveKey()" class="main-btn" style="width: 180px; margin: 0;">🔌 Kiểm Tra & Lưu</button>
                </div>
                <div id="keyStatus"></div>
            </div>
        </div>
    `, username, isAdmin));
});

app.get('/delete-sub/:id', async (req, res) => {
    const username = getLoggedInUser(req);
    if (!username) return res.redirect('/');
    const userSnap = await getDoc(doc(db, "users", username));
    if (userSnap.data().role !== 'admin') return res.send("Bạn không có quyền Admin!");
    try {
        await deleteDoc(doc(db, "shared_subs", req.params.id));
        res.redirect('/dashboard');
    } catch (err) { res.send("Lỗi xóa: " + err.message); }
});

// ==========================================
// 5. TÌM KIẾM ĐÃ CẤU TRÚC LẠI CHO PHIM BỘ
// ==========================================
app.get('/search', async (req, res) => {
    const username = getLoggedInUser(req);
    if (!username) return res.redirect('/');
    
    const { query, type, season, episode } = req.query;
    try {
        const response = await axios.get(`https://v3-cinemeta.strem.io/catalog/${type}/top/search=${encodeURIComponent(query)}.json`, axiosConfig);
        const metas = response.data.metas;

        if (!metas || metas.length === 0) return res.send(renderHTML(`<h3>❌ Không tìm thấy phim</h3><br><a href="/dashboard">⬅ Trở về</a>`, username));

        let resultsHTML = `<h3>Kết quả tìm kiếm cho "${query}":</h3>`;
        
        for (const meta of metas) {
            resultsHTML += await processMovieResult(meta.imdb_id, meta.name, meta.releaseInfo || meta.year, meta.poster, type, season, episode);
        }
        res.send(renderHTML(resultsHTML + `<br><a href="/dashboard" class="main-btn" style="text-decoration:none; display:inline-block; padding:10px 20px;">⬅ Trở Về</a>`, username));
    } catch (error) { res.send(renderHTML(`<h3>Lỗi kết nối dữ liệu: ${error.message}</h3><br><a href="/dashboard">⬅ Trở về</a>`, username)); }
});

app.get('/search-manual', async (req, res) => {
    const username = getLoggedInUser(req);
    if (!username) return res.redirect('/');
    
    const { imdbId, customName, type, season, episode } = req.query;
    try {
        let resultsHTML = `<h3>Kết quả truy xuất ID "${imdbId}":</h3>`;
        resultsHTML += await processMovieResult(imdbId, customName, 'N/A', 'https://via.placeholder.com/60x90?text=Manual', type, season, episode);
        
        res.send(renderHTML(resultsHTML + `<br><a href="/dashboard" class="main-btn" style="text-decoration:none; display:inline-block; padding:10px 20px;">⬅ Trở Về</a>`, username));
    } catch (error) { res.send(renderHTML(`<h3>Lỗi kết nối dữ liệu: ${error.message}</h3><br><a href="/dashboard">⬅ Trở về</a>`, username)); }
});

// HÀM XỬ LÝ GHÉP MÃ S/E (QUAN TRỌNG NHẤT)
async function processMovieResult(movieId, name, year, poster, type, season, episode) {
    const displayYear = year || ''; 
    const yearStr = displayYear ? `(${displayYear})` : '';
    let html = '';

    // Nếu là phim bộ và có nhập mùa/tập, tạo mã fullId chuẩn của Stremio API
    let fullId = movieId;
    let displayName = `${name} ${yearStr}`;
    
    if (type === 'series' && season && episode) {
        fullId = `${movieId}:${season}:${episode}`;
        displayName = `${name} (Mùa ${season} Tập ${episode})`;
    }

    const subSnap = await getDoc(doc(db, "shared_subs", fullId));
    
    if (subSnap.exists()) {
        html += `
            <div class="result-item">
                <img src="${poster || ''}">
                <div class="result-info">
                    <h4>${displayName}</h4>
                    <p style="color: #28a745; font-weight: bold;">⚡ Đã dịch sẵn trong Kho Đám Mây!</p>
                </div>
                <a href="/download-direct/${fullId}" class="btn-dl">⬇️ Tải Ngay (0.1s)</a>
            </div>`;
    } else {
        let hasOpenSubViet = false;
        let openSubVietUrl = "";
        try {
            // ĐÂY CHÍNH LÀ CHỖ API TÌM THEO ID (với Phim bộ thì nó là ttXXXXXX:1:2)
            const osUrl = `https://opensubtitles-v3.strem.io/subtitles/${type}/${fullId}.json`;
            const osResponse = await axios.get(osUrl, axiosConfig);
            const allSubs = osResponse.data.subtitles || [];
            
            const vieSubs = allSubs.filter(sub => 
                sub.lang && (sub.lang.toLowerCase().includes('vi') || sub.lang.toLowerCase() === 'vie')
            );
            
            if (vieSubs.length > 0) { 
                hasOpenSubViet = true; 
                openSubVietUrl = vieSubs[0].url; 
            }
        } catch (e) {
            console.log(`Lỗi quét nguồn cho ${fullId}:`, e.message);
        }

        if (hasOpenSubViet) {
            html += `
                <div class="result-item">
                    <img src="${poster || ''}">
                    <div class="result-info">
                        <h4>${displayName}</h4>
                        <p style="color: #16a085; font-weight: bold;">✨ Đã có Sub Việt gốc!</p>
                    </div>
                    <a href="/download-external?url=${encodeURIComponent(openSubVietUrl)}&name=${encodeURIComponent(displayName)}" class="btn-dl" style="background: #16a085;">⬇️ Tải Sub Gốc</a>
                </div>`;
        } else {
            html += `
                <div class="result-item">
                    <img src="${poster || ''}">
                    <div class="result-info">
                        <h4>${displayName}</h4>
                        <p style="color: #e67e22;">☁️ Chưa có sub Việt. Cần dùng AI dịch mới.</p>
                    </div>
                    <a href="/trigger-translate?type=${type}&id=${fullId}&name=${encodeURIComponent(displayName)}" class="btn-dl" style="background: #007bff;">🚀 Dịch Bằng AI</a>
                </div>`;
        }
    }
    return html;
}

app.get('/download-direct/:movieId', async (req, res) => {
    const movieId = req.params.movieId;
    const subSnap = await getDoc(doc(db, "shared_subs", movieId));
    if (subSnap.exists()) {
        const data = subSnap.data();
        const safeName = data.movieName.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-');
        res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}_CloudAI_song_ngu.vtt"`);
        res.send(data.vttContent);
    } else { res.send("Không tìm thấy dữ liệu!"); }
});

app.get('/download-external', async (req, res) => {
    const { url, name } = req.query;
    try {
        const subResponse = await axios.get(url, axiosConfig);
        const safeName = name.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-');
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}_vietsub_goc.srt"`);
        res.send(subResponse.data);
    } catch (err) { res.send("Lỗi tải tệp: " + err.message); }
});

// ==========================================
// 5.2 XỬ LÝ UPLOAD FILE DỊCH
// ==========================================
app.post('/upload-translate', upload.single('subFile'), async (req, res) => {
    const username = getLoggedInUser(req);
    if (!username) return res.redirect('/');
    
    const { movieName } = req.body;
    const file = req.file;

    if (!file) return res.send(renderHTML(`<h3>❌ Vui lòng chọn file!</h3><br><a href="/dashboard">⬅ Trở về</a>`, username));

    fs.readFile(file.path, 'utf8', async (err, data) => {
        if (err) return res.send("Lỗi đọc file: " + err.message);
        fs.unlinkSync(file.path);

        const userSnap = await getDoc(doc(db, "users", username));
        const userData = userSnap.data();
        const geminiKey = userData.geminiKey;
        const geminiModel = userData.geminiModel || 'gemini-2.5-flash';

        if (!geminiKey) {
            return res.send(renderHTML(`<h3 style="color: red;">❌ Bạn chưa cấu hình API Key!</h3><a href="/dashboard">Quay lại</a>`, username));
        }

        const customId = `upload-${Date.now()}`;
        const taskId = `${customId}-task`;
        
        activeTasks[taskId] = { status: 'Đang nạp file tải lên...', progress: 0, movieName: movieName, movieId: customId, isCancelled: false };

        runGeminiTranslation(taskId, 'manual', customId, movieName, username, geminiKey, geminiModel, data);
        res.redirect(`/status-page?taskId=${taskId}`);
    });
});


// ==========================================
// 6. TIẾN ĐỘ NỀN & GEMINI API CALL 
// ==========================================
app.get('/api/cancel-task', (req, res) => {
    const { taskId } = req.query;
    if (activeTasks[taskId]) {
        activeTasks[taskId].isCancelled = true;
        activeTasks[taskId].status = '❌ Đã hủy bởi người dùng';
    }
    res.json({ success: true });
});

app.get('/trigger-translate', async (req, res) => {
    const username = getLoggedInUser(req);
    const { type, id, name } = req.query;

    const userSnap = await getDoc(doc(db, "users", username));
    const userData = userSnap.data();
    const geminiKey = userData.geminiKey;
    const geminiModel = userData.geminiModel || 'gemini-2.5-flash';

    if (!geminiKey) {
        return res.send(renderHTML(`
            <div style="text-align:center;">
                <h3 style="color: red;">❌ Bạn chưa cấu hình API Key!</h3>
                <a href="/dashboard" class="btn-dl" style="background:#007bff;">Quay lại Bảng điều khiển</a>
            </div>
        `, username));
    }

    const taskId = `${id}-${Date.now()}`;
    activeTasks[taskId] = { status: 'Đang chuẩn bị...', progress: 0, movieName: name, movieId: id, isCancelled: false };

    runGeminiTranslation(taskId, type, id, name, username, geminiKey, geminiModel);
    res.redirect(`/status-page?taskId=${taskId}`);
});

app.get('/status-page', (req, res) => {
    const username = getLoggedInUser(req);
    const { taskId } = req.query;
    res.send(renderHTML(`
        <div style="text-align: center; padding: 20px;">
            <h3 id="movieName">🎬 Đang nạp phim dữ liệu...</h3>
            <div style="background: #eee; border-radius: 20px; height: 25px; width: 100%; margin: 20px 0; overflow: hidden;">
                <div id="progressBar" style="background: #007bff; height: 100%; width: 0%; transition: 0.5s;"></div>
            </div>
            <p id="statusText" style="font-weight: bold; font-size: 18px; color: #d35400;">Đang khởi tạo kết nối đám mây...</p>
            
            <div id="cancelArea" style="margin-top: 15px;">
                <button onclick="cancelTranslation()" class="btn-del" style="font-size: 16px; padding: 10px 20px;">🛑 Hủy Dịch</button>
            </div>

            <div id="downloadArea" style="margin-top: 30px; display: none;">
                <a id="cloudDlBtn" href="" class="btn-dl" style="font-size: 18px; padding: 15px 30px;">📥 TẢI PHỤ ĐỀ XUỐNG MÁY</a>
                <br><br>
            </div>
            <a href="/dashboard" style="color:var(--text); margin-top: 20px; display: inline-block;">⬅ Trở về Bảng Điều Khiển</a>
        </div>
        <script>
            let isDone = false;

            async function cancelTranslation() {
                if(confirm('Bạn có chắc chắn muốn hủy quá trình dịch? Tiến trình sẽ dừng lại ngay lập tức.')) {
                    await fetch('/api/cancel-task?taskId=${taskId}');
                    document.getElementById('statusText').innerText = '❌ Đã hủy bởi người dùng';
                    document.getElementById('statusText').style.color = '#dc3545';
                    document.getElementById('progressBar').style.background = '#dc3545';
                    document.getElementById('cancelArea').style.display = 'none';
                    isDone = true;
                }
            }

            async function checkStatus() {
                if (isDone) return;
                const res = await fetch('/api/task-status?taskId=${taskId}');
                const task = await res.json();
                if(task) {
                    document.getElementById('movieName').innerText = "🎬 Đang xử lý: " + task.movieName;
                    document.getElementById('statusText').innerText = task.status;
                    document.getElementById('progressBar').style.width = task.progress + "%";
                    
                    if(task.isCancelled) {
                        document.getElementById('statusText').style.color = '#dc3545';
                        document.getElementById('progressBar').style.background = '#dc3545';
                        document.getElementById('cancelArea').style.display = 'none';
                        isDone = true;
                    } else if(task.status === 'Hoàn thành 🎉') {
                        document.getElementById('progressBar').style.background = '#28a745';
                        document.getElementById('statusText').style.color = '#28a745';
                        document.getElementById('downloadArea').style.display = 'block';
                        document.getElementById('cancelArea').style.display = 'none';
                        document.getElementById('cloudDlBtn').href = '/download-direct/' + task.movieId;
                        isDone = true;
                    } else if(task.status.includes('Lỗi')) {
                        document.getElementById('progressBar').style.background = '#dc3545';
                        document.getElementById('statusText').style.color = '#dc3545';
                        document.getElementById('cancelArea').style.display = 'none';
                        isDone = true;
                    }
                }
            }
            setInterval(checkStatus, 1500); 
            checkStatus();
        </script>
    `, username));
});

app.get('/api/task-status', (req, res) => {
    res.json(activeTasks[req.query.taskId] || { status: 'Không tìm thấy tác vụ', progress: 0 });
});

async function runGeminiTranslation(taskId, type, id, movieName, username, apiKey, modelName, rawSubData = null) {
    const updateTask = (status, progress) => { 
        if (activeTasks[taskId] && !activeTasks[taskId].isCancelled) { 
            activeTasks[taskId].status = status; 
            activeTasks[taskId].progress = progress; 
        } 
    };

    try {
        let subContent = "";
        
        if (rawSubData) {
            updateTask('Đang phân tích file của bạn...', 5);
            subContent = rawSubData;
        } else {
            updateTask('Đang tải tệp phụ đề gốc...', 5);
            // GỌI API LẤY SUB VỚI MÃ CHUẨN ĐÃ GHÉP MÙA/TẬP
            const osUrl = `https://opensubtitles-v3.strem.io/subtitles/${type}/${id}.json`;
            const osResponse = await axios.get(osUrl, axiosConfig);
            const allSubs = osResponse.data.subtitles;
            const engSubs = allSubs ? allSubs.filter(sub => sub.lang === 'eng' || sub.lang === 'en') : [];
            
            if (engSubs.length === 0) return updateTask('❌ Lỗi: Phim này chưa có sub Tiếng Anh để dịch.', 0);

            const subResponse = await axios.get(engSubs[0].url, axiosConfig);
            subContent = subResponse.data;
        }

        const blocks = subContent.trim().split(/\n\s*\n/);
        const parsedBlocks = [];
        const originalTexts = [];

        blocks.forEach(block => {
            const lines = block.split('\n');
            const timestampIdx = lines.findIndex(l => l.includes('-->')); 
            if (timestampIdx !== -1) {
                const meta = lines.slice(0, timestampIdx + 1).join('\n');
                const text = lines.slice(timestampIdx + 1).join(' '); 
                parsedBlocks.push({ isMeta: false, meta, text });
                originalTexts.push(text);
            } else {
                parsedBlocks.push({ isMeta: true, raw: block });
            }
        });

        const chunkSize = 100; 
        const translatedTexts = [];
        updateTask(`Đang yêu cầu ${modelName}...`, 10);

        for (let i = 0; i < originalTexts.length; i += chunkSize) {
            if (activeTasks[taskId] && activeTasks[taskId].isCancelled) return; 

            const chunk = originalTexts.slice(i, i + chunkSize);
            let chunkObj = {};
            chunk.forEach((text, idx) => { chunkObj[idx] = text; });
            
            let success = false;
            let retries = 0;
            const maxRetries = 3;

            while (!success && retries < maxRetries) {
                if (activeTasks[taskId] && activeTasks[taskId].isCancelled) return;

                try {
                    const aiResponse = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
                        contents: [{
                            parts: [{
                                text: `Bạn là biên dịch viên phim chuyên nghiệp. Dịch mảng đối tượng JSON sau sang tiếng Việt đời thường.
TRẢ VỀ ĐÚNG CẤU TRÚC JSON, GIỮ NGUYÊN KHÓA TỪ 0 ĐẾN ${chunk.length - 1}. KHÔNG BỔ SUNG GÌ THÊM.
Dữ liệu:
${JSON.stringify(chunkObj)}`
                            }]
                        }]
                    });
                    
                    let transRes = aiResponse.data.candidates[0].content.parts[0].text;
                    transRes = transRes.replace(/```json/g, '').replace(/```/g, '').trim();
                    const arrayMatch = transRes.match(/\{[\s\S]*\}/);
                    if (arrayMatch) transRes = arrayMatch[0];
                    
                    const parsedData = JSON.parse(transRes);
                    
                    for (let j = 0; j < chunk.length; j++) {
                        const splitTrans = (parsedData && parsedData[j]) ? parsedData[j] : chunk[j];
                        translatedTexts.push(splitTrans);
                    }
                    success = true;

                } catch (err) {
                    retries++;
                    const errMsg = err.response?.data?.error?.message || err.message;
                    
                    if (retries >= maxRetries) {
                        console.error(`Bỏ qua đoạn ${i} do lỗi API liên tục.`);
                        translatedTexts.push(...chunk);
                    } else {
                        let waitTime = 25000; 
                        const match = errMsg.match(/retry in (\d+(\.\d+)?)s/);
                        if (match) waitTime = (parseFloat(match[1]) + 2) * 1000; 

                        const realPercent = Math.floor(10 + (i / originalTexts.length) * 80);
                        updateTask(`API quá tải. Đang chờ ${Math.ceil(waitTime/1000)}s để thử lại...`, realPercent);
                        
                        await new Promise(r => setTimeout(r, waitTime));
                    }
                }
            }
            
            if (activeTasks[taskId] && activeTasks[taskId].isCancelled) return;
            const realPercent = Math.floor(10 + (i / originalTexts.length) * 80);
            updateTask(`Đang xử lý thoại thứ ${Math.min(i + chunkSize, originalTexts.length)}/${originalTexts.length}...`, realPercent);
            
            await new Promise(r => setTimeout(r, 6000)); 
        }

        if (activeTasks[taskId] && activeTasks[taskId].isCancelled) return;

        updateTask('Đang lưu trữ lên Firebase Cloud...', 95);
        let finalVttContent = "";
        let textIndex = 0;
        parsedBlocks.forEach(block => {
            if (block.isMeta) {
                finalVttContent += block.raw + "\n\n";
            } else {
                const viText = translatedTexts[textIndex] || block.text;
                finalVttContent += block.meta + "\n" + block.text + "\n<font color='#f1c40f'>" + viText + "</font>\n\n";
                textIndex++;
            }
        });

        await setDoc(doc(db, "shared_subs", id), {
            movieName: movieName,
            vttContent: finalVttContent,
            translatedBy: username,
            createdAt: new Date().toISOString()
        });

        updateTask('Hoàn thành 🎉', 100);

    } catch (err) {
        if (activeTasks[taskId] && !activeTasks[taskId].isCancelled) {
            updateTask(`❌ Lỗi: ${err.message}`, 0);
        }
    }
}

app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 NỀN TẢNG KHO PHỤ ĐỀ AI ĐÃ KHỞI CHẠY (BẢN VÁ LỖI CẤU TRÚC PHIM BỘ)`);
    console.log(`👉 Truy cập ngay tại: http://localhost:7000`);
    console.log(`=======================================================`);
});
