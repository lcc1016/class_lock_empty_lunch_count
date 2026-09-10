/* ============================================================
   課表查詢系統 - 主邏輯腳本 (app.js)
   ============================================================ */

let currentView = 'loginView';
let viewHistory = [];
let rawScheduleData = null;
let currentSemester = '';

// 節次對照表 (午休設為單獨特例)
const PERIODS = [
    { id: '1', name: '第一節', time: '08:15-09:00' },
    { id: '2', name: '第二節', time: '09:10-09:55' },
    { id: '3', name: '第三節', time: '10:10-10:55' },
    { id: '4', name: '第四節', time: '11:05-11:50' },
    { id: 'lunch', name: '午休時間', time: '12:00-12:40' }, // 恢復無課表跨欄
    { id: '5', name: '第五節', time: '13:10-13:55' },
    { id: '6', name: '第六節', time: '14:05-14:50' },
    { id: '7', name: '第七節', time: '15:00-15:45' },
    { id: '8', name: '第八節', time: '16:00-16:45' }
];

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    loadSemesterOptions();
    setupEventListeners();
    fetchCounterData(); // 載入頁面時讀取點閱率計數器
}

function loadSemesterOptions() {
    const semSelect = document.getElementById('semesterSelect');
    if (!semSelect) return;
    const semesters = (typeof CONFIG !== 'undefined' && CONFIG.semesters) ? CONFIG.semesters : ['113-1', '113-2'];
    semSelect.innerHTML = semesters.map(sem => `<option value="${sem}">${sem} 學年度</option>`).join('');
}

function setupEventListeners() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
}

// 讀取/更新使用計數器 (範例使用 LocalStorage，可改接 GAS/API)
function fetchCounterData() {
    let monthCount = parseInt(localStorage.getItem('sys_month_count') || '128');
    let totalCount = parseInt(localStorage.getItem('sys_total_count') || '2540');

    document.getElementById('monthCount').innerText = monthCount.toLocaleString();
    document.getElementById('totalCount').innerText = totalCount.toLocaleString();
}

function incrementCounter() {
    let monthCount = parseInt(localStorage.getItem('sys_month_count') || '128') + 1;
    let totalCount = parseInt(localStorage.getItem('sys_total_count') || '2540') + 1;

    localStorage.setItem('sys_month_count', monthCount);
    localStorage.setItem('sys_total_count', totalCount);

    document.getElementById('monthCount').innerText = monthCount.toLocaleString();
    document.getElementById('totalCount').innerText = totalCount.toLocaleString();
}

function handleLogin(e) {
    if (e) e.preventDefault();
    const semSelect = document.getElementById('semesterSelect');
    currentSemester = semSelect.value;
    
    showLoading(true);

    // 每次進入系統累加一次查詢計數
    incrementCounter();
    
    setTimeout(() => {
        document.getElementById('currentSemester').innerText = `${currentSemester} 學年度`;
        showLoading(false);
        switchView('queryView');
        populateQueryDropdowns();
    }, 500);
}

function switchTab(tabType) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.add('hidden'));

    if (tabType === 'class') {
        document.getElementById('tabClass').classList.add('active');
        document.getElementById('panelClass').classList.remove('hidden');
    } else {
        document.getElementById('tabTeacher').classList.add('active');
        document.getElementById('panelTeacher').classList.remove('hidden');
    }
}

function populateQueryDropdowns() {
    const sel7 = document.getElementById('sel7');
    const sel8 = document.getElementById('sel8');
    const sel9 = document.getElementById('sel9');
    const selSp = document.getElementById('selSp');
    const subjectSelect = document.getElementById('subjectSelect');

    if (sel7) sel7.innerHTML = '<option value="">— 選擇班級 —</option><option value="701">701</option><option value="702">702</option>';
    if (sel8) sel8.innerHTML = '<option value="">— 選擇班級 —</option><option value="801">801</option><option value="802">802</option>';
    if (sel9) sel9.innerHTML = '<option value="">— 選擇班級 —</option><option value="901">901</option><option value="902">902</option>';
    if (selSp) selSp.innerHTML = '<option value="">— 選擇班級 —</option><option value="特1">特教班</option>';
    
    if (subjectSelect) {
        subjectSelect.innerHTML = `
            <option value="">— 選擇科目 —</option>
            <option value="國文">國文</option>
            <option value="英文">英文</option>
            <option value="數學">數學</option>
        `;
    }
}

