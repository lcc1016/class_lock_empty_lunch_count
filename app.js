/* ============================================================
   課表查詢系統 - 主邏輯腳本 (app.js)
   包含 CounterAPI 與 LocalStorage 雙軌瀏覽計數器 (免登入版)
   ============================================================ */

// ── 全域狀態管理與組態 ─────────────────────────────────────────
const CONFIG = {
    // CounterAPI 設定 (請將 workspace 替換為您的唯一名稱)
    COUNTER_API: {
        WORKSPACE: 'mhjh_schedule_system_2026',
        KEY: 'page_views'
    }
};

let scheduleData = {
    semester: '',
    teachers: {},
    classes: {},
    classrooms: {},
    timeSlots: [],
    settings: {}
};

// ── DOM 載入完成初始化 ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    initCounter(); // 初始化並更新瀏覽計數器
});

/**
 * 應用程式初始化入口
 */
function initApp() {
    bindEvents();
    checkAuthSession(); // 直接載入資料並顯示查詢頁面
}

/**
 * 繫結事件接聽器
 */
function bindEvents() {
    // 返回按鈕
    document.getElementById('backBtn')?.addEventListener('click', showQueryView);

    // 列印按鈕
    document.getElementById('printBtn')?.addEventListener('click', () => window.print());

    // Tab 切換事件
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            switchTab(e.target.dataset.tab);
        });
    });

    // 班級下拉選單變更事件
    document.querySelectorAll('.class-select').forEach(select => {
        select.addEventListener('change', (e) => {
            if (e.target.value) {
                // 清空其他年級選單的選取狀態
                document.querySelectorAll('.class-select').forEach(s => {
                    if (s !== e.target) s.value = '';
                });
                renderSchedule('class', e.target.value);
            }
        });
    });

    // 教師與專科教室下拉選單變更事件
    document.getElementById('teacherSelect')?.addEventListener('change', (e) => {
        if (e.target.value) renderSchedule('teacher', e.target.value);
    });

    document.getElementById('classroomSelect')?.addEventListener('change', (e) => {
        if (e.target.value) renderSchedule('classroom', e.target.value);
    });

    // Modal 關閉事件
    document.getElementById('modalCloseBtn')?.addEventListener('click', closeModal);
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('substituteModal');
        if (e.target === modal) closeModal();
    });
}

// ── 瀏覽計數器邏輯 (CounterAPI + LocalStorage) ───────────────────
/**
 * 初始化瀏覽計數器
 * 結合 CounterAPI (全站遠端累計) 與 LocalStorage (當月計數及備援)
 */
async function initCounter() {
    const totalEl = document.getElementById('totalCounter');
    const monthEl = document.getElementById('monthCounter');

    const now = new Date();
    const currentMonthKey = `pv_month_${now.getFullYear()}_${now.getMonth() + 1}`;
    
    // 1. 處理當月計數器 (LocalStorage 本地計算)
    let monthCount = parseInt(localStorage.getItem(currentMonthKey) || '0', 10);
    monthCount += 1;
    localStorage.setItem(currentMonthKey, monthCount.toString());
    if (monthEl) monthEl.textContent = monthCount.toLocaleString();

    // 2. 處理累計總瀏覽量 (優先呼叫 CounterAPI，失敗時轉 LocalStorage 備援)
    let totalCount = parseInt(localStorage.getItem('pv_total_fallback') || '0', 10) + 1;
    localStorage.setItem('pv_total_fallback', totalCount.toString());

    try {
        const url = `https://api.counterapi.dev/v1/${CONFIG.COUNTER_API.WORKSPACE}/${CONFIG.COUNTER_API.KEY}/up`;
        const response = await fetch(url);
        
        if (response.ok) {
            const data = await response.json();
            if (data && typeof data.count === 'number') {
                if (totalEl) totalEl.textContent = data.count.toLocaleString();
                return;
            }
        }
        throw new Error('CounterAPI 回應異常');
    } catch (err) {
        console.warn('CounterAPI 無法連線，切換為本地備援計數:', err);
        if (totalEl) totalEl.textContent = totalCount.toLocaleString();
    }
}

