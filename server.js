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
// 2. GIAO DIỆN HTML & CSS TỔNG HỢP
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
            input[type="text"], input[type="number"], select, button { width: 100%; padding: 12px; margin-top: 8px; margin-bottom: 15px; border: 1px solid var(--border); border-radius: 5px; font-size: 16px; box-sizing: border-box; background: var(--input-bg); color: var(--text); }
            .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px; }
            .grid-2 input { margin-bottom: 0; }
            button.main-btn { background: #007bff; color: white; border: none; font-weight: bold; cursor: pointer; transition: 0.3s; }
            button.main-btn:hover { background: #0056b3; }
            .btn-dl { background: #28a745; color: white; border: none; font-weight: bold; padding: 8px 12px; cursor: pointer; border-radius: 5px; text-decoration: none; display: inline-block; text-align: center; font-size: 13px; }
            .btn-del { background: #dc3545; color: white; border: none; font-weight: bold; padding: 8px 12px; cursor: pointer; border-radius: 5px; text-decoration: none; font-size: 13px; }
            .btn-edit { background: #ffc107; color: #212529; border: none; font-weight: bold; padding: 8px 12px; cursor: pointer; border-radius: 5px; font-size: 13px; }
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
            
            .sub-group { margin-bottom: 15px; background: var(--box-bg); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
            .sub-group-title { background: rgba(0, 123, 255, 0.1); padding: 10px 15px; margin: 0; font-size: 16px; color: #007bff; border-bottom: 1px solid var(--border); }
            .db-list { list-style: none; padding: 0; margin: 0; }
            .db-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; border-bottom: 1px solid var(--border); transition: 0.2s; }
            .db-item:last-child { border-bottom: none; }
            .db-item:hover { background: var(--bg); }
            .sub-checkbox { width: 18px; height: 18px; cursor: pointer; margin-right: 10px; margin-top: 0; }
            
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

            // Gửi API Sửa Tên
            async function editSubName(id, oldName) {
                const newName = prompt("Đổi tên phim/tập phim:", oldName);
                if(newName && newName.trim() !== "" && newName !== oldName) {
                    const res = await fetch('/api/edit-sub/' + id, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ newName: newName.trim() })
                    });
                    if(res.ok) location.reload();
                    else alert("Có lỗi xảy ra khi đổi tên!");
                }
            }

            // Tính năng Search trong Kho
            function searchStorage() {
                const filter = document.getElementById('searchBox').value.toLowerCase();
                const groups = document.querySelectorAll('.sub-group');
                groups.forEach(group => {
                    let groupMatch = group.getAttribute('data-base').toLowerCase().includes(filter);
                    let hasVisibleItem = false;
                    const items = group.querySelectorAll('.db-item');
                    items.forEach(item => {
                        if (item.getAttribute('data-full').toLowerCase().includes(filter)) {
                            item.style.display = 'flex';
                            hasVisibleItem = true;
                        } else {
                            item.style.display = 'none';
                        }
                    });
                    group.style.display = (groupMatch || hasVisibleItem) ? 'block' : 'none';
                });
            }

            // Tính năng Tải nhiều file cùng lúc
            function downloadSelected() {
                const checkboxes = document.querySelectorAll('.sub-checkbox:checked');
                if(checkboxes.length === 0) return alert('Vui lòng chọn ít nhất 1 phụ đề để tải!');
                
                checkboxes.forEach((cb, index) => {
                    setTimeout(() => {
                        const a = document.createElement('a');
                        a.href = '/download-direct/' + cb.value;
                        a.style.display = 'none';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                    }, index * 800); // Tải cách nhau 0.8s để trình duyệt không chặn
                });
            }

            // Chọn tất cả
            function toggleSelectAll(source) {
                const checkboxes = document.querySelectorAll('.sub-checkbox');
                checkboxes.forEach(cb => cb.checked = source.checked);
            }

            async function testAndSaveKey() {
                // ... (Giữ nguyên logic API Key như cũ)
                const keyInput = document.getElementById('geminiKey').value.trim();
                const modelSelect = document.getElementById('geminiModel').value;
                const statusBox = document.getElementById('keyStatus');
                const btn = document.getElementById('btnTestKey');
                if(!keyInput) { statusBox.innerHTML = '<span class="badge error">Vui lòng nhập Key!</span>'; return; }
                btn.innerText = "⏳ Đang kiểm tra..."; btn.disabled = true;
                try {
                    const res = await fetch('/api/test-gemini', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: keyInput, modelName: modelSelect }) });
                    const result = await res.json();
                    if(result.success) {
                        statusBox.innerHTML = '<span class="badge success">✅ Key & Model Hợp Lệ! Đã lưu.</span>';
                        await fetch('/save-key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ geminiKey: keyInput, modelName: modelSelect }) });
                    } else statusBox.innerHTML = '<span class="badge error">❌ Lỗi: ' + result.message + '</span>';
                } catch(e) { statusBox.innerHTML = '<span class="badge error">❌ Lỗi kết nối.</span>'; }
                btn.innerText = "🔌 Kiểm Tra & Lưu Key"; btn.disabled = false;
            }

            function toggleManualInput() {
                const isManual = document.getElementById('manualMode').checked;
                document.getElementById('autoSearchGroup').style.display = isManual ? 'none' : 'block';
                document.getElementById('manualSearchGroup').style.display = isManual ? 'block' : 'none';
            }

            function handleTypeChange(selectElement, targetId) {
                document.getElementById(targetId).style.display = selectElement.value === 'series' ? 'grid' : 'none';
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
// 3. ROUTE ĐĂNG NHẬP
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
        await setDoc(userRef, { role: usersSnapshot.empty ? 'admin' : 'user', geminiKey: '', geminiModel: 'gemini-2.5-flash', createdAt: new Date().toISOString() });
    }
    res.cookie('username', username, { maxAge: 86400000 });
    res.redirect('/dashboard');
});

