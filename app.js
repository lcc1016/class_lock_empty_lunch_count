/* ============================================================
   課表查詢系統 - 主邏輯腳本 (script.js)
   整合 homerooms_11501.json 資料讀取與課表動態渲染
   ============================================================ */

// 全域資料儲存
let scheduleData = null;

// 頁面載入完成後初始化數據
window.addEventListener("DOMContentLoaded", () => {
    fetchViewsCount();
});

/**
 * 登入系統並載入 homerooms_11501.json
 */
async function handleLogin() {
    const semesterSelect = document.getElementById("semesterSelect");
    const loginError = document.getElementById("loginError");
    const semester = semesterSelect ? semesterSelect.value : "";

    if (!semester) {
        if (loginError) loginError.textContent = "請選擇學期！";
        return;
    }

    if (loginError) loginError.textContent = "";
    showLoading(true);

    try {
        // 讀取課表 JSON 檔 (請確保 homerooms_11501.json 放置在專案根目錄)
        const response = await fetch("homerooms_11501.json");
        if (!response.ok) {
            throw new Error(`無法載入課表資料檔 (HTTP ${response.status})`);
        }
        
        scheduleData = await response.json();

        // 初始化選單
        populateClassDropdowns();
        populateTeacherDropdown();

        // 切換介面
        const badge = document.getElementById("currentSemesterBadge");
        if (badge) badge.textContent = semester;

        switchView("queryView");
    } catch (error) {
        console.error("載入失敗:", error);
        if (loginError) loginError.textContent = "載入 homerooms_11501.json 失敗，請確認檔案位置！";
    } finally {
        showLoading(false);
    }
}

/**
 * 動態填入班級下拉選單
 */
function populateClassDropdowns() {
    if (!scheduleData) return;

    const g7 = document.getElementById("grade7Select");
    const g8 = document.getElementById("grade8Select");
    const g9 = document.getElementById("grade9Select");
    const gSpec = document.getElementById("gradeSpecSelect");

    // 重置
    if (g7) g7.innerHTML = '<option value="">請選擇班級</option>';
    if (g8) g8.innerHTML = '<option value="">請選擇班級</option>';
    if (g9) g9.innerHTML = '<option value="">請選擇班級</option>';
    if (gSpec) gSpec.innerHTML = '<option value="">請選擇班級</option>';

    const keys = Object.keys(scheduleData);
    keys.sort().forEach(className => {
        const option = `<option value="${className}">${className}</option>`;
        if (className.startsWith("7")) g7?.insertAdjacentHTML("beforeend", option);
        else if (className.startsWith("8")) g8?.insertAdjacentHTML("beforeend", option);
        else if (className.startsWith("9")) g9?.insertAdjacentHTML("beforeend", option);
        else gSpec?.insertAdjacentHTML("beforeend", option);
    });
}

/**
 * 動態填入教師下拉選單
 */
function populateTeacherDropdown() {
    if (!scheduleData) return;

    const teacherSelect = document.getElementById("teacherSelect");
    if (!teacherSelect) return;

    const teachersSet = new Set();

    // 遍歷所有班級收集教師名稱
    Object.values(scheduleData).forEach(classObj => {
        if (classObj.homeroom_teacher) teachersSet.add(classObj.homeroom_teacher);
        if (classObj.schedule) {
            Object.values(classObj.schedule).forEach(day => {
                Object.values(day).forEach(cell => {
                    if (cell && cell.teacher) teachersSet.add(cell.teacher);
                });
            });
        }
    });

    teacherSelect.innerHTML = '<option value="">請選擇教師</option>';
    Array.from(teachersSet).sort().forEach(teacher => {
        teacherSelect.insertAdjacentHTML("beforeend", `<option value="${teacher}">${teacher}</option>`);
    });
}

/**
 * 班級選擇改變事件
 */
function onClassSelect(selectEl) {
    const className = selectEl.value;
    if (!className) return;

    // 清空其他年級選單
    ["grade7Select", "grade8Select", "grade9Select", "gradeSpecSelect"].forEach(id => {
        if (id !== selectEl.id) {
            const el = document.getElementById(id);
            if (el) el.value = "";
        }
    });

    renderClassSchedule(className);
}

/**
 * 教師選擇改變事件
 */
function onTeacherSelect(selectEl) {
    const teacherName = selectEl.value;
    if (!teacherName) return;

    renderTeacherSchedule(teacherName);
}

