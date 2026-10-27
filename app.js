(() => {
  "use strict";
  const STORAGE_KEY = "studyflow-planner-v1";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  };
  const dateFromISO = value => {
    if (!value) return null;
    const [y,m,d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  const dayDiff = value => {
    const target = dateFromISO(value);
    if (!target) return null;
    const today = dateFromISO(todayISO());
    return Math.round((target - today) / 86400000);
  };
  const formatDate = (value, options = {month:"short", day:"numeric"}) => {
    const d = dateFromISO(value);
    return d ? d.toLocaleDateString(undefined, options) : "No due date";
  };
  const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const uid = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  let state = loadState();
  let currentFilter = "all";
  let searchQuery = "";
  let toastTimer;

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {tasks:Array.isArray(parsed.tasks)?parsed.tasks:[], exams:Array.isArray(parsed.exams)?parsed.exams:[], activity:parsed.activity && typeof parsed.activity==="object"?parsed.activity:{}, theme:parsed.theme==="dark"?"dark":"light"};
      }
    } catch (error) { console.warn("Could not load saved planner data.", error); }
    return {tasks:[], exams:[], activity:{}, theme:"light"};
  }
  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (error) { showToast("Could not save data. Your browser storage may be full."); }
  }
  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
  }
  function setTheme(theme) {
    state.theme = theme;
    document.body.classList.toggle("dark", theme === "dark");
    saveState();
  }
  function completedCount() { return state.tasks.filter(t => t.completed).length; }
  function pendingCount() { return state.tasks.filter(t => !t.completed).length; }
  function completionPercent() { return state.tasks.length ? Math.round(completedCount() / state.tasks.length * 100) : 0; }
  function getStreak() {
    const activityDays = new Set(Object.keys(state.activity).filter(day => (state.activity[day] || 0) > 0));
    let streak = 0;
    let cursor = dateFromISO(todayISO());
    if (!activityDays.has(todayISO())) cursor.setDate(cursor.getDate() - 1);
    while (activityDays.has(`${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,"0")}-${String(cursor.getDate()).padStart(2,"0")}`)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }
  function markActivity() {
    const day = todayISO();
    state.activity[day] = (state.activity[day] || 0) + 1;
  }
  function sortedTasks(tasks) {
    const rank = {high:0, medium:1, low:2};
    return [...tasks].sort((a,b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (a.due && b.due && a.due !== b.due) return a.due.localeCompare(b.due);
      if (a.due && !b.due) return -1;
      if (!a.due && b.due) return 1;
      return (rank[a.priority] ?? 1) - (rank[b.priority] ?? 1);
    });
  }
  function taskDateLabel(task) {
    if (!task.due) return "No due date";
    const diff = dayDiff(task.due);
    if (diff < 0) return `Overdue · ${formatDate(task.due)}`;
    if (diff === 0) return "Due today";
    if (diff === 1) return "Due tomorrow";
    return `Due ${formatDate(task.due)}`;
  }
  function taskMarkup(task) {
    const overdue = !task.completed && task.due && dayDiff(task.due) < 0;
    return `<div class="task-row ${task.completed ? "is-complete" : ""}" data-task-row="${escapeHTML(task.id)}">
      <input class="task-check" type="checkbox" aria-label="${task.completed ? "Mark incomplete" : "Mark complete"}: ${escapeHTML(task.title)}" data-toggle-task="${escapeHTML(task.id)}" ${task.completed ? "checked" : ""}>
      <div class="task-main"><div class="task-title" title="${escapeHTML(task.title)}">${escapeHTML(task.title)}</div><div class="task-meta">${task.subject ? `<span class="subject-tag">${escapeHTML(task.subject)}</span>` : `<span>${escapeHTML(task.category || "Study")}</span>`}<span class="priority ${escapeHTML(task.priority || "medium")}">${escapeHTML(task.priority || "medium")} priority</span>${task.notes ? `<span title="${escapeHTML(task.notes)}">• has notes</span>` : ""}</div></div>
      <span class="task-date ${overdue ? "overdue" : ""}">${escapeHTML(taskDateLabel(task))}</span>
      <div class="row-actions"><button class="mini-action" data-edit-task="${escapeHTML(task.id)}" aria-label="Edit task">✎</button><button class="mini-action" data-delete-task="${escapeHTML(task.id)}" aria-label="Delete task">×</button></div>
    </div>`;
  }
  function examMarkup(exam, card = false) {
    const d = dateFromISO(exam.date);
    const diff = dayDiff(exam.date);
    const daysLabel = diff < 0 ? "Past exam" : diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : `${diff} days left`;
    const month = d ? d.toLocaleDateString(undefined,{month:"short"}) : "—";
    const day = d ? d.getDate() : "—";
    const detail = [exam.time ? formatTime(exam.time) : "", exam.location || ""].filter(Boolean).join(" · ");
    if (!card) return `<div class="exam-item"><div class="exam-date-box"><strong>${day}</strong><span>${month}</span></div><div class="exam-info"><strong>${escapeHTML(exam.title)}</strong><small>${escapeHTML(detail || "Exam day")}</small></div><span class="days-badge">${escapeHTML(daysLabel)}</span></div>`;
    return `<article class="exam-card"><div class="exam-date-box"><strong>${day}</strong><span>${month}</span></div><div class="exam-card-body"><div class="exam-card-top"><h3>${escapeHTML(exam.title)}</h3><span class="days-badge">${escapeHTML(daysLabel)}</span></div><p>${escapeHTML(detail || "No time or location added")}${exam.notes ? ` · ${escapeHTML(exam.notes)}` : ""}</p><div class="exam-card-actions"><button class="secondary-button" data-edit-exam="${escapeHTML(exam.id)}">Edit</button><button class="secondary-button" data-delete-exam="${escapeHTML(exam.id)}">Delete</button></div></div></article>`;
  }
  function formatTime(value) {
    if (!value) return "";
    const [h,m] = value.split(":").map(Number);
    const d = new Date(); d.setHours(h,m,0,0);
    return d.toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"});
  }
  function upcomingExams() { return [...state.exams].filter(e => dayDiff(e.date) >= 0).sort((a,b) => a.date.localeCompare(b.date) || (a.time||"").localeCompare(b.time||"")); }
  function renderStats() {
    const done = completedCount(), total = state.tasks.length, pct = completionPercent(), pending = pendingCount();
    $("#statCompleted").innerHTML = `${done} <small>/ ${total}</small>`;
    $("#statPending").textContent = pending;
    $("#statExams").textContent = upcomingExams().length;
    $("#statStreak").textContent = getStreak();
    $("#completedBar").style.width = `${pct}%`;
    $("#completedPercent").textContent = `${pct}%`;
    $("#navTaskCount").textContent = pending;
    $("#examTotal").textContent = state.exams.length;
    $("#examSoon").textContent = upcomingExams().filter(e => dayDiff(e.date) <= 7).length;
    const next = upcomingExams()[0];
    $("#nextExamDays").textContent = next ? dayDiff(next.date) : "—";
    $("#progressRingValue").textContent = `${pct}%`;
    $("#progressRing").style.background = `conic-gradient(var(--primary) ${pct*3.6}deg, #efeff8 ${pct*3.6}deg)`;
    $("#progressCompleted").textContent = done;
    $("#progressPending").textContent = pending;
    $("#progressExamCount").textContent = state.exams.length;
    $("#snapshotDone").textContent = `${done} ${done === 1 ? "task" : "tasks"}`;
    $("#snapshotExams").textContent = `${state.exams.length} ${state.exams.length === 1 ? "exam" : "exams"}`;
    $("#snapshotStreak").textContent = `${getStreak()} ${getStreak() === 1 ? "day" : "days"}`;
  }
  function renderTasks() {
    const allSorted = sortedTasks(state.tasks);
    const todayTasks = allSorted.filter(t => !t.completed && (!t.due || t.due <= todayISO())).slice(0,5);
    $("#todayTaskList").innerHTML = todayTasks.map(taskMarkup).join("");
    $("#todayEmpty").classList.toggle("hidden", todayTasks.length > 0);
    const filtered = allSorted.filter(t => currentFilter === "all" || (currentFilter === "active" && !t.completed) || (currentFilter === "completed" && t.completed))
      .filter(t => `${t.title} ${t.subject||""} ${t.category||""}`.toLowerCase().includes(searchQuery));
    $("#allTaskList").innerHTML = filtered.map(taskMarkup).join("");
    $("#allTaskEmpty").classList.toggle("hidden", filtered.length > 0);
    $$(".filter-tab").forEach(button => button.classList.toggle("active", button.dataset.filter === currentFilter));
  }
  function renderExams() {
    const upcoming = upcomingExams().slice(0,4);
    $("#upcomingExamList").innerHTML = upcoming.map(e => examMarkup(e)).join("");
    $("#examEmpty").classList.toggle("hidden", upcoming.length > 0);
    const sorted = [...state.exams].sort((a,b) => a.date.localeCompare(b.date) || (a.time||"").localeCompare(b.time||""));
    $("#allExamList").innerHTML = sorted.map(e => examMarkup(e,true)).join("");
    $("#allExamEmpty").classList.toggle("hidden", sorted.length > 0);
  }
  function renderChart(target) {
    const el = $(target);
    const days = [];
    for (let i=6; i>=0; i--) {
      const d = dateFromISO(todayISO()); d.setDate(d.getDate()-i);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      days.push({key, label:d.toLocaleDateString(undefined,{weekday:"short"}), count:state.activity[key]||0, today:i===0});
    }
    const max = Math.max(4,...days.map(d=>d.count));
    el.innerHTML = days.map(d => `<div class="chart-day ${d.today?"today":""}"><div class="chart-bar-wrap"><div class="chart-bar ${d.today?"today":""}" style="height:${Math.max(3,d.count/max*100)}%"><span class="chart-value">${d.count}</span></div></div><small>${d.label}</small></div>`).join("");
  }
  function renderAll() {
    renderStats(); renderTasks(); renderExams(); renderChart("#weeklyChart"); renderChart("#progressChart");
  }
  function showView(view) {
    $$(".page-view").forEach(page => page.classList.toggle("active", page.id === `view-${view}`));
    $$(".nav-link").forEach(link => link.classList.toggle("active", link.dataset.view === view));
    const label = ({overview:"Overview",tasks:"My Tasks",exams:"Exam Planner",progress:"Progress"})[view] || "Overview";
    $("#breadcrumbCurrent").textContent = label;
    $("#sidebar").classList.remove("open");
    window.scrollTo({top:0,behavior:"smooth"});
  }
  function openModal(type, item = null) {
    const backdrop = $(`#${type}ModalBackdrop`);
    const form = $(`#${type}Form`);
    form.reset();
    if (type === "task") {
      $("#taskModalTitle").textContent = item ? "Edit task" : "Add a task";
      $("#taskId").value = item?.id || "";
      $("#taskTitle").value = item?.title || "";
      $("#taskSubject").value = item?.subject || "";
      $("#taskDue").value = item?.due || "";
      $("#taskPriority").value = item?.priority || "medium";
      $("#taskCategory").value = item?.category || "Study";
      $("#taskNotes").value = item?.notes || "";
    } else {
      $("#examModalTitle").textContent = item ? "Edit exam" : "Add an exam";
      $("#examId").value = item?.id || "";
      $("#examTitle").value = item?.title || "";
      $("#examDate").value = item?.date || "";
      $("#examTime").value = item?.time || "";
      $("#examLocation").value = item?.location || "";
      $("#examNotes").value = item?.notes || "";
    }
    backdrop.classList.remove("hidden");
    const focusTarget = type === "task" ? $("#taskTitle") : $("#examTitle");
    setTimeout(() => focusTarget.focus(), 30);
  }
  function closeModal(type) { $(`#${type}ModalBackdrop`).classList.add("hidden"); }
  function editTask(id) { const task = state.tasks.find(t=>t.id===id); if (task) openModal("task",task); }
  function editExam(id) { const exam = state.exams.find(e=>e.id===id); if (exam) openModal("exam",exam); }
  function toggleTask(id, completed) {
    const task = state.tasks.find(t=>t.id===id);
    if (!task) return;
    if (completed && !task.completed) markActivity();
    task.completed = completed;
    task.completedAt = completed ? todayISO() : null;
    saveState(); renderAll();
    showToast(completed ? "Nice work — task completed!" : "Task moved back to in progress.");
  }
  function deleteTask(id) {
    const task = state.tasks.find(t=>t.id===id);
    if (!task) return;
    if (!window.confirm(`Delete “${task.title}”? This cannot be undone.`)) return;
    state.tasks = state.tasks.filter(t=>t.id!==id);
    saveState(); renderAll(); showToast("Task deleted.");
  }
  function deleteExam(id) {
    const exam = state.exams.find(e=>e.id===id);
    if (!exam) return;
    if (!window.confirm(`Delete “${exam.title}”? This cannot be undone.`)) return;
    state.exams = state.exams.filter(e=>e.id!==id);
    saveState(); renderAll(); showToast("Exam deleted.");
  }
  $("#taskForm").addEventListener("submit", event => {
    event.preventDefault();
    const id = $("#taskId").value;
    const existing = state.tasks.find(t=>t.id===id);
    const task = {id:id||uid(), title:$("#taskTitle").value.trim(), subject:$("#taskSubject").value.trim(), due:$("#taskDue").value, priority:$("#taskPriority").value, category:$("#taskCategory").value, notes:$("#taskNotes").value.trim(), completed:existing?.completed||false, completedAt:existing?.completedAt||null, createdAt:existing?.createdAt||new Date().toISOString()};
    if (!task.title) { $("#taskTitle").focus(); return; }
    if (existing) state.tasks = state.tasks.map(t=>t.id===id?task:t); else state.tasks.push(task);
    saveState(); closeModal("task"); renderAll(); showToast(existing ? "Task updated." : "Task added.");
  });
  $("#examForm").addEventListener("submit", event => {
    event.preventDefault();
    const id = $("#examId").value;
    const existing = state.exams.find(e=>e.id===id);
    const exam = {id:id||uid(), title:$("#examTitle").value.trim(), date:$("#examDate").value, time:$("#examTime").value, location:$("#examLocation").value.trim(), notes:$("#examNotes").value.trim(), createdAt:existing?.createdAt||new Date().toISOString()};
    if (!exam.title || !exam.date) return;
    if (existing) state.exams = state.exams.map(e=>e.id===id?exam:e); else state.exams.push(exam);
    saveState(); closeModal("exam"); renderAll(); showToast(existing ? "Exam updated." : "Exam added.");
  });
  document.addEventListener("click", event => {
    const target = event.target.closest("button");
    if (!target) return;
    if (target.dataset.view) showView(target.dataset.view);
    if (target.dataset.go) showView(target.dataset.go);
    if (target.dataset.close) closeModal(target.dataset.close);
    if (target.dataset.editTask) editTask(target.dataset.editTask);
    if (target.dataset.deleteTask) deleteTask(target.dataset.deleteTask);
    if (target.dataset.editExam) editExam(target.dataset.editExam);
    if (target.dataset.deleteExam) deleteExam(target.dataset.deleteExam);
  });
  document.addEventListener("change", event => {
    const input = event.target;
    if (input.matches("[data-toggle-task]")) toggleTask(input.dataset.toggleTask,input.checked);
  });
  $("#quickAddTask").addEventListener("click",()=>openModal("task"));
  $("#emptyAddTask").addEventListener("click",()=>openModal("task"));
  $("#addTaskButton").addEventListener("click",()=>openModal("task"));
  $("#addExamButton").addEventListener("click",()=>openModal("exam"));
  $("#taskFilters").addEventListener("click",event => { const button=event.target.closest("[data-filter]"); if (!button)return; currentFilter=button.dataset.filter; renderTasks(); });
  $("#taskSearch").addEventListener("input",event=>{searchQuery=event.target.value.trim().toLowerCase();renderTasks();});
  $("#themeToggle").addEventListener("click",()=>{setTheme(state.theme==="dark"?"light":"dark");showToast(`${state.theme==="dark"?"Dark":"Light"} mode enabled.`);});
  $("#mobileMenu").addEventListener("click",()=>$("#sidebar").classList.toggle("open"));
  $$(".modal-backdrop").forEach(backdrop=>backdrop.addEventListener("click",event=>{if(event.target===backdrop)backdrop.classList.add("hidden");}));
  document.addEventListener("keydown",event=>{if(event.key==="Escape"){$$(".modal-backdrop").forEach(b=>b.classList.add("hidden"));$("#sidebar").classList.remove("open");}});
  $("#exportData").addEventListener("click",()=>{
    const blob = new Blob([JSON.stringify({exportedAt:new Date().toISOString(),tasks:state.tasks,exams:state.exams,activity:state.activity},null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`studyflow-backup-${todayISO()}.json`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);showToast("Your planner data was exported.");
  });
  $("#clearData").addEventListener("click",()=>{
    if(!window.confirm("Clear all tasks, exams, and activity from this browser? This cannot be undone."))return;
    state.tasks=[];state.exams=[];state.activity={};saveState();renderAll();showToast("Planner data cleared.");
  });
  $("#todayDate").textContent = new Date().toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"});
  const hour = new Date().getHours();
  $("#greeting").textContent = hour < 12 ? "GOOD MORNING, STUDENT" : hour < 18 ? "GOOD AFTERNOON, STUDENT" : "GOOD EVENING, STUDENT";
  document.body.classList.toggle("dark",state.theme==="dark");
  renderAll();
})();