app.get('/logout', (req, res) => { res.clearCookie('username'); res.redirect('/'); });

// ==========================================
// 4. API TÙY CHỈNH (TEST KEY & EDIT NAME)
// ==========================================
app.post('/api/test-gemini', async (req, res) => { /* Code cũ giữ nguyên */
    const { apiKey, modelName } = req.body;
    try {
        const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, { contents: [{ parts: [{ text: "OK" }] }] });
        if (response.data.candidates) res.json({ success: true });
    } catch (error) { res.json({ success: false, message: error.response?.data?.error?.message || "Lỗi Key" }); }
});

app.post('/save-key', async (req, res) => {
    const username = getLoggedInUser(req);
    if (username && req.body.geminiKey) await setDoc(doc(db, "users", username), { geminiKey: req.body.geminiKey, geminiModel: req.body.modelName }, { merge: true });
    res.json({ success: true });
});

// Nút Sửa Tên Phim
app.post('/api/edit-sub/:id', async (req, res) => {
    const username = getLoggedInUser(req);
    if (!username) return res.status(403).json({ success: false });
    const userSnap = await getDoc(doc(db, "users", username));
    const subSnap = await getDoc(doc(db, "shared_subs", req.params.id));
    
    if (subSnap.exists()) {
        // Chỉ admin hoặc người upload mới được đổi tên
        if (userSnap.data().role === 'admin' || subSnap.data().translatedBy === username) {
            await setDoc(doc(db, "shared_subs", req.params.id), { movieName: req.body.newName }, { merge: true });
            return res.json({ success: true });
        }
    }
    res.status(403).json({ success: false });
});

app.get('/delete-sub/:id', async (req, res) => {
    const username = getLoggedInUser(req);
    if (!username) return res.redirect('/');
    const userSnap = await getDoc(doc(db, "users", username));
    const subSnap = await getDoc(doc(db, "shared_subs", req.params.id));
    if (userSnap.data().role === 'admin' || (subSnap.exists() && subSnap.data().translatedBy === username)) {
        await deleteDoc(doc(db, "shared_subs", req.params.id));
        res.redirect('/dashboard');
    } else { res.send("Bạn không có quyền Xóa!"); }
});

