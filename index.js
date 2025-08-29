const els = {
  projectForm: document.getElementById("projectForm"),
  projectName: document.getElementById("projectName"),
  projectList: document.getElementById("projectList"),
  deleteProject: document.getElementById("deleteProject"),

  taskForm: document.getElementById("taskForm"),
  taskTitle: document.getElementById("taskTitle"),
  taskDeadline: document.getElementById("taskDeadline"),
  taskList: document.getElementById("taskList"),

  currentProjectName: document.getElementById("currentProjectName"),
  projectCounts: document.getElementById("projectCounts"),
  projectProgress: document.getElementById("projectProgress"),

  completeAll: document.getElementById("completeAll"),

  filters: document.querySelector(".filters"),
  finishedCount: document.getElementById("finishedCount"),

  toasts: document.getElementById("toasts"),
  toggleReminders: document.getElementById("toggleReminders"),
};

const STORAGE_KEY = "taskmgr:v1";

const store = {
  data: { projects: [], activeProjectId: null, remindersOn: false },
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) this.data = JSON.parse(raw);
    } catch {}
  },
  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
  },
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function toast(title, body) {
  const t = document.createElement("div");
  t.className = "toast";
  t.innerHTML = `<strong>${title}</strong>${body ? `<small>${body}</small>` : ""}`;
  els.toasts.appendChild(t);
  setTimeout(() => t.remove(), 4200);
}

function getActiveProject() {
  return (
    store.data.projects.find((p) => p.id === store.data.activeProjectId) || null
  );
}

function recalcProject(p) {
  const total = p.tasks.length;
  const done = p.tasks.filter((t) => t.completed).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return { total, done, pct };
}

function renderProjects() {
  els.projectList.innerHTML = "";
  store.data.projects.forEach((p) => {
    const { total, done } = recalcProject(p);
    const item = document.createElement("button");
    item.type = "button";
    item.className =
      "project-item" + (p.id === store.data.activeProjectId ? " active" : "");
    item.setAttribute("role", "listitem");
    item.innerHTML = `
<div class="project-header">
<div style="font-weight:700;">${p.name}</div>
<span class="badge">${done}/${total} done</span>
</div>
<div class="progress" aria-hidden="true"><span style="width:${total ? (done / total) * 100 : 0}%"></span></div>
`;
    item.addEventListener("click", () => {
      store.data.activeProjectId = p.id;
      store.save();
      renderAll();
    });
    els.projectList.appendChild(item);
  });
}

let lastProgressByProject = new Map();

function renderTasks() {
  const p = getActiveProject();
  els.taskList.innerHTML = "";
  if (!p) {
    els.currentProjectName.textContent = "No project selected";
    els.projectCounts.textContent = "0/0 done";
    els.projectProgress.style.width = "0%";
    els.finishedCount.textContent = "0";
    return;
  }

  els.currentProjectName.textContent = p.name;

  // Filter
  const activeFilter =
    document.querySelector(".filters button.active")?.dataset.filter || "all";
  const tasks = p.tasks.filter((t) => {
    if (activeFilter === "completed") return t.completed;
    if (activeFilter === "pending") return !t.completed;
    return true;
  });

  // Stats + progress
  const { total, done, pct } = recalcProject(p);
  els.projectCounts.textContent = `${done}/${total} done`;
  els.projectProgress.style.width = pct + "%";
  els.finishedCount.textContent = done;

  // Notify when project progress changes
  const prev = lastProgressByProject.get(p.id) ?? pct;
  if (prev !== pct) {
    toast("Project progress updated", `${p.name} is now ${pct}% complete`);
    lastProgressByProject.set(p.id, pct);
  }

  // Tasks UI
  tasks.forEach((task) => {
    const row = document.createElement("div");
    row.className = "task";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = task.deadline ? new Date(task.deadline) : null;
    const overdue = due && !task.completed && due < today;
    if (overdue) row.classList.add("overdue");

    row.innerHTML = `
<input type="checkbox" aria-label="Toggle complete" ${task.completed ? "checked" : ""} />
<div>
<div class="title ${task.completed ? "done" : ""}">${task.title}</div>
<div class="meta">Due: ${task.deadline || "—"}</div>
</div>
<div class="actions">
<button class="ghost" data-act="edit">Edit</button>
<button class="danger" data-act="delete">Delete</button>
</div>
`;

    const checkbox = row.querySelector('input[type="checkbox"]');
    checkbox.addEventListener("change", () => {
      task.completed = checkbox.checked;
      store.save();
      renderAll();
      if (task.completed)
        toast("Task completed", `"${task.title}" marked done`);
    });

    row.querySelector('[data-act="delete"]').addEventListener("click", () => {
      p.tasks = p.tasks.filter((t) => t.id !== task.id);
      store.save();
      renderAll();
    });

    row.querySelector('[data-act="edit"]').addEventListener("click", () => {
      const title = prompt("Edit task title", task.title);
      if (title === null) return;
      const deadline = prompt("Edit deadline (YYYY-MM-DD)", task.deadline);
      if (deadline === null) return;
      task.title = title.trim() || task.title;
      task.deadline = deadline || task.deadline;
      store.save();
      renderAll();
    });

    els.taskList.appendChild(row);
  });
}