/**
 * 繪製班級課表
 */
function renderClassSchedule(className) {
    const classData = scheduleData[className];
    if (!classData) return;

    document.getElementById("scheduleTitle").textContent = `${className} 課表`;
    
    const infoEl = document.getElementById("homeroomTeacherInfo");
    if (infoEl) {
        infoEl.textContent = `導師：${classData.homeroom_teacher || "無"}`;
        infoEl.classList.remove("hidden");
    }

    renderScheduleTable((dayKey, periodKey) => {
        const cell = classData.schedule?.[dayKey]?.[periodKey];
        if (!cell) return "";
        return `
            <div class="cell-subject">${cell.subject || ""}</div>
            <div class="cell-subtext">${cell.teacher || ""}</div>
        `;
    });

    switchView("resultView");
}

/**
 * 繪製教師課表
 */
function renderTeacherSchedule(teacherName) {
    document.getElementById("scheduleTitle").textContent = `${teacherName} 老師課表`;
    
    const infoEl = document.getElementById("homeroomTeacherInfo");
    if (infoEl) infoEl.classList.add("hidden");

    renderScheduleTable((dayKey, periodKey) => {
        let matchInfo = "";
        // 尋找該節次該教師在微調或主課表中的節次
        Object.entries(scheduleData).forEach(([className, classObj]) => {
            const cell = classObj.schedule?.[dayKey]?.[periodKey];
            if (cell && cell.teacher === teacherName) {
                matchInfo = `
                    <div class="cell-subject">${cell.subject || ""}</div>
                    <div class="cell-subtext">${className}</div>
                `;
            }
        });
        return matchInfo;
    });

    switchView("resultView");
}

/**
 * 通用繪製 5 天 7 節（含午休）課表表格
 */
function renderScheduleTable(getCellContent) {
    const container = document.getElementById("scheduleTableContainer");
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
    const dayLabels = ["星期一", "星期二", "星期三", "星期四", "星期五"];
    const periods = [1, 2, 3, 4, 5, 6, 7];

    let html = `
        <table class="schedule-table">
            <thead>
                <tr>
                    <th class="th-period">節次</th>
                    ${dayLabels.map(d => `<th>${d}</th>`).join("")}
                </tr>
            </thead>
            <tbody>
    `;

    periods.forEach(p => {
        // 午休列插入
        if (p === 5) {
            html += `
                <tr>
                    <td class="td-period"><span class="period-num">午休</span></td>
                    <td colspan="5" class="td-lunch">午休與午餐時間</td>
                </tr>
            `;
        }

        html += `
            <tr>
                <td class="td-period"><span class="period-num">第 ${p} 節</span></td>
                ${days.map(day => `<td>${getCellContent(day, p.toString()) || ""}</td>`).join("")}
            </tr>
        `;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
}

/**
 * 切換視圖
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

function showQueryView() { switchView("queryView"); }

function switchTab(tabType) {
    const classTab = document.getElementById("classTab");
    const teacherTab = document.getElementById("teacherTab");
    const tabBtns = document.querySelectorAll(".tab-btn");

    tabBtns.forEach(btn => {
        if (btn.dataset.tab === tabType) btn.classList.add("active");
        else btn.classList.remove("active");
    });

    if (tabType === "class") {
        classTab?.classList.remove("hidden");
        teacherTab?.classList.add("hidden");
    } else {
        classTab?.classList.add("hidden");
        teacherTab?.classList.remove("hidden");
    }
}

async function fetchViewsCount() {
    const monthlyEl = document.getElementById("monthlyViews");
    const totalEl = document.getElementById("totalViews");

    try {
        const data = { monthlyViews: 1280, totalViews: 45200 };
        if (monthlyEl) monthlyEl.textContent = Number(data.monthlyViews || 0).toLocaleString();
        if (totalEl) totalEl.textContent = Number(data.totalViews || 0).toLocaleString();
    } catch (error) {
        if (monthlyEl) monthlyEl.textContent = "0";
        if (totalEl) totalEl.textContent = "0";
    }
}

function showLoading(show) {
    const overlay = document.getElementById("loadingOverlay");
    if (overlay) {
        if (show) overlay.classList.add("show");
        else overlay.classList.remove("show");
    }
}

function closeModal() {
    const modal = document.getElementById("substituteModal");
    if (modal) modal.classList.remove("show");
}