// ==========================================
// 5. DASHBOARD & KHO LƯU TRỮ TỐI ƯU
// ==========================================
app.get('/dashboard', async (req, res) => {
    const username = getLoggedInUser(req);
    if (!username) return res.redirect('/');

    const userSnap = await getDoc(doc(db, "users", username));
    const userData = userSnap.data();
    const isAdmin = userData.role === 'admin';
    const currentModel = userData.geminiModel || 'gemini-2.5-flash';

    // LẤY VÀ SẮP XẾP DỮ LIỆU
    const subsSnapshot = await getDocs(collection(db, "shared_subs"));
    const allSubs = [];
    subsSnapshot.forEach(docSnap => allSubs.push({ id: docSnap.id, ...docSnap.data() }));

    // Sắp xếp A-Z theo tên phim
    allSubs.sort((a, b) => a.movieName.localeCompare(b.movieName));

    // Gom nhóm phim (Dựa vào tên gốc, loại bỏ chuỗi "Mùa/Tập" ra khỏi tên thư mục)
    const groupedSubs = {};
    allSubs.forEach(sub => {
        let baseName = sub.movieName.replace(/\s*\((Mùa|Season|Tập|Ep).*?\)/i, '').trim();
        if (!groupedSubs[baseName]) groupedSubs[baseName] = [];
        groupedSubs[baseName].push(sub);
    });

    let dbHtml = '';
    if (allSubs.length === 0) {
        dbHtml = `<div style="text-align: center; padding: 40px 0; opacity: 0.6;"><p style="font-size: 40px; margin: 0;">📭</p><p>Kho chung hiện đang trống.</p></div>`;
    } else {
        dbHtml = `
            <div style="display: flex; gap: 10px; margin-bottom: 15px; align-items: center;">
                <input type="text" id="searchBox" onkeyup="searchStorage()" placeholder="🔍 Tìm nhanh tên phim, tập phim..." style="margin: 0; flex: 1;">
                <button onclick="downloadSelected()" class="btn-dl" style="margin: 0; padding: 12px 15px; background: #6c757d;">📥 Tải Mục Đã Chọn</button>
            </div>
            <div style="margin-bottom: 10px; font-size: 14px;">
                <input type="checkbox" id="selectAll" onclick="toggleSelectAll(this)" style="width:auto; display:inline-block;"> <label for="selectAll"><b>Chọn tất cả</b></label>
            </div>
        `;
        
        for (const [baseName, group] of Object.entries(groupedSubs)) {
            // Sắp xếp các tập bên trong theo thời gian tạo (cũ -> mới)
            group.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            
            dbHtml += `
                <div class="sub-group" data-base="${baseName}">
                    <h4 class="sub-group-title">📁 ${baseName}</h4>
                    <ul class="db-list">`;
            
            group.forEach(sub => {
                const dateStr = new Date(sub.createdAt).toLocaleString('vi-VN', { hour: '2-digit', minute:'2-digit', day:'2-digit', month:'2-digit', year:'numeric'});
                const canEdit = isAdmin || sub.translatedBy === username;
                
                dbHtml += `
                    <li class="db-item" data-full="${sub.movieName}">
                        <div style="display: flex; align-items: center;">
                            <input type="checkbox" class="sub-checkbox" value="${sub.id}">
                            <div>
                                <b style="font-size: 15px;">${sub.movieName}</b> <br>
                                <span style="font-size: 12px; color: #888;">⏱️ ${dateStr} | 👤 ${sub.translatedBy}</span>
                            </div>
                        </div>
                        <div style="display: flex; gap: 5px;">
                            <a href="/download-direct/${sub.id}" class="btn-dl" title="Tải về">⬇️</a>
                            ${canEdit ? `<button onclick="editSubName('${sub.id}', '${sub.movieName}')" class="btn-edit" title="Đổi tên">✏️</button>` : ''}
                            ${canEdit ? `<a href="/delete-sub/${sub.id}" class="btn-del" title="Xóa" onclick="return confirm('Bạn muốn xóa?')">🗑️</a>` : ''}
                        </div>
                    </li>`;
            });
            dbHtml += `</ul></div>`;
        }
    }

    res.send(renderHTML(`
        <div class="tab-nav">
            <button class="tab-btn active" onclick="openTab('tab-search', this)">🔍 Tìm Phim</button>
            <button class="tab-btn" onclick="openTab('tab-upload', this)">📤 Tải File Lên</button>
            <button class="tab-btn" onclick="openTab('tab-storage', this)">☁️ Kho Phụ Đề</button>
            <button class="tab-btn" onclick="openTab('tab-api', this)">⚙️ Cài đặt API</button>
        </div>

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
                <div id="manualSearchGroup" style="display: none; background: #e9ecef; padding: 15px; border-radius: 8px; border-left: 3px solid #6c757d;">
                    <form action="/search-manual" method="GET">
                        <input type="text" name="imdbId" placeholder="Mã IMDb ID gốc (vd: tt1046141)..." required style="background: white;">
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
            <div class="card" style="border-left: 4px solid #28a745; padding: 20px;">
                <h3 style="margin-top: 0; margin-bottom: 15px;">☁️ KHO PHỤ ĐỀ ĐÃ DỊCH</h3>
                ${dbHtml}
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


// ==========================================
// 6. XỬ LÝ TÌM KIẾM & PHỤ TRỢ (Tên Tải Về Mượt Hơn)
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
        for (const meta of metas) resultsHTML += await processMovieResult(meta.imdb_id, meta.name, meta.releaseInfo || meta.year, meta.poster, type, season, episode);
        res.send(renderHTML(resultsHTML + `<br><a href="/dashboard" class="main-btn" style="text-decoration:none; display:inline-block; padding:10px 20px;">⬅ Trở Về</a>`, username));
    } catch (error) { res.send(renderHTML(`<h3>Lỗi: ${error.message}</h3><br><a href="/dashboard">⬅ Trở về</a>`, username)); }
});

app.get('/search-manual', async (req, res) => {
    const username = getLoggedInUser(req);
    if (!username) return res.redirect('/');
    const { imdbId, customName, type, season, episode } = req.query;
    try {
        let resultsHTML = `<h3>Kết quả truy xuất ID "${imdbId}":</h3>`;
        resultsHTML += await processMovieResult(imdbId, customName, 'N/A', 'https://via.placeholder.com/60x90?text=Manual', type, season, episode);
        res.send(renderHTML(resultsHTML + `<br><a href="/dashboard" class="main-btn" style="text-decoration:none; display:inline-block; padding:10px 20px;">⬅ Trở Về</a>`, username));
    } catch (error) { res.send(renderHTML(`<h3>Lỗi: ${error.message}</h3><br><a href="/dashboard">⬅ Trở về</a>`, username)); }
});

async function processMovieResult(movieId, name, year, poster, type, season, episode) {
    const displayYear = year || ''; 
    const yearStr = displayYear ? `(${displayYear})` : '';
    let html = '';
    let fullId = movieId;
    let displayName = `${name} ${yearStr}`.trim();
    
    if (type === 'series' && season && episode) {
        fullId = `${movieId}:${season}:${episode}`;
        displayName = `${name} (Mùa ${season} Tập ${episode})`;
    }

    const subSnap = await getDoc(doc(db, "shared_subs", fullId));
    if (subSnap.exists()) {
        html += `<div class="result-item"><img src="${poster || ''}"><div class="result-info"><h4>${displayName}</h4><p style="color: #28a745; font-weight: bold;">⚡ Đã có trong Kho!</p></div><a href="/download-direct/${fullId}" class="btn-dl">⬇️ Tải Ngay</a></div>`;
    } else {
        let hasOpenSubViet = false, openSubVietUrl = "";
        try {
            const osResponse = await axios.get(`https://opensubtitles-v3.strem.io/subtitles/${type}/${fullId}.json`, axiosConfig);
            const vieSubs = (osResponse.data.subtitles || []).filter(sub => sub.lang && (sub.lang.toLowerCase().includes('vi') || sub.lang.toLowerCase() === 'vie'));
            if (vieSubs.length > 0) { hasOpenSubViet = true; openSubVietUrl = vieSubs[0].url; }
        } catch (e) { }

        if (hasOpenSubViet) html += `<div class="result-item"><img src="${poster || ''}"><div class="result-info"><h4>${displayName}</h4><p style="color: #16a085; font-weight: bold;">✨ Đã có Sub Việt gốc!</p></div><a href="/download-external?url=${encodeURIComponent(openSubVietUrl)}&name=${encodeURIComponent(displayName)}" class="btn-dl" style="background: #16a085;">⬇️ Tải Sub Gốc</a></div>`;
        else html += `<div class="result-item"><img src="${poster || ''}"><div class="result-info"><h4>${displayName}</h4><p style="color: #e67e22;">☁️ Cần dùng AI dịch.</p></div><a href="/trigger-translate?type=${type}&id=${fullId}&name=${encodeURIComponent(displayName)}" class="btn-dl" style="background: #007bff;">🚀 Dịch Bằng AI</a></div>`;
    }
    return html;
}

// Tối ưu tên file tải về (Giữ nguyên tiếng Việt, xóa ký tự đặc biệt)
app.get('/download-direct/:movieId', async (req, res) => {
    const movieId = req.params.movieId;
    const subSnap = await getDoc(doc(db, "shared_subs", movieId));
    if (subSnap.exists()) {
        const data = subSnap.data();
        const safeName = data.movieName.replace(/[^a-zA-Z0-9\u00C0-\u024F\s\(\)-]/g, '').trim().replace(/\s+/g, '_');
        res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}_CloudAI.vtt"`);
        res.send(data.vttContent);
    } else { res.send("Không tìm thấy dữ liệu!"); }
});

