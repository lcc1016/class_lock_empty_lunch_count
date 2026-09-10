/* ============================================================
   課表查詢系統 - 主邏輯腳本 (script.js)
   民雄國中
   ============================================================ */

// 頁面載入完成後自動執行
window.addEventListener("DOMContentLoaded", () => {
    fetchViewsCount();
});

/**
 * 處理登入點擊動作
 */
function handleLogin() {
    console.log("進入系統按鈕被點擊");

    const semesterSelect = document.getElementById("semesterSelect");
    const loginError = document.getElementById("loginError");
    const semester = semesterSelect ? semesterSelect.value : "";

    if (!semester) {
        if (loginError) loginError.textContent = "請選擇學期！";
        return;
    }

    if (loginError) loginError.textContent = "";

    // 顯示載入動畫並切換視圖
    showLoading(true);

    setTimeout(() => {
        showLoading(false);
        
        // 更新當前學期標籤
        const badge = document.getElementById("currentSemesterBadge");
        if (badge) badge.textContent = semester;

        // 強制切換畫面至查詢頁
        switchView("queryView");
    }, 300);
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
 * 取得當月與累計瀏覽次數
 */
async function fetchViewsCount() {
    const monthlyEl = document.getElementById("monthlyViews");
    const totalEl = document.getElementById("totalViews");

    try {
        // 模擬數據，若沒傳回數據自動預設為 0
        const data = {
            monthlyViews: 1280,
            totalViews: 45200
        };

        if (monthlyEl) monthlyEl.textContent = Number(data.monthlyViews || 0).toLocaleString();
        if (totalEl) totalEl.textContent = Number(data.totalViews || 0).toLocaleString();

    } catch (error) {
        console.error("無法取得瀏覽次數:", error);
        if (monthlyEl) monthlyEl.textContent = "0";
        if (totalEl) totalEl.textContent = "0";
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