// ── 身分驗證與頁面切換邏輯 (已切換為免登入模式) ───────────────────
function checkAuthSession() {
    // 免密碼直接載入課表資料
    loadScheduleData();
}

function showView(viewId) {
    document.querySelectorAll('.view-container').forEach(v => {
        v.classList.remove('active', 'result-active');
    });

    const targetView = document.getElementById(viewId);
    if (targetView) {
        if (viewId === 'resultView') {
            targetView.classList.add('active', 'result-active');
        } else {
            targetView.classList.add('active');
        }
    }
}

function showQueryView() {
    // 重置所有選單選擇
    document.querySelectorAll('select').forEach(s => s.value = '');
    showView('queryView');
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    document.querySelectorAll('.tab-content').forEach(content => {
        if (content.id === tabId) {
            content.classList.remove('hidden');
            content.classList.add('active');
        } else {
            content.classList.add('hidden');
            content.classList.remove('active');
        }
    });
}

// ── 資料載入與下拉選單填入 ───────────────────────────────────────
async function loadScheduleData() {
    showLoading(true, '載入課表資料中...');
    try {
        const response = await fetch('homerooms_11501.json');
        if (!response.ok) throw new Error('無法讀取 homerooms_11501.json');
        scheduleData = await response.json();
        
        populateDropdowns();
        
        const semesterEl = document.getElementById('semesterBadge');
        if (semesterEl) {
            semesterEl.textContent = scheduleData.semester || '課表查詢系統';
        }

        // 隱藏登出按鈕（免密碼模式無需登出）
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) logoutBtn.style.display = 'none';
        
        showView('queryView');
    } catch (err) {
        console.error('資料載入失敗:', err);
        alert('課表資料載入失敗，請確認 data.json 檔案是否存在。');
    } finally {
        showLoading(false);
    }
}

function populateDropdowns() {
    // 1. 填入班級選單
    const g7 = document.getElementById('grade7Select');
    const g8 = document.getElementById('grade8Select');
    const g9 = document.getElementById('grade9Select');
    const gSpec = document.getElementById('gradeSpecialSelect');

    [g7, g8, g9, gSpec].forEach(select => {
        if (select) select.innerHTML = '<option value="">請選擇班級</option>';
    });

    if (scheduleData.classes) {
        Object.keys(scheduleData.classes).forEach(className => {
            const opt = document.createElement('option');
            opt.value = className;
            opt.textContent = className;

            if (className.startsWith('7') || className.startsWith('七')) g7?.appendChild(opt);
            else if (className.startsWith('8') || className.startsWith('八')) g8?.appendChild(opt);
            else if (className.startsWith('9') || className.startsWith('九')) g9?.appendChild(opt);
            else gSpec?.appendChild(opt);
        });
    }

    // 2. 填入教師選單
    const teacherSel = document.getElementById('teacherSelect');
    if (teacherSel && scheduleData.teachers) {
        teacherSel.innerHTML = '<option value="">請選擇教師</option>';
        Object.keys(scheduleData.teachers).sort().forEach(tName => {
            const opt = document.createElement('option');
            opt.value = tName;
            opt.textContent = tName;
            teacherSel.appendChild(opt);
        });
    }

    // 3. 填入專科教室選單
    const roomSel = document.getElementById('classroomSelect');
    if (roomSel && scheduleData.classrooms) {
        roomSel.innerHTML = '<option value="">請選擇教室</option>';
        Object.keys(scheduleData.classrooms).sort().forEach(rName => {
            const opt = document.createElement('option');
            opt.value = rName;
            opt.textContent = rName;
            roomSel.appendChild(opt);
        });
    }
}