function renderAll() {
  renderProjects();
  renderTasks();
}

// --- Event wiring ---
els.projectForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = els.projectName.value.trim();
  if (!name) return;
  const p = { id: uid(), name, tasks: [] };
  store.data.projects.unshift(p);
  store.data.activeProjectId = p.id;
  els.projectName.value = "";
  store.save();
  renderAll();
  toast("Project created", `${p.name} added`);
});

els.deleteProject.addEventListener("click", () => {
  const p = getActiveProject();
  if (!p) return;
  if (!confirm(`Delete project "${p.name}" and its tasks?`)) return;
  store.data.projects = store.data.projects.filter((x) => x.id !== p.id);
  if (store.data.activeProjectId === p.id)
    store.data.activeProjectId = store.data.projects[0]?.id || null;
  store.save();
  renderAll();
  toast("Project deleted", `${p.name} removed`);
});

els.taskForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const p = getActiveProject();
  if (!p) {
    toast("Select a project first");
    return;
  }
  const title = els.taskTitle.value.trim();
  const deadline = els.taskDeadline.value;
  if (!title || !deadline) return;
  p.tasks.unshift({ id: uid(), title, deadline, completed: false });
  els.taskTitle.value = "";
  els.taskDeadline.value = "";
  store.save();
  renderAll();
  toast("Task added", `"${title}" due ${deadline}`);
});

els.completeAll.addEventListener("click", () => {
  const p = getActiveProject();
  if (!p) return;
  p.tasks.forEach((t) => (t.completed = true));
  store.save();
  renderAll();
  toast("All tasks completed", `${p.name} 100% done`);
});

els.filters.addEventListener("click", (e) => {
  if (e.target.tagName !== "BUTTON") return;
  els.filters.querySelectorAll("button").forEach((b) => {
    b.classList.remove("active");
    b.setAttribute("aria-selected", "false");
  });
  e.target.classList.add("active");
  e.target.setAttribute("aria-selected", "true");
  renderTasks();
});

// --- Reminders (interval) ---
let reminderTimer = null;
function reminderTick() {
  const now = new Date();
  const soon = new Date(now.getTime() + 60 * 60 * 1000); // within 1 hour
  for (const p of store.data.projects) {
    for (const t of p.tasks) {
      if (t.completed) continue;
      if (!t.deadline) continue;
      const d = new Date(t.deadline);
      const overdue = d < now.setHours(0, 0, 0, 0);
      const dueSoon = d >= new Date() && d <= soon;
      if (overdue) {
        toast("Overdue task", `"${t.title}" in ${p.name} is overdue`);
      } else if (dueSoon) {
        toast("Upcoming deadline", `"${t.title}" due ${t.deadline}`);
      }
    }
  }
}

function startReminders() {
  if (reminderTimer) return;
  reminderTimer = setInterval(reminderTick, 30000); // every 30s for demo
  store.data.remindersOn = true;
  store.save();
  els.toggleReminders.textContent = "Stop Reminders";
  els.toggleReminders.setAttribute("aria-pressed", "true");
  toast("Reminders started");
}

function stopReminders() {
  if (!reminderTimer) return;
  clearInterval(reminderTimer);
  reminderTimer = null;
  store.data.remindersOn = false;
  store.save();
  els.toggleReminders.textContent = "Start Reminders";
  els.toggleReminders.setAttribute("aria-pressed", "false");
  toast("Reminders stopped");
}

els.toggleReminders.addEventListener("click", () => {
  if (reminderTimer) stopReminders();
  else startReminders();
});

// --- Init ---
store.load();
renderAll();
if (store.data.remindersOn) startReminders();