app.get('/download-external', async (req, res) => {
    const { url, name } = req.query;
    try {
        const subResponse = await axios.get(url, axiosConfig);
        const safeName = name.replace(/[^a-zA-Z0-9\u00C0-\u024F\s\(\)-]/g, '').trim().replace(/\s+/g, '_');
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}_Goc.srt"`);
        res.send(subResponse.data);
    } catch (err) { res.send("Lỗi tải tệp: " + err.message); }
});

app.post('/upload-translate', upload.single('subFile'), async (req, res) => {
    const username = getLoggedInUser(req);
    if (!username) return res.redirect('/');
    const { movieName } = req.body;
    if (!req.file) return res.send(renderHTML(`<h3>❌ Vui lòng chọn file!</h3><br><a href="/dashboard">⬅ Trở về</a>`, username));
    fs.readFile(req.file.path, 'utf8', async (err, data) => {
        if (err) return res.send("Lỗi đọc file");
        fs.unlinkSync(req.file.path);
        const userSnap = await getDoc(doc(db, "users", username));
        if (!userSnap.data().geminiKey) return res.send(renderHTML(`<h3 style="color: red;">❌ Chưa có API Key!</h3><a href="/dashboard">Quay lại</a>`, username));
        
        const customId = `upload-${Date.now()}`;
        const taskId = `${customId}-task`;
        activeTasks[taskId] = { status: 'Đang nạp file...', progress: 0, movieName: movieName, movieId: customId, isCancelled: false };
        runGeminiTranslation(taskId, 'manual', customId, movieName, username, userSnap.data().geminiKey, userSnap.data().geminiModel || 'gemini-2.5-flash', data);
        res.redirect(`/status-page?taskId=${taskId}`);
    });
});

