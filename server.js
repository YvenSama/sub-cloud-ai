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
const translationQueue = [];
let isProcessingQueue = false;

const getLoggedInUser = (req) => req.cookies.username || null;
const hashPwd = (pwd) => crypto.createHash('sha256').update(pwd).digest('hex');

const formatFilename = (str) => {
    let s = str.replace(/Mùa\s*(\d+)/gi, 'S$1').replace(/Tập\s*(\d+)/gi, 'E$1');
    s = s.replace(/Season\s*(\d+)/gi, 'S$1').replace(/Episode\s*(\d+)/gi, 'E$1');
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^a-zA-Z0-9\s\-]/g, '').trim().replace(/\s+/g, '_');
};

const axiosConfig = { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } };

// ==========================================
// 2. GIAO DIỆN HTML TỔNG
// ==========================================
const renderHTML = (content, username = null, role = 'guest') => `
    <html>
    <head>
        <title>Nền Tảng Dịch Phụ Đề AI (Pro)</title>
        <meta charset="utf-8">
        <style>
            :root { --bg: #f4f6f9; --text: #333; --box-bg: white; --border: #dee2e6; --input-bg: white; }
            body.dark { --bg: #121212; --text: #e0e0e0; --box-bg: #1e1e1e; --border: #333; --input-bg: #2d2d2d; }
            body { font-family: 'Segoe UI', Tahoma, Geneva, sans-serif; padding: 20px; background: var(--bg); color: var(--text); transition: 0.3s; padding-bottom: 80px; }
            .container { max-width: 900px; margin: auto; background: var(--box-bg); padding: 30px; border-radius: 12px; box-shadow: 0 5px 15px rgba(0,0,0,0.08); position: relative; }
            input[type="text"], input[type="password"], input[type="number"], select, button { width: 100%; padding: 12px; margin-top: 8px; margin-bottom: 15px; border: 1px solid var(--border); border-radius: 6px; background: var(--input-bg); color: var(--text); }
            .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
            @media (max-width: 768px) { .grid-2 { grid-template-columns: 1fr; } }
            button.main-btn { background: #007bff; color: white; border: none; font-weight: bold; cursor: pointer; transition: 0.2s; }
            button.main-btn:hover { background: #0056b3; }
            .btn-dl { background: #28a745; color: white; border: none; padding: 6px 12px; border-radius: 5px; text-decoration: none; font-size: 13px; font-weight: bold; margin-right:5px; cursor: pointer;}
            .btn-preview { background: #17a2b8; color: white; border: none; padding: 6px 12px; border-radius: 5px; text-decoration: none; font-size: 13px; font-weight: bold; margin-right:5px; cursor: pointer;}
            .btn-del { background: #dc3545; color: white; border: none; padding: 6px 12px; border-radius: 5px; text-decoration: none; font-size: 13px; font-weight: bold; cursor: pointer;}
            .btn-edit { background: #ffc107; color: #000; border: none; padding: 6px 12px; border-radius: 5px; text-decoration: none; font-size: 13px; font-weight: bold; cursor: pointer; margin-right:5px;}
            .user-bar { display: flex; justify-content: space-between; align-items: center; background: #2c3e50; color: white; padding: 12px 20px; border-radius: 8px; margin-bottom: 20px; }
            .user-bar a { color: #f1c40f; text-decoration: none; font-weight: bold; margin-left: 15px; }
            .tab-nav { display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 2px solid var(--border); padding-bottom: 10px; overflow-x: auto;}
            .tab-btn { width: auto; background: transparent; border: none; color: var(--text); font-weight: bold; cursor: pointer; padding: 10px 15px; border-radius: 8px; margin: 0; white-space: nowrap;}
            .tab-btn.active { background: #007bff; color: white; }
            .tab-pane { display: none; animation: fadeIn 0.3s; }
            .tab-pane.active { display: block; }
            @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
            .card { background: var(--bg); padding: 20px; border-radius: 8px; border: 1px solid var(--border); margin-bottom: 20px; }
            
            .sub-group { margin-bottom: 10px; background: var(--box-bg); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
            .sub-group-title { background: rgba(0, 123, 255, 0.1); padding: 15px; margin: 0; font-size: 16px; color: #007bff; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: 0.2s;}
            .sub-group-title:hover { background: rgba(0, 123, 255, 0.2); }
            .db-list { list-style: none; padding: 0; margin: 0; display: none; border-top: 1px solid var(--border); }
            .db-item { display: flex; justify-content: space-between; align-items: center; padding: 15px; border-bottom: 1px solid var(--border); }
            .db-item:last-child { border-bottom: none; }
            .db-item img { width: 45px; height: 65px; object-fit: cover; border-radius: 4px; margin-right: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            
            .leaderboard-item { display: flex; justify-content: space-between; padding: 10px; background: var(--input-bg); margin-bottom: 5px; border-radius: 5px; border: 1px solid var(--border);}
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid var(--border); padding: 10px; text-align: left; }
            th { background: rgba(0,0,0,0.05); }

            .modal { display: none; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); backdrop-filter: blur(3px); }
            .modal-content { background: var(--box-bg); margin: 5% auto; padding: 20px; border: 1px solid var(--border); width: 80%; max-width: 700px; border-radius: 10px; max-height: 80vh; display: flex; flex-direction: column; }
            .modal-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 10px; }
            .close-btn { background: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer; font-weight: bold; }
            pre#subPreviewText { background: var(--bg); color: var(--text); padding: 15px; border-radius: 5px; overflow-y: auto; flex-grow: 1; font-family: monospace; font-size: 14px; white-space: pre-wrap; word-wrap: break-word; }

            .toggle-switch { display: inline-flex; align-items: center; cursor: pointer; margin-bottom: 15px; }
            .toggle-switch input { display: none; }
            .toggle-slider { width: 40px; height: 20px; background-color: #ccc; border-radius: 20px; position: relative; transition: 0.3s; margin-right: 10px; }
            .toggle-slider:before { content: ""; position: absolute; width: 16px; height: 16px; border-radius: 50%; background-color: white; top: 2px; left: 2px; transition: 0.3s; }
            .toggle-switch input:checked + .toggle-slider { background-color: #007bff; }
            .toggle-switch input:checked + .toggle-slider:before { transform: translateX(20px); }
            
            #bgTaskWidget { display: none; position: fixed; bottom: 20px; left: 20px; width: 320px; background: var(--box-bg); border: 2px solid #007bff; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.3); padding: 15px; z-index: 10000; transition: 0.3s; }
        </style>
        <script>
            let checkTaskInterval;

            function openTab(id, btn) {
                document.querySelectorAll('.tab-pane').forEach(e => e.classList.remove('active'));
                document.querySelectorAll('.tab-btn').forEach(e => e.classList.remove('active'));
                document.getElementById(id).classList.add('active');
                if(btn) btn.classList.add('active');
            }

            function toggleGroup(groupId) {
                const list = document.getElementById('group-' + groupId);
                const icon = document.getElementById('icon-' + groupId);
                if(list.style.display === 'none' || list.style.display === '') {
                    list.style.display = 'block'; icon.innerText = '▲';
                } else {
                    list.style.display = 'none'; icon.innerText = '▼';
                }
            }

            function handleTypeChange(sel, targetId) { document.getElementById(targetId).style.display = sel.value === 'series' ? 'grid' : 'none'; }

            async function previewSub(id, movieName) {
                document.getElementById('modalTitle').innerText = "📄 Xem trước: " + movieName;
                document.getElementById('subPreviewText').innerText = "⏳ Đang tải nội dung phụ đề...";
                document.getElementById('subModal').style.display = "block";
                try {
                    const res = await fetch('/api/raw-sub/' + id);
                    document.getElementById('subPreviewText').innerText = await res.text();
                } catch(e) { document.getElementById('subPreviewText').innerText = "❌ Lỗi tải phụ đề."; }
            }
            function closeModal() { document.getElementById('subModal').style.display = "none"; }
            window.onclick = function(e) { if (e.target == document.getElementById('subModal')) closeModal(); }

            function actionUser(userId, action) {
                if(action === 'delete') {
                    if(confirm('Xóa vĩnh viễn user này không?')) window.location.href = '/admin/delete-user/' + userId;
                } else if (action === 'lock') {
                    const days = prompt('Nhập số ngày khóa (Nhập 0 để mở khóa):', '7');
                    if (days !== null) window.location.href = '/admin/lock-user/' + userId + '?days=' + days;
                }
            }

            function toggleManualInput() {
                const isManual = document.getElementById('manualMode').checked;
                document.getElementById('autoSearchGroup').style.display = isManual ? 'none' : 'block';
                document.getElementById('manualSearchGroup').style.display = isManual ? 'block' : 'none';
            }

            function startTranslation(type, id, encodedName, encodedPoster, btnElement) {
                if (btnElement) {
                    btnElement.innerText = '⏳ Đã thêm vào hàng chờ';
                    btnElement.style.background = '#6c757d';
                    btnElement.disabled = true;
                }
                
                fetch(\`/api/trigger-translate?type=\${type}&id=\${id}&name=\${encodedName}&poster=\${encodedPoster}\`)
                    .then(res => res.json())
                    .then(data => {
                        if (!data.success) {
                            alert('Lỗi: ' + data.message);
                            if (btnElement) {
                                btnElement.innerText = '🚀 Bắt Đầu Dịch Lại';
                                btnElement.style.background = '#007bff';
                                btnElement.disabled = false;
                            }
                        } else {
                            pollTaskStatus();
                        }
                    });
            }

            function pollTaskStatus() {
                document.getElementById('bgTaskWidget').style.display = 'block';
                if(checkTaskInterval) clearInterval(checkTaskInterval);
                
                checkTaskInterval = setInterval(async () => {
                    try {
                        const res = await fetch('/api/my-status');
                        const data = await res.json();
                        
                        if (data.current) {
                            const task = data.current;
                            let title = task.movieName;
                            if (data.waitingCount > 0) title += \` (+\${data.waitingCount} đang chờ)\`;
                            
                            document.getElementById('bgTaskName').innerText = title;
                            document.getElementById('bgTaskStatus').innerText = task.status;
                            document.getElementById('bgTaskBar').style.width = task.progress + '%';
                            
                            if (task.status.includes('Hoàn thành')) {
                                document.getElementById('bgTaskBar').style.background = '#28a745';
                                document.getElementById('bgTaskStatus').style.color = '#28a745';
                                document.getElementById('bgTaskCancel').style.display = 'none';
                                document.getElementById('bgTaskDownload').style.display = 'block';
                                document.getElementById('bgTaskDlBi').href = '/download/' + task.movieId + '?mode=bilingual';
                                document.getElementById('bgTaskDlVi').href = '/download/' + task.movieId + '?mode=vi';
                                document.getElementById('bgTaskClose').onclick = () => dismissTask(task.taskId);
                            } else if (task.status.includes('Lỗi')) {
                                document.getElementById('bgTaskBar').style.background = '#dc3545';
                                document.getElementById('bgTaskStatus').style.color = '#dc3545';
                                document.getElementById('bgTaskCancel').style.display = 'none';
                                document.getElementById('bgTaskDownload').style.display = 'none';
                                document.getElementById('bgTaskClose').onclick = () => dismissTask(task.taskId);
                            } else {
                                document.getElementById('bgTaskBar').style.background = '#007bff';
                                document.getElementById('bgTaskStatus').style.color = '#d35400';
                                document.getElementById('bgTaskCancel').style.display = 'block';
                                document.getElementById('bgTaskDownload').style.display = 'none';
                                document.getElementById('bgTaskCancel').onclick = () => cancelBgTask(task.taskId);
                                document.getElementById('bgTaskClose').onclick = () => hideWidget();
                            }
                        } else {
                            document.getElementById('bgTaskWidget').style.display = 'none';
                        }
                    } catch(e) {}
                }, 1500);
            }

            async function dismissTask(taskId) {
                await fetch('/api/dismiss-task?taskId=' + taskId);
                document.getElementById('bgTaskWidget').style.display = 'none';
                if (window.location.pathname.includes('/dashboard')) window.location.reload();
            }

            function hideWidget() { document.getElementById('bgTaskWidget').style.display = 'none'; }
            
            async function cancelBgTask(taskId) {
                if(confirm('Hủy tiến trình dịch của phim này?')) {
                    await fetch('/api/cancel-task?taskId=' + taskId);
                    document.getElementById('bgTaskStatus').innerText = '❌ Đã hủy';
                    document.getElementById('bgTaskStatus').style.color = '#dc3545';
                    document.getElementById('bgTaskBar').style.background = '#dc3545';
                    document.getElementById('bgTaskCancel').style.display = 'none';
                }
            }

            window.onload = () => { 
                if(localStorage.getItem('darkMode') === 'true') document.body.classList.add('dark'); 
                pollTaskStatus(); 
            }
        </script>
    </head>
    <body>
        <div class="container">
            <h2 style="text-align: center; color: #007bff; margin-bottom: 0;">☁️ KHO PHỤ ĐỀ AI ĐÁM MÂY</h2>
            <p style="text-align: center; font-size: 13px; margin-top: 5px;">Hệ thống Dịch Phim Độc Lập (Gemini / Groq)</p>
            
            <div class="user-bar">
                <span>👋 Xin chào, <b>${username ? username : 'Khách vãng lai'}</b> ${role === 'admin' ? '(👑 Admin)' : (role === 'user' ? '(👤 User)' : '')}</span>
                <div>
                    ${username ? `<a href="/dashboard">🏠 Trang chủ</a><a href="/logout">🚪 Đăng xuất</a>` : `<a href="/auth">🔑 Đăng nhập / Đăng ký</a>`}
                </div>
            </div>
            ${content}
        </div>

        <img src="https://media.tenor.com/FwO53Zl9Cq0AAAAi/herta-kuru-kuru-kururin.gif" style="position: fixed; bottom: 10px; right: 10px; width: 120px; z-index: 9999; pointer-events: none;">

        <div id="subModal" class="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 id="modalTitle" style="margin:0;">Xem trước phụ đề</h3>
                    <button class="close-btn" onclick="closeModal()">✕ Đóng</button>
                </div>
                <pre id="subPreviewText">Đang tải...</pre>
            </div>
        </div>

        <!-- WIDGET DỊCH NGẦM -->
        <div id="bgTaskWidget">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <b id="bgTaskName" style="font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 250px; color: #007bff;">Đang tải...</b>
                <button id="bgTaskClose" onclick="hideWidget()" style="background: none; border: none; font-size: 16px; cursor: pointer; color: var(--text); padding: 0;">✖</button>
            </div>
            <div style="background: var(--bg); border-radius: 10px; height: 8px; width: 100%; margin-bottom: 10px; overflow: hidden;">
                <div id="bgTaskBar" style="background: #28a745; height: 100%; width: 0%; transition: 0.5s;"></div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span id="bgTaskStatus" style="font-size: 12px; font-weight: bold; color: #d35400;">Đang kết nối...</span>
                <button id="bgTaskCancel" class="btn-del" style="padding: 4px 8px; font-size: 11px;">🛑 Hủy</button>
            </div>
            <div id="bgTaskDownload" style="display: none; margin-top: 10px; text-align: center;">
                <a id="bgTaskDlBi" href="#" class="btn-dl" style="font-size: 11px; padding: 6px 10px;">📥 Song Ngữ</a>
                <a id="bgTaskDlVi" href="#" class="btn-dl" style="font-size: 11px; padding: 6px 10px; background: #17a2b8;">📥 Thuần Việt</a>
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
            </div>
        </div>
    `));
});

