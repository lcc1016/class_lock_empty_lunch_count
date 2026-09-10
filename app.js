/* ============================================================
   課表查詢系統 - 主邏輯腳本 (app.js)
   整合 teacher_11501.csv, homerooms_11501.json, locked_courses.json
   ============================================================ */

// 全域資料庫
let teacherRawData = [];
let homeroomsData = {};
let lockedCoursesData = {};

let classSchedules = {};   // { className: { "Mon": { "1": { subject, teacher }, ... } } }
let teacherSchedules = {}; // { teacherName: { "Mon": { "1": { subject, className }, ... } } }

window.addEventListener("DOMContentLoaded", () => {
    fetchViewsCount();
});

/**
 * 登入系統並非同步載入三個資料檔
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
        // 同時讀取三個檔案
        const [csvRes, hrRes, lockedRes] = await Promise.all([
            fetch("teacher_11501.csv"),
            fetch("homerooms_11501.json"),
            fetch("locked_courses.json")
        ]);

        if (!csvRes.ok) throw new Error("無法讀取 teacher_11501.csv");
        if (!hrRes.ok) throw new Error("無法讀取 homerooms_11501.json");
        if (!lockedRes.ok) throw new Error("無法讀取 locked_courses.json");

        const csvText = await csvRes.text();
        homeroomsData = await hrRes.json();
        lockedCoursesData = await lockedRes.json();

        // 解析 CSV 並構建課表索引
        parseCSVData(csvText);

        // 下拉選單初始化
        populateClassDropdowns();
        populateTeacherDropdown();

        // 更新 UI 介面
        const badge = document.getElementById("currentSemesterBadge");
        if (badge) badge.textContent = semester;

        switchView("queryView");
    } catch (error) {
        console.error("資料載入失敗:", error);
        if (loginError) loginError.textContent = "資料檔案載入失敗，請確認檔案位置與格式！";
    } finally {
        showLoading(false);
    }
}

/**
 * 解析 teacher_11501.csv 並轉換為雙向索引 (班級課表 & 教師課表)
 */
function parseCSVData(csvText) {
    classSchedules = {};
    teacherSchedules = {};

    const dayKeys = ["1", "2", "3", "4", "5"];
    const dayMap = { "1": "Mon", "2": "Tue", "3": "Wed", "4": "Thu", "5": "Fri" };
    const periods = ["0", "1", "2", "3", "4", "5", "6", "7"];

    const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== "");
    if (lines.length < 2) return;

    const headers = parseCSVLine(lines[0]);

    for (let i = 1; i < lines.length; i++) {
        const row = parseCSVLine(lines[i]);
        if (row.length < 1) continue;

        const teacherName = row[0]?.trim();
        if (!teacherName) continue;

        if (!teacherSchedules[teacherName]) {
            teacherSchedules[teacherName] = {};
        }

        // 讀取每星期、每節次的科目與班級
        dayKeys.forEach(dayCode => {
            const dayName = dayMap[dayCode];
            if (!teacherSchedules[teacherName][dayName]) {
                teacherSchedules[teacherName][dayName] = {};
            }

            periods.forEach(p => {
                const subjCol = `s${dayCode}${p}`;
                const classCol = `c${dayCode}${p}`;

                const subjIdx = headers.indexOf(subjCol);
                const classIdx = headers.indexOf(classCol);

                if (subjIdx !== -1 && classIdx !== -1) {
                    const subject = row[subjIdx]?.trim();
                    let rawClass = row[classIdx]?.trim();

                    if (subject && rawClass) {
                        // 轉為整數班級格式 (例如 "701.0" -> "701")
                        const className = rawClass.split('.')[0];

                        // 1. 寫入教師課表
                        teacherSchedules[teacherName][dayName][p] = { subject, className };

                        // 2. 寫入班級課表
                        if (!classSchedules[className]) {
                            classSchedules[className] = {};
                        }
                        if (!classSchedules[className][dayName]) {
                            classSchedules[className][dayName] = {};
                        }
                        classSchedules[className][dayName][p] = { subject, teacher: teacherName };
                    }
                }
            });
        });
    }
}

/**
 * CSV 單行解析工具 (處理引號與逗號)
 */
function parseCSVLine(line) {
    const result = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
            inQuotes = !inQuotes;
        } else if (c === ',' && !inQuotes) {
            result.push(cur);
            cur = "";
        } else {
            cur += c;
        }
    }
    result.push(cur);
    return result;
}

/**
 * 產生班級下拉選單
 */