// ==========================================
// 7. TIẾN ĐỘ NỀN & GEMINI API CALL 
// ==========================================
app.get('/api/cancel-task', (req, res) => {
    const { taskId } = req.query;
    if (activeTasks[taskId]) { activeTasks[taskId].isCancelled = true; activeTasks[taskId].status = '❌ Đã hủy'; }
    res.json({ success: true });
});

app.get('/trigger-translate', async (req, res) => {
    const username = getLoggedInUser(req);
    const { type, id, name } = req.query;
    const userSnap = await getDoc(doc(db, "users", username));
    if (!userSnap.data().geminiKey) return res.send(renderHTML(`<div style="text-align:center;"><h3 style="color: red;">❌ Bạn chưa cấu hình API Key!</h3><a href="/dashboard" class="btn-dl" style="background:#007bff;">Quay lại</a></div>`, username));
    
    const taskId = `${id}-${Date.now()}`;
    activeTasks[taskId] = { status: 'Đang chuẩn bị...', progress: 0, movieName: name, movieId: id, isCancelled: false };
    runGeminiTranslation(taskId, type, id, name, username, userSnap.data().geminiKey, userSnap.data().geminiModel || 'gemini-2.5-flash');
    res.redirect(`/status-page?taskId=${taskId}`);
});

