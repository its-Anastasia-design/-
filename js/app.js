"use strict";

const byId = id => document.getElementById(id);
const loaded = loadState();
const state = loaded.state;
state.habits ??= [];
const board = byId("board");
const projectNav = byId("projects");
const search = byId("search");
const priorityFilter = byId("priority-filter");
const deadlineFilter = byId("deadline-filter");
const resetFilters = byId("reset-filters");
let activeProject = "";
let draggingTask = "";
const taskDialog = byId("task-dialog");
const taskForm = byId("task-form");
const confirmDialog = byId("confirm-dialog");
const projectDialog = byId("project-dialog");
const projectForm = byId("project-form");
let editingTaskId = "";
let editingProjectId = "";
let confirmedAction;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function icon(text, label, action) {
  const button = element("button", "icon", text);
  button.type = "button";
  button.title = label;
  button.setAttribute("aria-label", label);
  button.addEventListener("click", action);
  return button;
}

function dot(color) {
  const node = element("span", "dot");
  node.style.setProperty("--dot", color);
  node.setAttribute("aria-hidden", "true");
  return node;
}

function notice(message) {
  const banner = byId("storage-error");
  banner.textContent = message;
  banner.hidden = !message;
}

function announce(message) {
  byId("announcement").textContent = message;
}

function persist() {
  if (loaded.problem) return;
  try {
    saveState(state);
    notice("");
  } catch {
    notice("Браузер не смог сохранить изменения. Они доступны в этой вкладке до перезагрузки.");
  }
}

function renderProjects() {
  const all = { id: "", name: "Все проекты", color: "sand" };
  projectNav.replaceChildren();
  for (const project of [all, ...state.projects]) {
    const row = element("div", "project-row");
    const button = element("button", "project-button");
    const count = state.tasks.filter(task => !task.deleted && (!project.id || task.projectId === project.id)).length;
    button.type = "button";
    button.dataset.project = project.id;
    button.setAttribute("aria-current", String(activeProject === project.id));
    button.append(dot(colors[project.color]), element("span", "label", project.name), element("span", "project-count", count));
    button.addEventListener("click", () => {
      activeProject = project.id;
      render();
      focusProject(activeProject);
    });
    row.append(button);
    if (project.id) row.append(icon("⋯", `Редактировать проект «${project.name}»`, () => openProject(project)));
    projectNav.append(row);
  }
}

function focusProject(id) {
  [...projectNav.querySelectorAll(".project-button")].find(button => button.dataset.project === id)?.focus();
}