function populateClassDropdowns() {
    const g7 = document.getElementById("grade7Select");
    const g8 = document.getElementById("grade8Select");
    const g9 = document.getElementById("grade9Select");
    const gSpec = document.getElementById("gradeSpecSelect");

    if (g7) g7.innerHTML = '<option value="">請選擇班級</option>';
    if (g8) g8.innerHTML = '<option value="">請選擇班級</option>';
    if (g9) g9.innerHTML = '<option value="">請選擇班級</option>';
    if (gSpec) gSpec.innerHTML = '<option value="">請選擇班級</option>';

    // 合併 CSV 出現的班級與導師名單中的班級
    const allClasses = new Set([...Object.keys(classSchedules), ...Object.keys(homeroomsData)]);
    const sortedClasses = Array.from(allClasses).sort();

    sortedClasses.forEach(className => {
        const option = `<option value="${className}">${className}</option>`;
        if (className.startsWith("7")) g7?.insertAdjacentHTML("beforeend", option);
        else if (className.startsWith("8")) g8?.insertAdjacentHTML("beforeend", option);
        else if (className.startsWith("9")) g9?.insertAdjacentHTML("beforeend", option);
        else gSpec?.insertAdjacentHTML("beforeend", option);
    });
}

/**
 * 產生教師下拉選單
 */
function populateTeacherDropdown() {
    const teacherSelect = document.getElementById("teacherSelect");
    if (!teacherSelect) return;

    teacherSelect.innerHTML = '<option value="">請選擇教師</option>';
    const sortedTeachers = Object.keys(teacherSchedules).sort();

    sortedTeachers.forEach(teacher => {
        teacherSelect.insertAdjacentHTML("beforeend", `<option value="${teacher}">${teacher}</option>`);
    });
}

/**
 * 班級選擇變更
 */
function onClassSelect(selectEl) {
    const className = selectEl.value;
    if (!className) return;

    ["grade7Select", "grade8Select", "grade9Select", "gradeSpecSelect"].forEach(id => {
        if (id !== selectEl.id) {
            const el = document.getElementById(id);
            if (el) el.value = "";
        }
    });

    renderClassSchedule(className);
}

/**
 * 教師選擇變更
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
    const schedule = classSchedules[className] || {};
    const homeroomTeacher = homeroomsData[className] || "無";
    const lockedCourses = lockedCoursesData[className] || [];

    document.getElementById("scheduleTitle").textContent = `${className} 課表`;

    const infoEl = document.getElementById("homeroomTeacherInfo");
    if (infoEl) {
        let text = `導師：${homeroomTeacher}`;
        if (lockedCourses.length > 0) {
            text += ` ｜ 綁課：${lockedCourses.join("、")}`;
        }
        infoEl.textContent = text;
        infoEl.classList.remove("hidden");
    }

    renderScheduleTable((dayKey, periodKey) => {
        const cell = schedule?.[dayKey]?.[periodKey];
        if (!cell) return "";
        return `
            <div class="cell-subject">${cell.subject}</div>
            <div class="cell-subtext">${cell.teacher}</div>
        `;
    });

    switchView("resultView");
}

/**
 * 繪製教師課表
 */
function renderTeacherSchedule(teacherName) {
    const schedule = teacherSchedules[teacherName] || {};

    document.getElementById("scheduleTitle").textContent = `${teacherName} 老師課表`;

    const infoEl = document.getElementById("homeroomTeacherInfo");
    if (infoEl) infoEl.classList.add("hidden");

    renderScheduleTable((dayKey, periodKey) => {
        const cell = schedule?.[dayKey]?.[periodKey];
        if (!cell) return "";
        return `
            <div class="cell-subject">${cell.subject}</div>
            <div class="cell-subtext">${cell.className} 班</div>
        `;
    });

    switchView("resultView");
}

/**
 * 通用課表渲染（第 0~7 節）
 */
function renderScheduleTable(getCellContent) {
    const container = document.getElementById("scheduleTableContainer");
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
    const dayLabels = ["星期一", "星期二", "星期三", "星期四", "星期五"];
    const periods = ["0", "1", "2", "3", "4", "5", "6", "7"];

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
        // 第 0 節 (早自習)
        if (p === "0") {
            html += `
                <tr>
                    <td class="td-period"><span class="period-num">早自習</span></td>
                    ${days.map(day => `<td>${getCellContent(day, "0")}</td>`).join("")}
                </tr>
            `;
            return;
        }

        // 午休列
        if (p === "5") {
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
                ${days.map(day => `<td>${getCellContent(day, p)}</td>`).join("")}
            </tr>
        `;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
}

/**
 * 視圖切換邏輯
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