app.get('/status-page', (req, res) => {
    const username = getLoggedInUser(req);
    res.send(renderHTML(`
        <div style="text-align: center; padding: 20px;">
            <h3 id="movieName">🎬 Đang nạp phim dữ liệu...</h3>
            <div style="background: #eee; border-radius: 20px; height: 25px; width: 100%; margin: 20px 0; overflow: hidden;">
                <div id="progressBar" style="background: #007bff; height: 100%; width: 0%; transition: 0.5s;"></div>
            </div>
            <p id="statusText" style="font-weight: bold; font-size: 18px; color: #d35400;">Đang khởi tạo...</p>
            <div id="cancelArea" style="margin-top: 15px;"><button onclick="cancelTranslation()" class="btn-del">🛑 Hủy Dịch</button></div>
            <div id="downloadArea" style="margin-top: 30px; display: none;"><a id="cloudDlBtn" href="" class="btn-dl" style="font-size: 18px; padding: 15px 30px;">📥 TẢI PHỤ ĐỀ XUỐNG MÁY</a></div>
            <a href="/dashboard" style="color:var(--text); margin-top: 20px; display: inline-block;">⬅ Trở về Bảng Điều Khiển</a>
        </div>
        <script>
            let isDone = false;
            async function cancelTranslation() {
                if(confirm('Hủy quá trình dịch?')) {
                    await fetch('/api/cancel-task?taskId=${req.query.taskId}');
                    document.getElementById('statusText').innerText = '❌ Đã hủy'; document.getElementById('statusText').style.color = '#dc3545';
                    document.getElementById('progressBar').style.background = '#dc3545'; document.getElementById('cancelArea').style.display = 'none';
                    isDone = true;
                }
            }
            async function checkStatus() {
                if (isDone) return;
                const res = await fetch('/api/task-status?taskId=${req.query.taskId}');
                const task = await res.json();
                if(task) {
                    document.getElementById('movieName').innerText = "🎬 Đang xử lý: " + task.movieName;
                    document.getElementById('statusText').innerText = task.status;
                    document.getElementById('progressBar').style.width = task.progress + "%";
                    if(task.isCancelled || task.status.includes('Lỗi')) {
                        document.getElementById('statusText').style.color = '#dc3545'; document.getElementById('progressBar').style.background = '#dc3545';
                        document.getElementById('cancelArea').style.display = 'none'; isDone = true;
                    } else if(task.status === 'Hoàn thành 🎉') {
                        document.getElementById('progressBar').style.background = '#28a745'; document.getElementById('statusText').style.color = '#28a745';
                        document.getElementById('downloadArea').style.display = 'block'; document.getElementById('cancelArea').style.display = 'none';
                        document.getElementById('cloudDlBtn').href = '/download-direct/' + task.movieId; isDone = true;
                    }
                }
            }
            setInterval(checkStatus, 1500); checkStatus();
        </script>
    `, username));
});

app.get('/api/task-status', (req, res) => res.json(activeTasks[req.query.taskId] || { status: 'Không tìm thấy tác vụ', progress: 0 }));