// ── 課表繪製核心邏輯 ───────────────────────────────────────────
function renderSchedule(type, targetKey) {
    const titleEl = document.getElementById('scheduleTitle');
    const homeroomEl = document.getElementById('homeroomTeacherInfo');
    const container = document.getElementById('scheduleTableContainer');

    if (homeroomEl) {
        homeroomEl.classList.add('hidden');
        homeroomEl.textContent = '';
    }

    let titleText = '';
    let gridData = null;

    if (type === 'class') {
        titleText = `${targetKey} 課表`;
        const cData = scheduleData.classes[targetKey];
        if (cData) {
            gridData = cData.schedule;
            if (cData.homeroomTeacher && homeroomEl) {
                homeroomEl.textContent = `導師：${cData.homeroomTeacher}`;
                homeroomEl.classList.remove('hidden');
            }
        }
    } else if (type === 'teacher') {
        titleText = `${targetKey} 老師課表`;
        gridData = scheduleData.teachers[targetKey]?.schedule;
    } else if (type === 'classroom') {
        titleText = `${targetKey} 課表`;
        gridData = scheduleData.classrooms[targetKey]?.schedule;
    }

    if (titleEl) titleEl.textContent = titleText;

    if (!gridData) {
        container.innerHTML = '<div style="text-align:center; padding:20px;">暫無課表資料</div>';
        showView('resultView');
        return;
    }

    const timeSlots = scheduleData.timeSlots || [
        { period: '一', time: '08:25-09:10' },
        { period: '二', time: '09:20-10:05' },
        { period: '三', time: '10:15-11:00' },
        { period: '四', time: '11:10-11:55' },
        { period: '午休', time: '12:00-13:00', isLunch: true },
        { period: '五', time: '13:10-13:55' },
        { period: '六', time: '14:05-14:50' },
        { period: '七', time: '15:00-15:45' }
    ];

    const weekDays = ['一', '二', '三', '四', '五'];

    let html = `
        <table class="schedule-table">
            <thead>
                <tr>
                    <th class="th-period">節次</th>
                    ${weekDays.map(d => `<th>星期${d}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
    `;

    timeSlots.forEach((slot, pIdx) => {
        if (slot.isLunch) {
            html += `
                <tr class="tr-lunch">
                    <td class="td-period">
                        <span class="period-num">${slot.period}</span>
                        <span class="period-time">${slot.time}</span>
                    </td>
                    <td colspan="5" class="td-lunch">午餐與午休時間</td>
                </tr>
            `;
            return;
        }

        html += `<tr>`;
        html += `
            <td class="td-period">
                <span class="period-num">${slot.period}</span>
                <span class="period-time">${slot.time}</span>
            </td>
        `;

        weekDays.forEach((day, dIdx) => {
            const cell = gridData[dIdx] ? gridData[dIdx][pIdx] : null;

            if (!cell || (!cell.subject && !cell.teacher && !cell.className)) {
                html += `<td class="td-empty"></td>`;
            } else {
                const isLocked = cell.isLocked ? 'cell-locked' : '';
                html += `<td class="td-cell ${isLocked}">`;
                html += `<div class="cell-main-info">`;

                if (cell.subject) {
                    const clickAttr = (type === 'class') ? `onclick="openSubstituteModal(${dIdx}, ${pIdx}, '${cell.subject}', '${targetKey}')"` : '';
                    const clickClass = (type === 'class') ? 'clickable-subject' : '';
                    html += `
                        <div class="cell-subject ${clickClass}" ${clickAttr}>
                            ${cell.subject}
                            ${cell.isLocked ? '<span class="lock-tag bind-tag">[綁]</span>' : ''}
                        </div>
                    `;
                }

                if (type === 'class' && cell.teacher) {
                    html += `<div class="cell-items-container">`;
                    cell.teacher.split(',').forEach(t => {
                        const trimmed = t.trim();
                        if (trimmed) {
                            html += `<span class="cell-link" onclick="renderSchedule('teacher', '${trimmed}')">${trimmed}</span>`;
                        }
                    });
                    html += `</div>`;
                } else if (type === 'teacher' && cell.className) {
                    html += `<div class="cell-items-container">`;
                    cell.className.split(',').forEach(c => {
                        const trimmed = c.trim();
                        if (trimmed) {
                            html += `<span class="cell-link" onclick="renderSchedule('class', '${trimmed}')">${trimmed}</span>`;
                        }
                    });
                    html += `</div>`;
                } else if (type === 'classroom' && (cell.className || cell.teacher)) {
                    html += `<div class="cell-items-container">`;
                    if (cell.className) html += `<span class="cell-link" onclick="renderSchedule('class', '${cell.className}')">${cell.className}</span>`;
                    if (cell.teacher) html += `<span class="cell-link" onclick="renderSchedule('teacher', '${cell.teacher}')">${cell.teacher}</span>`;
                    html += `</div>`;
                }

                html += `</div></td>`;
            }
        });

        html += `</tr>`;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;

    showView('resultView');
}

// ── 代課無課教師推薦 Modal 邏輯 ──────────────────────────────────
function openSubstituteModal(dayIdx, periodIdx, currentSubject, className) {
    const weekDays = ['一', '二', '三', '四', '五'];
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');

    if (modalTitle) modalTitle.textContent = `星期${weekDays[dayIdx]}第${periodIdx + 1}節 空堂教師推薦`;

    const sameSubjectTeachers = [];
    const otherSubjectTeachers = [];

    // 1. 比對無課教師
    Object.keys(scheduleData.teachers).forEach(tName => {
        const teacher = scheduleData.teachers[tName];
        const teacherSchedule = teacher.schedule;
        
        // 判斷該節次是否空堂
        const cell = teacherSchedule[dayIdx] ? teacherSchedule[dayIdx][periodIdx] : null;
        const isFree = !cell || (!cell.subject && !cell.className);

        if (isFree) {
            if (teacher.subjects && teacher.subjects.includes(currentSubject)) {
                sameSubjectTeachers.push(tName);
            } else {
                otherSubjectTeachers.push(tName);
            }
        }
    });

    let bodyHtml = '';

    // 2. 渲染同科目教師
    bodyHtml += `<div style="font-weight: bold; margin-bottom: 8px; color: #0284c7;">【同科目無課教師 (${currentSubject})】</div>`;
    if (sameSubjectTeachers.length > 0) {
        bodyHtml += `<div style="margin-bottom: 16px;">`;
        sameSubjectTeachers.forEach(t => {
            bodyHtml += `<button class="btn-teacher-tag btn-primary-subject" onclick="selectSubstituteTeacher('${t}')">${t}</button>`;
        });
        bodyHtml += `</div>`;
    } else {
        bodyHtml += `<p style="font-size: 0.85rem; color: #64748b; margin-bottom: 16px;">此節次無同科目空堂教師</p>`;
    }

    // 3. 渲染其他科目無課教師
    bodyHtml += `<div style="font-weight: bold; margin-bottom: 8px; color: #d97706;">【該班其他科目/其他領域無課教師】</div>`;
    if (otherSubjectTeachers.length > 0) {
        bodyHtml += `<div>`;
        otherSubjectTeachers.forEach(t => {
            bodyHtml += `<button class="btn-teacher-tag btn-other-subject" onclick="selectSubstituteTeacher('${t}')">${t}</button>`;
        });
        bodyHtml += `</div>`;
    } else {
        bodyHtml += `<p style="font-size: 0.85rem; color: #64748b;">此節次無其他空堂教師</p>`;
    }

    if (modalBody) modalBody.innerHTML = bodyHtml;
    document.getElementById('substituteModal')?.classList.add('show');
}

function selectSubstituteTeacher(teacherName) {
    closeModal();
    renderSchedule('teacher', teacherName);
}

function closeModal() {
    document.getElementById('substituteModal')?.classList.remove('show');
}

// ── UI 工具函式 ────────────────────────────────────────────────
function showLoading(show, text = '資料載入中...') {
    const overlay = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('loadingText');
    if (loadingText) loadingText.textContent = text;
    
    if (overlay) {
        if (show) {
            overlay.classList.add('show');
        } else {
            overlay.classList.remove('show');
        }
    }
}