app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    const userRef = doc(db, "users", username);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
        return res.send(renderHTML(`
            <div class="card" style="text-align: center; border-top: 4px solid #dc3545; max-width: 400px; margin: 40px auto;">
                <h3 style="color: #dc3545;">❌ Lỗi Đăng Ký</h3><p>Tài khoản <b>${username}</b> đã tồn tại trên hệ thống.</p>
                <button onclick="history.back()" class="main-btn" style="width: auto; padding: 10px 20px;">⬅ Quay Lại</button>
            </div>
        `));
    }
    
    const usersSnapshot = await getDocs(collection(db, "users"));
    await setDoc(userRef, { 
        passwordHash: hashPwd(password), role: usersSnapshot.empty ? 'admin' : 'user', 
        geminiKey: '', groqKey: '', geminiModel: 'gemini-2.5-flash', translationMode: 'gemini', // Mặc định là Gemini 
        createdAt: new Date().toISOString(), bannedUntil: null 
    });
    res.cookie('username', username, { maxAge: 30 * 24 * 60 * 60 * 1000 });
    res.redirect('/dashboard');
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const userSnap = await getDoc(doc(db, "users", username));
    
    if (!userSnap.exists() || userSnap.data().passwordHash !== hashPwd(password)) {
        return res.send(renderHTML(`
            <div class="card" style="text-align: center; border-top: 4px solid #dc3545; max-width: 400px; margin: 40px auto;">
                <h3 style="color: #dc3545;">❌ Đăng Nhập Thất Bại</h3><p>Sai tên đăng nhập hoặc mật khẩu!</p>
                <button onclick="history.back()" class="main-btn" style="width: auto; padding: 10px 20px;">⬅ Thử Lại</button>
            </div>
        `));
    }

    const userData = userSnap.data();
    if (userData.bannedUntil && new Date(userData.bannedUntil) > new Date()) {
        const lockTime = new Date(userData.bannedUntil).toLocaleString('vi-VN');
        return res.send(renderHTML(`
            <div class="card" style="text-align: center; border-top: 4px solid #dc3545; max-width: 400px; margin: 40px auto;">
                <h3 style="color: #dc3545;">🔒 Tài Khoản Bị Khóa</h3><p>Tài khoản của bạn đã bị khóa đến ngày: <br><b style="font-size: 18px;">${lockTime}</b></p>
                <button onclick="history.back()" class="main-btn" style="width: auto; padding: 10px 20px;">⬅ Quay Lại</button>
            </div>
        `));
    }

    res.cookie('username', username, { maxAge: 30 * 24 * 60 * 60 * 1000 });
    res.redirect('/dashboard');
});