function onSubjectChange() {
    const subject = document.getElementById('subjectSelect').value;
    const teacherSelect = document.getElementById('teacherSelect');
    if (!teacherSelect) return;

    if (!subject) {
        teacherSelect.innerHTML = '<option value="">— 選擇教師 —</option>';
        return;
    }

    const mockTeachers = ['王老師', '李老師', '張老師'];
    teacherSelect.innerHTML = '<option value="">— 選擇教師 —</option>' + 
        mockTeachers.map(t => `<option value="${t}">${t}</option>`).join('');
}

function submitClassQuery() {
    const c7 = document.getElementById('sel7').value;
    const c8 = document.getElementById('sel8').value;
    const c9 = document.getElementById('sel9').value;
    const cSp = document.getElementById('selSp').value;

    const selectedClass = c7 || c8 || c9 || cSp;
    const errorElem = document.getElementById('classError');

    if (!selectedClass) {
        if (errorElem) errorElem.innerText = '請選擇一個班級進行查詢';
        return;
    }
    if (errorElem) errorElem.innerText = '';

    renderSchedule('class', selectedClass);
}

function submitTeacherQuery() {
    const teacher = document.getElementById('teacherSelect').value;
    const errorElem = document.getElementById('teacherError');

    if (!teacher) {
        if (errorElem) errorElem.innerText = '請選擇教師姓名';
        return;
    }
    if (errorElem) errorElem.innerText = '';

    renderSchedule('teacher', teacher);
}

// 課表渲染邏輯：午休恢復跨 5 欄 (Colspan=5)
function renderSchedule(type, targetName) {
    const titleElem = document.getElementById('scheduleTitle');
    const headerContainer = document.getElementById('headerContainer');
    const container = document.getElementById('scheduleTableContainer');

    titleElem.innerText = type === 'class' ? `${targetName} 班級課表` : `${targetName} 老師課表`;

    const existingHomeroom = document.querySelector('.homeroom-teacher-info');
    if (existingHomeroom) existingHomeroom.remove();

    if (type === 'class') {
        const homeroomDiv = document.createElement('div');
        homeroomDiv.className = 'homeroom-teacher-info';
        homeroomDiv.innerText = `導師：${getHomeroomTeacher(targetName)}`;
        headerContainer.appendChild(homeroomDiv);
    }

    let tableHtml = `
        <table class="schedule-table">
            <thead>
                <tr>
                    <th class="th-period">節次</th>
                    <th>星期一</th>
                    <th>星期二</th>
                    <th>星期三</th>
                    <th>星期四</th>
                    <th>星期五</th>
                </tr>
            </thead>
            <tbody>
    `;

    PERIODS.forEach(period => {
        if (period.id === 'lunch') {
            // 午休沒排課：使用 colspan="5" 跨欄
            tableHtml += `
                <tr class="tr-lunch">
                    <td class="td-period td-lunch-period">
                        <span class="period-num">${period.name}</span>
                        <span class="period-time">${period.time}</span>
                    </td>
                    <td colspan="5" class="td-lunch-bar">午休 / 午膳時間</td>
                </tr>
            `;
        } else {
            tableHtml += `<tr>`;
            tableHtml += `
                <td class="td-period">
                    <span class="period-num">${period.name}節</span>
                    <span class="period-time">${period.time}</span>
                </td>
            `;

            for (let day = 1; day <= 5; day++) {
                const cellData = getCellData(type, targetName, day, period.id);

                if (cellData) {
                    const cellLockedClass = cellData.isLocked ? 'cell-locked' : '';
                    tableHtml += `
                        <td class="td-cell ${cellLockedClass}">
                            <div class="cell-main-info">
                                <span class="cell-subject ${cellData.clickable ? 'clickable-subject' : ''}"
                                      onclick="handleSubjectClick('${day}', '${period.id}', '${cellData.subject}')">
                                    ${cellData.subject}
                                    ${cellData.isLocked ? '<span class="lock-tag">綁</span>' : ''}
                                </span>
                                <div class="cell-items-container">
                                    <span class="cell-link" onclick="handleLinkClick('${type}', '${cellData.detailLink}')">
                                        ${cellData.detailLink}
                                    </span>
                                </div>
                            </div>
                        </td>
                    `;
                } else {
                    tableHtml += `<td class="td-empty"></td>`;
                }
            }
            tableHtml += `</tr>`;
        }
    });

    tableHtml += `
            </tbody>
        </table>
    `;

    container.innerHTML = tableHtml;
    switchView('resultView');
}