function renderTask(task, today) {
  const card = element("article", "card");
  card.dataset.task = task.id;
  card.draggable = true;
  card.addEventListener("dragstart", event => {
    draggingTask = task.id;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", task.id);
    card.classList.add("is-dragging");
  });
  card.addEventListener("dragend", clearDrag);
  const top = element("div", "card-top");
  const project = state.projects.find(item => item.id === task.projectId);
  top.append(element("span", "badge", project?.name ?? "Без проекта"));
  const edit = icon("✎", `Редактировать задачу «${task.title}»`, () => openTask(task));
  edit.classList.add("edit-task");
  top.append(edit);
  card.append(top, element("h3", "", task.title));
  if (task.description) card.append(element("p", "", task.description));
  const meta = element("div", "card-meta");
  meta.append(element("span", `badge ${task.priority}`, priorities[task.priority]));
  if (task.due) {
    const overdue = task.status !== "done" && task.due < today;
    const date = new Date(`${task.due}T12:00:00`);
    const label = new Intl.DateTimeFormat("ru", { day: "numeric", month: "short", year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric" }).format(date);
    const time = element("time", overdue ? "overdue" : "", overdue ? `Просрочено · ${label}` : `До ${label}`);
    time.dateTime = task.due;
    meta.append(time);
  }
  const statusLabel = element("label", "", "Статус");
  const status = element("select", "task-status-control");
  status.setAttribute("aria-label", `Статус задачи «${task.title}»`);
  fillSelect(status, Object.entries(statuses));
  status.value = task.status;
  status.addEventListener("change", () => moveTask(task.id, status.value));
  statusLabel.append(status);
  card.append(meta, statusLabel);
  card.append(taskChecklist(task));
  if (task.kind === "subscription") card.append(element("p", "", money(task.amount)));
  return card;
}

function render() {
  byId("habits").hidden = plannerView !== "habits";
  document.querySelector(".toolbar").hidden = plannerView === "habits";
  byId("new-task").hidden = plannerView === "habits";
  if (plannerView === "habits") {
    board.hidden = true;
    byId("calendar").hidden = true;
    renderHabits();
    return;
  }
  renderProjects();
  const project = state.projects.find(item => item.id === activeProject);
  const scoped = state.tasks.filter(task => !task.deleted && (!project || task.projectId === project.id));
  byId("board-title").textContent = project?.name ?? "Доска задач";
  const done = scoped.filter(task => task.status === "done").length;
  byId("progress-text").textContent = scoped.length ? `Готово ${done} из ${scoped.length}` : "Здесь пока нет задач";
  const progress = byId("progress");
  progress.hidden = !scoped.length;
  progress.max = scoped.length || 1;
  progress.value = done;

  const today = dateKey();
  const query = search.value.trim().toLocaleLowerCase("ru");
  const priority = priorityFilter.value;
  const deadline = deadlineFilter.value;
  const filtering = Boolean(query || priority || deadline);
  resetFilters.hidden = !filtering;
  const visible = scoped.filter(task =>
    (!query || `${task.title} ${task.description}`.toLocaleLowerCase("ru").includes(query)) &&
    (!priority || task.priority === priority) && (plannerView !== "board" || matchesDeadline(task, deadline, today)));
  board.hidden = plannerView !== "board";
  byId("calendar").hidden = !board.hidden;
  if (board.hidden) {
    board.replaceChildren();
    renderCalendar(visible, today);
    return;
  }
  board.replaceChildren();
  for (const [status, name] of Object.entries(statuses)) {
    const tasks = visible.filter(task => task.status === status);
    const column = element("section", "column");
    column.dataset.status = status;
    column.addEventListener("dragover", event => {
      if (!draggingTask) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      column.classList.add("is-over");
    });
    column.addEventListener("dragleave", event => {
      if (!column.contains(event.relatedTarget)) column.classList.remove("is-over");
    });
    column.addEventListener("drop", event => {
      if (!draggingTask) return;
      event.preventDefault();
      const id = draggingTask;
      clearDrag();
      moveTask(id, status);
    });
    const heading = element("h2", "", name);
    heading.id = `column-${status}`;
    column.setAttribute("aria-labelledby", heading.id);
    const header = element("div", "column-head");
    const statusColor = { todo: colors.sand, doing: colors.rose, done: colors.sage };
    header.append(dot(statusColor[status]), heading, element("span", "count", tasks.length),
      icon("+", `Добавить задачу в «${name}»`, () => openTask(null, status)));
    const cards = element("div", "cards");
    cards.append(...tasks.map(task => renderTask(task, today)));
    if (!tasks.length) cards.append(element("p", "empty", filtering ? "Нет подходящих задач" : "Пока нет задач"));
    column.append(header, cards);
    board.append(column);
  }
}

function matchesDeadline(task, filter, today) {
  switch (filter) {
    case "overdue": return !!task.due && task.status !== "done" && task.due < today;
    case "today": return task.due === today;
    case "upcoming": return task.due > today;
    case "none": return !task.due;
    default: return true;
  }
}

search.addEventListener("input", render);
priorityFilter.addEventListener("change", render);
deadlineFilter.addEventListener("change", render);
resetFilters.addEventListener("click", () => {
  search.value = "";
  priorityFilter.value = "";
  deadlineFilter.value = "";
  render();
  search.focus();
});

function fillSelect(select, pairs) {
  select.replaceChildren(...pairs.map(([value, name]) => new Option(name, value)));
}

function openTask(task, status = "todo", due = "") {
  if (task?.virtual) task = materialize(task);
  editingTaskId = task?.id ?? "";
  byId("task-dialog-title").textContent = task ? "Редактировать задачу" : "Новая задача";
  fillSelect(byId("task-project"), [["", "Без проекта"], ...state.projects.map(project => [project.id, project.name])]);
  fillSelect(byId("task-status"), Object.entries(statuses));
  fillSelect(byId("task-priority"), Object.entries(priorities));
  const fields = taskForm.elements;
  fields.title.setCustomValidity("");
  fields.title.value = task?.title ?? "";
  fields.description.value = task?.description ?? "";
  fields.projectId.value = task?.projectId ?? activeProject;
  fields.status.value = task?.status ?? status;
  fields.priority.value = task?.priority ?? "medium";
  fields.due.value = task?.due ?? due;
  fields.kind.value = task?.kind ?? "task";
  fields.repeat.value = task?.repeat ?? "";
  fields.repeat.disabled = !!task?.seriesId;
  fields.amount.value = task?.amount ?? "";
  fields.steps.value = (task?.subtasks ?? []).map(step => step.title).join("\n");
  byId("repeat-help").textContent = task?.seriesId ? "Изменения относятся только к этому повторению. Для настройки серии откройте исходную задачу." : "Изменения исходной задачи применяются к будущим повторениям. Для повтора укажите первую дату.";
  syncTaskKind(false);
  byId("delete-task").hidden = !task;
  taskDialog.showModal();
}

function taskControl(id, selector) {
  return [...board.querySelectorAll(".card")].find(card => card.dataset.task === id)?.querySelector(selector);
}

function update(message, focus) {
  persist();
  render();
  announce(message);
  focus?.();
}

function clearDrag() {
  draggingTask = "";
  board.querySelectorAll(".is-over, .is-dragging").forEach(node =>
    node.classList.remove("is-over", "is-dragging"));
}

function moveTask(id, status) {
  const task = state.tasks.find(item => item.id === id);
  if (!task || task.status === status) return;
  task.status = status;
  update(`Статус задачи обновлён. ${statuses[status]}.`, () =>
    (taskControl(id, ".task-status-control") ?? byId("new-task")).focus());
}

function confirmDeletion(message, action) {
  byId("confirm-text").textContent = message;
  confirmedAction = action;
  confirmDialog.returnValue = "";
  confirmDialog.showModal();
}

confirmDialog.addEventListener("close", () => {
  if (confirmDialog.returnValue === "delete") confirmedAction?.();
  confirmedAction = undefined;
});

function validateName(input) {
  if (input.value.trim()) return true;
  input.setCustomValidity("Введите название.");
  input.reportValidity();
  return false;
}

taskForm.elements.title.addEventListener("input", event => event.target.setCustomValidity(""));
taskForm.addEventListener("submit", event => {
  event.preventDefault();
  if (!validateName(taskForm.elements.title)) return;
  const values = Object.fromEntries(new FormData(taskForm));
  if (values.repeat && !values.due) {
    taskForm.elements.due.required = true;
    taskForm.elements.due.reportValidity();
    return;
  }
  const previous = state.tasks.find(item => item.id === editingTaskId);
  const task = {
    ...previous, ...values, id: editingTaskId || newId(),
    subtasks: values.steps.split("\n").map(title => title.trim()).filter(Boolean).map((title, index) => ({
      title, done: previous?.subtasks?.[index]?.title === title && previous.subtasks[index].done || false,
    })),
    title: values.title.trim(), description: values.description.trim(),
  };
  const index = state.tasks.findIndex(item => item.id === editingTaskId);
  if (index < 0) state.tasks.push(task);
  else state.tasks[index] = task;
  taskDialog.close();
  update(index < 0 ? "Задача добавлена." : "Задача обновлена.", () =>
    (taskControl(task.id, ".edit-task") ?? calendarTaskControl(task.id) ?? byId("new-task")).focus());
});

byId("delete-task").addEventListener("click", () => {
  const task = state.tasks.find(item => item.id === editingTaskId);
  confirmDeletion(`Удалить задачу «${task.title}»?${task.repeat ? " Будущие повторения серии также будут удалены." : ""}`, () => {
    if (task.seriesId) {
      task.deleted = true;
    } else {
      state.tasks = state.tasks.filter(item => item.id !== task.id && item.seriesId !== task.id);
    }
    taskDialog.close();
    update("Задача удалена.", () => (calendarDayControl() ?? byId("new-task")).focus());
  });
});

function openProject(project) {
  editingProjectId = project?.id ?? "";
  byId("project-dialog-title").textContent = project ? "Редактировать проект" : "Новый проект";
  const name = projectForm.elements.namedItem("name");
  name.setCustomValidity("");
  name.value = project?.name ?? "";
  projectForm.elements.color.value = project?.color ?? "rose";
  byId("delete-project").hidden = !project;
  projectDialog.showModal();
}

const projectName = projectForm.elements.namedItem("name");
projectName.addEventListener("input", event => event.target.setCustomValidity(""));
projectForm.addEventListener("submit", event => {
  event.preventDefault();
  if (!validateName(projectName)) return;
  const name = projectName.value.trim();
  const duplicate = state.projects.some(project =>
    project.id !== editingProjectId && project.name.toLocaleLowerCase("ru") === name.toLocaleLowerCase("ru"));
  if (duplicate) {
    projectName.setCustomValidity("Проект с таким названием уже есть.");
    projectName.reportValidity();
    return;
  }
  const color = projectForm.elements.color.value;
  const existing = state.projects.find(project => project.id === editingProjectId);
  const project = existing ?? { id: newId() };
  Object.assign(project, { name, color });
  if (!existing) {
    state.projects.push(project);
    activeProject = project.id;
  }
  projectDialog.close();
  update(existing ? "Проект обновлён." : "Проект добавлен.", () => focusProject(project.id));
});

byId("delete-project").addEventListener("click", () => {
  const project = state.projects.find(item => item.id === editingProjectId);
  confirmDeletion(`Удалить проект «${project.name}»? Его задачи останутся на доске с пометкой «Без проекта».`, () => {
    state.projects = state.projects.filter(item => item.id !== project.id);
    for (const task of state.tasks) {
      if (task.projectId === project.id) task.projectId = "";
    }
    if (activeProject === project.id) activeProject = "";
    projectDialog.close();
    update("Проект удалён.", () => focusProject(activeProject));
  });
});

byId("new-project").addEventListener("click", () => openProject(null));
document.querySelectorAll("[data-close]").forEach(button =>
  button.addEventListener("click", () => button.closest("dialog").close()));
byId("new-task").addEventListener("click", () => openTask(null, "todo", plannerView === "board" ? "" : calendarDate));

initExtras();
initCalendar();
notice(loaded.problem);
persist();
render();