app.get('/logout', (req, res) => { res.clearCookie('username'); res.redirect('/'); });

// ==========================================
// 4. TRANG CHỦ & KHO PHỤ ĐỀ 
// ==========================================
app.get('/', (req, res) => res.redirect('/dashboard'));

app.get('/dashboard', async (req, res) => {
    const username = getLoggedInUser(req);
    let role = 'guest', userData = {};
    
    if (username) {
        const userSnap = await getDoc(doc(db, "users", username));
        if (userSnap.exists()) {
            userData = userSnap.data(); role = userData.role;
        }
    }

    const subsSnapshot = await getDocs(collection(db, "shared_subs"));
    const allSubs = []; const leaderBoardData = {};

    subsSnapshot.forEach(docSnap => {
        const data = docSnap.data();
        allSubs.push({ id: docSnap.id, ...data });
        leaderBoardData[data.translatedBy] = (leaderBoardData[data.translatedBy] || 0) + 1;
    });

    const groupedSubs = {};
    allSubs.forEach(sub => {
        let baseName = sub.movieName.replace(/\s*\((Mùa|Season|Tập|Ep|\d{4}).*?\)/i, '').trim();
        if (!groupedSubs[baseName]) groupedSubs[baseName] = [];
        groupedSubs[baseName].push(sub);
    });

    let dbHtml = '';
    if (allSubs.length === 0) {
        dbHtml = '<p style="text-align:center;">Kho trống.</p>';
    } else {
        const sortedGroupNames = Object.keys(groupedSubs).sort((a, b) => a.localeCompare(b));
        let groupIndex = 0;
        for (const baseName of sortedGroupNames) {
            const group = groupedSubs[baseName];
            group.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            dbHtml += `
                <div class="sub-group">
                    <h4 class="sub-group-title" onclick="toggleGroup(${groupIndex})">
                        <span>📁 ${baseName} <span style="font-size:12px; color:#666;">(${group.length} mục)</span></span>
                        <span id="icon-${groupIndex}">▼</span>
                    </h4>
                    <ul class="db-list" id="group-${groupIndex}">`;
            group.forEach(sub => {
                const posterUrl = sub.poster || 'https://placehold.co/60x90/2c3e50/FFF?text=No+Poster';
                dbHtml += `
                    <li class="db-item">
                        <div style="display: flex; align-items: center;">
                            <img src="${posterUrl}" onerror="this.onerror=null; this.src='https://placehold.co/60x90/2c3e50/FFF?text=No+Poster';" alt="Poster">
                            <div>
                                <b style="font-size: 15px;">${sub.movieName}</b><br>
                                <span style="font-size: 12px; color: #888;">⏱️ ${new Date(sub.createdAt).toLocaleDateString()} | 👤 ${sub.translatedBy}</span>
                            </div>
                        </div>
                        <div style="display:flex; flex-wrap: wrap; gap: 5px; justify-content: flex-end;">
                            <button onclick="previewSub('${sub.id}', '${sub.movieName}')" class="btn-preview">📄 Xem</button>
                            <a href="/download/${sub.id}?mode=bilingual" class="btn-dl">📥 Song Ngữ</a>
                            <a href="/download/${sub.id}?mode=vi" class="btn-dl" style="background:#17a2b8;">📥 Thuần Việt</a>
                            ${(role === 'admin' || sub.translatedBy === username) ? `<a href="/delete-sub/${sub.id}" class="btn-del" onclick="return confirm('Xóa?')">🗑️</a>` : ''}
                        </div>
                    </li>`;
            });
            dbHtml += `</ul></div>`;
            groupIndex++;
        }
    }

    const sortedLeaders = Object.entries(leaderBoardData).sort((a,b) => b[1] - a[1]).slice(0, 5);
    let leaderHtml = sortedLeaders.length ? sortedLeaders.map((l, i) => `
        <div class="leaderboard-item">
            <span>${i===0?'🏆':i===1?'🥈':i===2?'🥉':'🏅'} <b>${l[0]}</b></span>
            <span style="color:#28a745; font-weight:bold;">${l[1]} phim</span>
        </div>
    `).join('') : '<p style="font-size:13px;">Chưa có dữ liệu</p>';

    let adminHtml = '';
    if (role === 'admin') {
        const usersSnap = await getDocs(collection(db, "users"));
        adminHtml += `<table><tr><th>Username</th><th>Phân quyền</th><th>Trạng thái</th><th>Hành động</th></tr>`;
        usersSnap.forEach(u => {
            const ud = u.data();
            let statusHtml = '<span style="color:green">Hoạt động</span>';
            if (ud.bannedUntil && new Date(ud.bannedUntil) > new Date()) statusHtml = `<span style="color:red">Bị khóa đến ${new Date(ud.bannedUntil).toLocaleDateString('vi-VN')}</span>`;
            adminHtml += `<tr>
                <td><b>${u.id}</b></td>
                <td>${ud.role === 'admin' ? '👑 Admin' : '👤 User'}</td>
                <td>${statusHtml}</td>
                <td>${u.id !== username ? `<button onclick="actionUser('${u.id}', 'lock')" class="btn-edit">Khóa</button><button onclick="actionUser('${u.id}', 'delete')" class="btn-del">Xóa</button>` : '<i>(Bạn)</i>'}</td>
            </tr>`;
        });
        adminHtml += `</table>`;
    }

    res.send(renderHTML(`
        <div class="card" style="border-top: 4px solid #f39c12; margin-bottom: 20px;">
            <h3 style="margin-top:0;">🏆 BẢNG VÀNG CỐNG HIẾN</h3>
            ${leaderHtml}
        </div>

        <div class="tab-nav">
            <button class="tab-btn active" onclick="openTab('tab-storage', this)">☁️ Kho Phụ Đề</button>
            ${role !== 'guest' ? `
                <button class="tab-btn" onclick="openTab('tab-search', this)">🔍 Tìm & Dịch Phim</button>
                <button class="tab-btn" onclick="openTab('tab-upload', this)">📤 Dịch File Thủ Công</button>
                <button class="tab-btn" onclick="openTab('tab-api', this)">⚙️ Cấu hình Nền Tảng Dịch</button>
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
                        <button type="submit" class="main-btn">🔍 Bắt Đầu Quét</button>
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
                        <button type="submit" class="main-btn" style="background: #6c757d;">🔍 Truy Xuất ID Này</button>
                    </form>
                </div>
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
                <h3 style="margin-top: 0; color: #17a2b8;">⚙️ CẤU HÌNH API ĐỘC LẬP</h3>
                <p style="font-size: 13px; color: #666; margin-bottom: 20px;">Lựa chọn nền tảng bạn muốn sử dụng để dịch. Các API sẽ hoạt động hoàn toàn độc lập, không gộp luồng.</p>
                <form action="/save-api" method="POST">
                    <label style="font-weight: bold; font-size: 14px;">1. Chọn Bộ Máy Dịch Chính:</label>
                    <select name="translationMode">
                        <option value="gemini" ${(userData.translationMode === 'gemini' || !userData.translationMode) ? 'selected' : ''}>🧠 Dùng Google Gemini (Khuyên dùng - Ổn định nhất)</option>
                        <option value="groq" ${userData.translationMode === 'groq' ? 'selected' : ''}>🚀 Dùng Groq Llama (Tốc độ siêu nhanh)</option>
                    </select>

                    <label style="font-weight: bold; font-size: 14px; margin-top: 15px;">2. API Key (Groq):</label>
                    <input type="text" name="groqKey" value="${userData.groqKey || ''}" placeholder="Nhập Key Groq (gsk_...)">
                    
                    <label style="font-weight: bold; font-size: 14px; margin-top: 15px;">3. API Key (Google Gemini):</label>
                    <input type="text" name="geminiKey" value="${userData.geminiKey || ''}" placeholder="Nhập Key Gemini (AIza...)">
                    
                    <label style="font-weight: bold; font-size: 14px;">Phiên bản Gemini Model (Nếu chọn dùng Gemini):</label>
                    <select name="geminiModel">
                        <option value="gemini-2.5-flash" ${userData.geminiModel === 'gemini-2.5-flash' ? 'selected' : ''}>Gemini 2.5 Flash</option>
                        <option value="gemini-1.5-flash" ${userData.geminiModel === 'gemini-1.5-flash' ? 'selected' : ''}>Gemini 1.5 Flash</option>
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
// 5. CÁC ROUTE API CƠ BẢN
// ==========================================
app.post('/save-api', async (req, res) => {
    const username = getLoggedInUser(req);
    if (username) await setDoc(doc(db, "users", username), { 
        groqKey: req.body.groqKey, geminiKey: req.body.geminiKey, 
        geminiModel: req.body.geminiModel, translationMode: req.body.translationMode
    }, { merge: true });
    res.redirect('/dashboard');
});

app.get('/admin/delete-user/:id', async (req, res) => {
    const username = getLoggedInUser(req);
    const userSnap = await getDoc(doc(db, "users", username));
    if (userSnap.exists() && userSnap.data().role === 'admin') await deleteDoc(doc(db, "users", req.params.id));
    res.redirect('/dashboard');
});

app.get('/admin/lock-user/:id', async (req, res) => {
    const username = getLoggedInUser(req);
    const userSnap = await getDoc(doc(db, "users", username));
    if (userSnap.exists() && userSnap.data().role === 'admin') {
        const days = parseInt(req.query.days);
        const targetRef = doc(db, "users", req.params.id);
        if (days > 0) {
            const banDate = new Date(); banDate.setDate(banDate.getDate() + days);
            await setDoc(targetRef, { bannedUntil: banDate.toISOString() }, { merge: true });
        } else await setDoc(targetRef, { bannedUntil: null }, { merge: true });
    }
    res.redirect('/dashboard');
});

app.get('/api/raw-sub/:id', async (req, res) => {
    const subSnap = await getDoc(doc(db, "shared_subs", req.params.id));
    if (!subSnap.exists()) return res.send("Không tìm thấy dữ liệu phụ đề.");
    res.send(subSnap.data().vttContent);
});

app.get('/download/:id', async (req, res) => {
    const { id } = req.params; const { mode } = req.query;
    const subSnap = await getDoc(doc(db, "shared_subs", id));
    if (!subSnap.exists()) return res.send("File không tồn tại.");
    const data = subSnap.data();
    const safeName = formatFilename(data.movieName);
    const filename = `${safeName}_${mode === 'vi' ? 'VI' : 'Bilingual'}_CloudAI.vtt`;
    
    let content = data.vttContent;
    if (mode === 'vi') content = content.replace(/^([^\n]+)\n(<font color='#f1c40f'>.*?<\/font>)$/gm, '$2');

    res.setHeader('Content-Type', 'application/octet-stream');
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

// TÌM KIẾM
app.get('/search', async (req, res) => {
    const username = getLoggedInUser(req);
    if (!username) return res.redirect('/');
    const { query, type, season, episode } = req.query;
    let searchUrl = query.startsWith('tt') ? `https://v3-cinemeta.strem.io/meta/${type}/${query}.json` : `https://v3-cinemeta.strem.io/catalog/${type}/top/search=${encodeURIComponent(query)}.json`;

    const searchFormHTML = `
        <div class="card" style="border-left: 4px solid #007bff; margin-bottom: 20px;">
            <h3 style="margin-top: 0;">🎬 TÌM KIẾM TIẾP TỤC</h3>
            <form action="/search" method="GET">
                <input type="text" name="query" value="${query}" placeholder="Tên phim..." required>
                <select name="type" onchange="handleTypeChange(this, 'autoSeasonGroup2')">
                    <option value="movie" ${type==='movie'?'selected':''}>Phim lẻ (Movie)</option>
                    <option value="series" ${type==='series'?'selected':''}>Phim bộ (Series)</option>
                </select>
                <div id="autoSeasonGroup2" class="grid-2" style="display: ${type==='series'?'grid':'none'};">
                    <input type="number" name="season" value="${season||''}" placeholder="Mùa (VD: 1)" min="1">
                    <input type="number" name="episode" value="${episode||''}" placeholder="Tập (VD: 2)" min="1">
                </div>
                <button type="submit" class="main-btn">🔍 Tìm Kiếm Ngay</button>
            </form>
        </div>
    `;

    try {
        const response = await axios.get(searchUrl, axiosConfig);
        const metas = query.startsWith('tt') ? [response.data.meta] : response.data.metas;
        
        if (!metas || metas.length === 0 || !metas[0]) return res.send(renderHTML(searchFormHTML + `
            <div class="card" style="text-align: center; border-top: 4px solid #ffc107;">
                <h3>❌ Không tìm thấy phim</h3>
            </div><button onclick="history.back()" class="btn-del" style="background:#6c757d; padding:10px 20px;">⬅ Trở Về</button>
        `, username, 'user'));
        
        let resultsHTML = `<h3>Kết quả tìm kiếm cho "${query}":</h3>`;
        for (const meta of metas) {
            let fullId = meta.imdb_id || meta.id;
            let displayName = `${meta.name} (${meta.releaseInfo || meta.year || ''})`;
            if (type === 'series' && season && episode) {
                fullId = `${fullId}:${season}:${episode}`;
                displayName = `${meta.name} (Mùa ${season} Tập ${episode})`;
            }
            const posterImg = meta.poster || 'https://placehold.co/60x90/2c3e50/FFF?text=No+Poster';
            const subSnap = await getDoc(doc(db, "shared_subs", fullId));
            
            if (subSnap.exists()) {
                resultsHTML += `<div class="card" style="display:flex; align-items:center;"><img src="${posterImg}" onerror="this.onerror=null; this.src='https://placehold.co/60x90/2c3e50/FFF?text=No+Poster';" style="width:60px;height:90px;object-fit:cover;border-radius:4px;margin-right:15px;"><div style="flex-grow:1;"><b>${displayName}</b><br><span style="color:green;font-size:13px;">⚡ Đã có trong Kho!</span></div><a href="/download/${fullId}?mode=bilingual" class="btn-dl">📥 Tải Song Ngữ</a></div>`;
            } else {
                resultsHTML += `<div class="card" style="display:flex; align-items:center;"><img src="${posterImg}" onerror="this.onerror=null; this.src='https://placehold.co/60x90/2c3e50/FFF?text=No+Poster';" style="width:60px;height:90px;object-fit:cover;border-radius:4px;margin-right:15px;"><div style="flex-grow:1;"><b>${displayName}</b><br><span style="color:orange;font-size:13px;">☁️ Cần dịch AI</span></div><button onclick="startTranslation('${type}', '${fullId}', '${encodeURIComponent(displayName)}', '${encodeURIComponent(posterImg)}', this)" class="btn-dl" style="background:#007bff; width:auto; border:none; padding:10px 15px;">🚀 Bắt Đầu Dịch</button></div>`;
            }
        }
        res.send(renderHTML(searchFormHTML + resultsHTML + `<br><button onclick="history.back()" class="btn-del" style="background:#6c757d; padding:10px 20px;">⬅ Trở Về</button>`, username, 'user'));
    } catch (e) { res.send(renderHTML(searchFormHTML + `<h3>Lỗi: ${e.message}</h3><br><button onclick="history.back()" class="btn-del" style="background:#6c757d; padding:10px 20px;">⬅ Trở Về</button>`, username, 'user')); }
});

app.post('/upload-translate', upload.single('subFile'), async (req, res) => {
    const username = getLoggedInUser(req);
    if (!username || !req.file) return res.redirect('/dashboard');
    fs.readFile(req.file.path, 'utf8', async (err, data) => {
        fs.unlinkSync(req.file.path);
        const userSnap = await getDoc(doc(db, "users", username));
        if (!userSnap.data().geminiKey && !userSnap.data().groqKey) return res.send("<script>alert('❌ Lỗi: Bạn chưa cài đặt API Key nào!'); history.back();</script>");
        
        const customId = `upload-${Date.now()}`;
        const taskId = `${customId}-task`;
        activeTasks[taskId] = { status: 'Đang xếp hàng chờ...', progress: 0, movieName: req.body.movieName, movieId: customId, isCancelled: false, username: username, isDismissed: false };
        
        translationQueue.push({ taskId, type: 'manual', id: customId, name: req.body.movieName, username, uData: userSnap.data(), rawSubData: data, posterUrl: '' });
        processTranslationQueue();
        
        res.send(`<script>window.location.href='/dashboard';</script>`);
    });
});

// ==========================================
// 6. TIẾN ĐỘ NỀN & CHẠY DỊCH ĐỘC LẬP
// ==========================================
app.get('/api/trigger-translate', async (req, res) => {
    const username = getLoggedInUser(req);
    if (!username) return res.json({ success: false, message: "Hết phiên đăng nhập!" });
    
    const { type, id, name, poster } = req.query; 
    const userSnap = await getDoc(doc(db, "users", username));
    const uData = userSnap.data();

    // Check API Key tùy theo mode
    const mode = uData.translationMode || 'gemini';
    if (mode === 'gemini' && !uData.geminiKey) return res.json({ success: false, message: "Bạn chưa nhập Key Gemini!" });
    if (mode === 'groq' && !uData.groqKey) return res.json({ success: false, message: "Bạn chưa nhập Key Groq!" });
    
    const taskId = `${id}-${Date.now()}`;
    activeTasks[taskId] = { status: 'Đang xếp hàng chờ...', progress: 0, movieName: decodeURIComponent(name), movieId: id, isCancelled: false, username: username, isDismissed: false };
    
    translationQueue.push({ taskId, type, id, name: decodeURIComponent(name), username, uData, rawSubData: null, posterUrl: decodeURIComponent(poster) });
    processTranslationQueue(); 
    
    res.json({ success: true, taskId });
});

async function processTranslationQueue() {
    if (isProcessingQueue || translationQueue.length === 0) return;
    isProcessingQueue = true;
    
    const task = translationQueue.shift(); 
    if (activeTasks[task.taskId] && activeTasks[task.taskId].isCancelled) {
        isProcessingQueue = false;
        processTranslationQueue();
        return;
    }

    await runTranslation(task.taskId, task.type, task.id, task.name, task.username, task.uData, task.rawSubData, task.posterUrl);
    
    isProcessingQueue = false;
    processTranslationQueue(); 
}

app.get('/api/my-status', (req, res) => {
    const username = getLoggedInUser(req);
    if (!username) return res.json({ current: null, waitingCount: 0 });

    let myTasks = [];
    for (let tid in activeTasks) {
        if (activeTasks[tid].username === username && !activeTasks[tid].isDismissed) {
            myTasks.push({ taskId: tid, ...activeTasks[tid] });
        }
    }

    let current = myTasks.find(t => t.status !== 'Đang xếp hàng chờ...' && !t.status.includes('Hoàn thành') && !t.status.includes('Lỗi') && !t.isCancelled);
    if (!current) current = myTasks.find(t => t.status === 'Đang xếp hàng chờ...');
    if (!current) current = myTasks.find(t => (t.status.includes('Hoàn thành') || t.status.includes('Lỗi')) && !t.isCancelled);

    const waitingCount = myTasks.filter(t => t.status === 'Đang xếp hàng chờ...').length;
    res.json({ current, waitingCount });
});

app.get('/api/cancel-task', (req, res) => {
    if (activeTasks[req.query.taskId]) {
        activeTasks[req.query.taskId].isCancelled = true;
        activeTasks[req.query.taskId].isDismissed = true;
    }
    res.json({ success: true });
});

app.get('/api/dismiss-task', (req, res) => {
    if (activeTasks[req.query.taskId]) activeTasks[req.query.taskId].isDismissed = true;
    res.json({ success: true });
});

// HÀM DỊCH GROQ (Độc Lập)
async function translateWithGroq(chunkObj, groqKey) {
    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
        model: "llama-3.3-70b-versatile",
        response_format: { type: "json_object" }, 
        messages: [
            { role: "system", content: "Bạn là biên dịch viên phim chuyên nghiệp. Dịch các value trong JSON object sau sang tiếng Việt đời thường. Giữ nguyên toàn bộ key. Output phải là một cấu trúc JSON hợp lệ duy nhất." },
            { role: "user", content: JSON.stringify(chunkObj) }
        ]
    }, { headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' }});
    
    let text = response.data.choices[0].message.content.replace(/```json/g, '').replace(/```/g, '').trim();
    const arrayMatch = text.match(/\{[\s\S]*\}/);
    if (arrayMatch) text = arrayMatch[0];
    return JSON.parse(text);
}

// HÀM DỊCH GEMINI (Khôi phục nguyên bản V5 Ổn định)
async function translateWithGemini(chunkObj, geminiKey, geminiModel) {
    const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`, { 
        contents: [{ parts: [{ text: `Dịch mảng JSON sau sang tiếng Việt đời thường. TRẢ VỀ ĐÚNG CẤU TRÚC JSON.\n${JSON.stringify(chunkObj)}` }] }] 
    });
    let text = response.data.candidates[0].content.parts[0].text.replace(/```json/g, '').replace(/```/g, '').trim();
    const arrayMatch = text.match(/\{[\s\S]*\}/);
    if (arrayMatch) text = arrayMatch[0];
    return JSON.parse(text);
}

// HÀM CHÍNH (LOẠI BỎ GỘP CHUNG - CHẠY THEO CHẾ ĐỘ ĐÃ CHỌN)
async function runTranslation(taskId, type, id, movieName, username, uData, rawSubData = null, posterUrl = '') {
    const updateTask = (status, progress) => { if (activeTasks[taskId] && !activeTasks[taskId].isCancelled) { activeTasks[taskId].status = status; activeTasks[taskId].progress = progress; } };
    try {
        let subContent = "";
        if (rawSubData) { updateTask('Đang phân tích file...', 5); subContent = rawSubData; } 
        else {
            updateTask('Đang tải sub gốc...', 5);
            const osResponse = await axios.get(`https://opensubtitles-v3.strem.io/subtitles/${type}/${id}.json`, axiosConfig);
            const engSubs = (osResponse.data.subtitles || []).filter(sub => sub.lang === 'eng' || sub.lang === 'en');
            if (engSubs.length === 0) return updateTask('❌ Lỗi: Phim này chưa có file Sub Tiếng Anh trên hệ thống API.', 0);
            const subResponse = await axios.get(engSubs[0].url, axiosConfig);
            subContent = subResponse.data;
        }

        // BẢN VÁ FIX LỖI FILE SRT BỊ HỎNG
        let normalizedContent = subContent.replace(/\r\n/g, '\n');
        const blocks = normalizedContent.trim().split(/\n{2,}/);
        const parsedBlocks = [], originalTexts = [];
        
        blocks.forEach(block => {
            const lines = block.split('\n');
            const tsIdx = lines.findIndex(l => l.includes('-->')); 
            if (tsIdx !== -1) { 
                let meta = lines.slice(0, tsIdx + 1).join('\n').replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
                let text = lines.slice(tsIdx + 1).join('\n');
                parsedBlocks.push({ isMeta: false, meta: meta, text: text }); 
                originalTexts.push(text.replace(/\n/g, ' ')); 
            } 
            else parsedBlocks.push({ isMeta: true, raw: block });
        });

        // KHÔI PHỤC CÔNG THỨC VÀNG CỦA BẢN CŨ: 100 Câu / Lần gửi
        const chunkSize = 100; 
        const translatedTexts = [];
        const mode = uData.translationMode || 'gemini'; 
        
        for (let i = 0; i < originalTexts.length; i += chunkSize) {
            if (activeTasks[taskId].isCancelled) return; 
            const chunk = originalTexts.slice(i, i + chunkSize);
            let chunkObj = {}; chunk.forEach((text, idx) => chunkObj[idx] = text);
            
            let success = false, retries = 0;
            let curProgress = Math.floor(10 + (i / originalTexts.length) * 80);

            while (!success && retries < 3) {
                if (activeTasks[taskId].isCancelled) return;
                try {
                    let parsedData;
                    if (mode === 'groq') {
                        updateTask(`Đang dịch thoại ${Math.min(i + chunkSize, originalTexts.length)}/${originalTexts.length} (⚡ Groq)...`, curProgress);
                        parsedData = await translateWithGroq(chunkObj, uData.groqKey);
                    } else {
                        updateTask(`Đang dịch thoại ${Math.min(i + chunkSize, originalTexts.length)}/${originalTexts.length} (🧠 Gemini)...`, curProgress);
                        parsedData = await translateWithGemini(chunkObj, uData.geminiKey, uData.geminiModel);
                    }
                    
                    for (let j = 0; j < chunk.length; j++) translatedTexts.push(parsedData[j] || chunk[j]);
                    success = true;

                } catch (err) {
                    retries++;
                    if (retries >= 3) { 
                        translatedTexts.push(...chunk); 
                    } else {
                        let waitTime = 25000; 
                        if (mode === 'groq') waitTime = 5000; 

                        const match = (err.response?.data?.error?.message || '').match(/retry in (\d+(\.\d+)?)s/);
                        if (match) waitTime = (parseFloat(match[1]) + 2) * 1000;
                        
                        updateTask(`API bận. Đợi ${Math.ceil(waitTime/1000)}s...`, curProgress);
                        await new Promise(r => setTimeout(r, waitTime));
                    }
                }
            }
            // KHÔI PHỤC ĐỘ TRỄ ỔN ĐỊNH: Đủ thời gian cho API Gemini hồi sức
            if (mode === 'gemini') await new Promise(r => setTimeout(r, 6000)); 
            else await new Promise(r => setTimeout(r, 1000)); 
        }

        if (activeTasks[taskId].isCancelled) return;
        updateTask('Đang lưu lên Firebase...', 95);
        
        let finalVttContent = "WEBVTT\n\n"; 
        let textIndex = 0;
        parsedBlocks.forEach(block => {
            if (block.isMeta) {
                if (!block.raw.includes("WEBVTT")) finalVttContent += block.raw + "\n\n";
            }
            else { 
                finalVttContent += block.meta + "\n" + block.text + "\n<font color='#f1c40f'>" + (translatedTexts[textIndex] || block.text) + "</font>\n\n"; 
                textIndex++; 
            }
        });

        await setDoc(doc(db, "shared_subs", id), { 
            movieName: movieName, vttContent: finalVttContent, translatedBy: username, poster: posterUrl || '', createdAt: new Date().toISOString() 
        });
        updateTask('Hoàn thành 🎉', 100);
    } catch (err) { if (!activeTasks[taskId].isCancelled) updateTask(`❌ Lỗi: ${err.message}`, 0); }
}

app.listen(PORT, () => { console.log(`🚀 KHO PHỤ ĐỀ AI (V9.0 CLASSIC STABLE - ĐỘC LẬP API) CHẠY TẠI CỔNG 7000`); });