function getCellData(type, targetName, day, periodId) {
    if (day === 1 && periodId === '1') {
        return { subject: '國文', detailLink: type === 'class' ? '張老師' : '701班', clickable: true, isLocked: false };
    }
    if (day === 3 && periodId === '2') {
        return { subject: '體育', detailLink: type === 'class' ? '陳老師' : '802班', clickable: true, isLocked: true };
    }
    return null;
}

function getHomeroomTeacher(className) {
    const mockHomerooms = { '701': '林老師', '702': '陳老師', '801': '黃老師', '802': '張老師', '901': '王老師' };
    return mockHomerooms[className] || '無導師';
}

function handleSubjectClick(day, periodId, subjectName) {
    const modal = document.getElementById('subModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');

    if (!modal) return;

    modalTitle.innerText = `星期${getDayChinese(day)} 第${periodId}節 — ${subjectName}（可代課教師）`;
    modalBody.innerHTML = `
        <p style="margin-bottom: 10px; font-size: 0.9rem; color: #64748b;">【原科目/同科空堂教師】</p>
        <div>
            <button class="btn-teacher-tag btn-primary-subject" onclick="selectSubTeacher('張老師')">張老師</button>
            <button class="btn-teacher-tag btn-primary-subject" onclick="selectSubTeacher('王老師')">王老師</button>
        </div>
    `;
    modal.classList.add('show');
}

function handleLinkClick(currentType, targetName) {
    if (currentType === 'class') renderSchedule('teacher', targetName);
    else renderSchedule('class', targetName);
}

function selectSubTeacher(teacherName) {
    alert(`已選擇代課教師：${teacherName}`);
    closeSubModal();
}

function closeSubModal(e) {
    if (e && e.target !== e.currentTarget && e.type === 'click') return;
    const modal = document.getElementById('subModal');
    if (modal) modal.classList.remove('show');
}

function switchView(viewId) {
    document.querySelectorAll('.view-container').forEach(v => {
        v.classList.remove('active');
        v.classList.remove('result-active');
    });

    const targetView = document.getElementById(viewId);
    if (!targetView) return;

    if (viewId === 'resultView') targetView.classList.add('result-active');
    else targetView.classList.add('active');

    if (currentView !== viewId) {
        viewHistory.push(currentView);
        currentView = viewId;
    }
}

function goBack() {
    if (viewHistory.length > 0) {
        const previous = viewHistory.pop();
        currentView = previous;
        document.querySelectorAll('.view-container').forEach(v => {
            v.classList.remove('active');
            v.classList.remove('result-active');
        });
        const targetView = document.getElementById(previous);
        if (previous === 'resultView') targetView.classList.add('result-active');
        else targetView.classList.add('active');
    } else {
        showQueryView();
    }
}

function showQueryView() {
    viewHistory = [];
    switchView('queryView');
}

function logout() {
    viewHistory = [];
    switchView('loginView');
}

function printSchedule() {
    window.print();
}

function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        if (show) overlay.classList.add('show');
        else overlay.classList.remove('show');
    }
}

function getDayChinese(day) {
    const map = { '1': '一', '2': '二', '3': '三', '4': '四', '5': '五' };
    return map[day] || day;
}