async function runGeminiTranslation(taskId, type, id, movieName, username, apiKey, modelName, rawSubData = null) {
    const updateTask = (status, progress) => { if (activeTasks[taskId] && !activeTasks[taskId].isCancelled) { activeTasks[taskId].status = status; activeTasks[taskId].progress = progress; } };
    try {
        let subContent = "";
        if (rawSubData) { updateTask('Đang phân tích file...', 5); subContent = rawSubData; } 
        else {
            updateTask('Đang tải tệp phụ đề gốc...', 5);
            const osResponse = await axios.get(`https://opensubtitles-v3.strem.io/subtitles/${type}/${id}.json`, axiosConfig);
            const engSubs = (osResponse.data.subtitles || []).filter(sub => sub.lang === 'eng' || sub.lang === 'en');
            if (engSubs.length === 0) return updateTask('❌ Lỗi: Phim này chưa có sub Tiếng Anh.', 0);
            const subResponse = await axios.get(engSubs[0].url, axiosConfig);
            subContent = subResponse.data;
        }

        const blocks = subContent.trim().split(/\n\s*\n/);
        const parsedBlocks = [], originalTexts = [];
        blocks.forEach(block => {
            const lines = block.split('\n'), timestampIdx = lines.findIndex(l => l.includes('-->')); 
            if (timestampIdx !== -1) { parsedBlocks.push({ isMeta: false, meta: lines.slice(0, timestampIdx + 1).join('\n'), text: lines.slice(timestampIdx + 1).join(' ') }); originalTexts.push(lines.slice(timestampIdx + 1).join(' ')); } 
            else parsedBlocks.push({ isMeta: true, raw: block });
        });

        const chunkSize = 100, translatedTexts = [];
        updateTask(`Đang yêu cầu ${modelName}...`, 10);

        for (let i = 0; i < originalTexts.length; i += chunkSize) {
            if (activeTasks[taskId] && activeTasks[taskId].isCancelled) return; 
            const chunk = originalTexts.slice(i, i + chunkSize);
            let chunkObj = {}; chunk.forEach((text, idx) => chunkObj[idx] = text);
            let success = false, retries = 0;

            while (!success && retries < 3) {
                if (activeTasks[taskId] && activeTasks[taskId].isCancelled) return;
                try {
                    const aiResponse = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, { contents: [{ parts: [{ text: `Dịch mảng JSON sau sang tiếng Việt. TRẢ VỀ ĐÚNG CẤU TRÚC JSON.\nDữ liệu:\n${JSON.stringify(chunkObj)}` }] }] });
                    let transRes = aiResponse.data.candidates[0].content.parts[0].text.replace(/```json/g, '').replace(/```/g, '').trim();
                    const arrayMatch = transRes.match(/\{[\s\S]*\}/);
                    if (arrayMatch) transRes = arrayMatch[0];
                    const parsedData = JSON.parse(transRes);
                    for (let j = 0; j < chunk.length; j++) translatedTexts.push(parsedData && parsedData[j] ? parsedData[j] : chunk[j]);
                    success = true;
                } catch (err) {
                    retries++;
                    if (retries >= 3) translatedTexts.push(...chunk);
                    else {
                        let waitTime = 25000;
                        const match = (err.response?.data?.error?.message || '').match(/retry in (\d+(\.\d+)?)s/);
                        if (match) waitTime = (parseFloat(match[1]) + 2) * 1000; 
                        updateTask(`API quá tải. Đang chờ ${Math.ceil(waitTime/1000)}s...`, Math.floor(10 + (i / originalTexts.length) * 80));
                        await new Promise(r => setTimeout(r, waitTime));
                    }
                }
            }
            updateTask(`Đang xử lý ${Math.min(i + chunkSize, originalTexts.length)}/${originalTexts.length}...`, Math.floor(10 + (i / originalTexts.length) * 80));
            await new Promise(r => setTimeout(r, 6000)); 
        }

        if (activeTasks[taskId] && activeTasks[taskId].isCancelled) return;
        updateTask('Đang lưu trữ...', 95);
        let finalVttContent = "", textIndex = 0;
        parsedBlocks.forEach(block => {
            if (block.isMeta) finalVttContent += block.raw + "\n\n";
            else { finalVttContent += block.meta + "\n" + block.text + "\n<font color='#f1c40f'>" + (translatedTexts[textIndex] || block.text) + "</font>\n\n"; textIndex++; }
        });

        await setDoc(doc(db, "shared_subs", id), { movieName: movieName, vttContent: finalVttContent, translatedBy: username, createdAt: new Date().toISOString() });
        updateTask('Hoàn thành 🎉', 100);
    } catch (err) { if (activeTasks[taskId] && !activeTasks[taskId].isCancelled) updateTask(`❌ Lỗi: ${err.message}`, 0); }
}

app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 NỀN TẢNG KHO PHỤ ĐỀ AI ĐÃ KHỞI CHẠY (BẢN PRO TỐI ƯU KHO)`);
    console.log(`👉 Truy cập ngay tại: http://localhost:7000`);
    console.log(`=======================================================`);
});
