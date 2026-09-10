/* ============================================================
   課表查詢系統 - 主邏輯腳本 (script.js)
   民雄國中
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
    // 1. 初始化頁面，載入瀏覽次數
    fetchViewsCount();

    // 2. 註冊登入按鈕事件
    const loginBtn = document.getElementById("loginBtn");
    if (loginBtn) {
        loginBtn.addEventListener("click", handleLogin);
    }

    // 3. 註冊 Tab 標籤切換
    const tabBtns = document.querySelectorAll(".tab-btn");
    tabBtns.forEach(btn => {
        btn.addEventListener("click", (e) => switchTab(e.target.dataset.tab));
    });

    // 4. 註冊 Modal 關閉事件
    const closeModalBtn = document.getElementById("closeModalBtn");
    if (closeModalBtn) {
        closeModalBtn.addEventListener("click", closeModal);
    }

    // 5. 返回與列印按鈕
    const backBtn = document.getElementById("backBtn");
    if (backBtn) {
        backBtn.addEventListener("click", showQueryView);
    }

    const printBtn = document.getElementById("printBtn");
    if (printBtn) {
        printBtn.addEventListener("click", () => window.print());
    }
});

/**
 * 從後端/API 取得當月與累計瀏覽次數並顯示
 */
async function fetchViewsCount() {
    const monthlyEl = document.getElementById("monthlyViews");
    const totalEl = document.getElementById("totalViews");

    try {
        /* 
           💡 實際串接時，解開下方註解並填入你的 API URL (如 Google Apps Script):
           
           const response = await fetch("https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec?action=getViews");
           const data = await response.json();
        */

        // 模擬伺服器傳回的點閱數據
        const data = {
            monthlyViews: 1280,
            totalViews: 45200
        };

        // 填入數值並加上千分位逗號
        if (monthlyEl) monthlyEl.textContent = Number(data.monthlyViews).toLocaleString();
        if (totalEl) totalEl.textContent = Number(data.totalViews).toLocaleString();

    } catch (error) {
        console.error("無法取得瀏覽次數:", error);
        if (monthlyEl) monthlyEl.textContent = "0";
        if (totalEl) totalEl.textContent = "0";
    }
}

/**
 * 處理登入動作
 */
function handleLogin() {
    const semester = document.getElementById("semesterSelect").value;
    const loginError = document.getElementById("loginError");

    if (!semester) {
        if (loginError) loginError.textContent = "請選擇學期！";
        return;
    }

    showLoading(true);

    // 模擬驗證並切換至查詢頁
    setTimeout(() => {
        showLoading(false);
        const badge = document.getElementById("currentSemesterBadge");
        if (badge) badge.textContent = semester;

        switchView("queryView");
    }, 500);
}

/**
 * 切換頁面視圖 (loginView, queryView, resultView)
 */
function switchView(viewId) {
    const views = ["loginView", "queryView", "resultView"];
    views.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (id === viewId) {
                el.classList.add("active");
                if (id === "resultView") el.classList.add("result-active");
            } else {
                el.classList.remove("active", "result-active");
            }
        }
    });
}

function showQueryView() {
    switchView("queryView");
}

/**
 * 切換查詢頁 Tab (班級/教師)
 */
function switchTab(tabType) {
    const classTab = document.getElementById("classTab");
    const teacherTab = document.getElementById("teacherTab");
    const tabBtns = document.querySelectorAll(".tab-btn");

    tabBtns.forEach(btn => {
        if (btn.dataset.tab === tabType) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });

    if (tabType === "class") {
        if (classTab) classTab.classList.remove("hidden");
        if (teacherTab) teacherTab.classList.add("hidden");
    } else {
        if (classTab) classTab.classList.add("hidden");
        if (teacherTab) teacherTab.classList.remove("hidden");
    }
}

/**
 * 顯示/隱藏 Loading 載入遮罩
 */
function showLoading(show) {
    const overlay = document.getElementById("loadingOverlay");
    if (overlay) {
        if (show) overlay.classList.add("show");
        else overlay.classList.remove("show");
    }
}

/**
 * 關閉 Modal
 */
function closeModal() {
    const modal = document.getElementById("substituteModal");
    if (modal) modal.classList.remove("show");
}