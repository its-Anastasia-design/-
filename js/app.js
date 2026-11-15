"use strict";

const byId = id => document.getElementById(id);
const loaded = loadState();
const state = loaded.state;
const board = byId("board");
const projectNav = byId("projects");
const search = byId("search");
const priorityFilter = byId("priority-filter");
const deadlineFilter = byId("deadline-filter");
const resetFilters = byId("reset-filters");
let activeProject = "";
let draggingTask = "";

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
    const count = project.id ? state.tasks.filter(task => task.projectId === project.id).length : state.tasks.length;
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
    projectNav.append(row);
  }
}

function focusProject(id) {
  [...projectNav.querySelectorAll(".project-button")].find(button => button.dataset.project === id)?.focus();
}

function renderTask(task, today) {
  const card = element("article", "card");
  card.dataset.task = task.id;
  const top = element("div", "card-top");
  const project = state.projects.find(item => item.id === task.projectId);
  top.append(element("span", "badge", project?.name ?? "Без проекта"));
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
  card.append(meta);
  return card;
}

function render() {
  renderProjects();
  const project = state.projects.find(item => item.id === activeProject);
  const scoped = project ? state.tasks.filter(task => task.projectId === project.id) : state.tasks;
  byId("board-title").textContent = project?.name ?? "Доска задач";
  const done = scoped.filter(task => task.status === "done").length;
  byId("progress-text").textContent = scoped.length ? `Готово ${done} из ${scoped.length}` : "Здесь пока нет задач";
  const progress = byId("progress");
  progress.hidden = !scoped.length;
  progress.max = scoped.length || 1;
  progress.value = done;

  const today = dateKey();
  board.replaceChildren();
  for (const [status, name] of Object.entries(statuses)) {
    const tasks = scoped.filter(task => task.status === status);
    const column = element("section", "column");
    column.dataset.status = status;
    const heading = element("h2", "", name);
    heading.id = `column-${status}`;
    column.setAttribute("aria-labelledby", heading.id);
    const header = element("div", "column-head");
    const statusColor = { todo: colors.sand, doing: colors.rose, done: colors.sage };
    header.append(dot(statusColor[status]), heading, element("span", "count", tasks.length));
    const cards = element("div", "cards");
    cards.append(...tasks.map(task => renderTask(task, today)));
    if (!tasks.length) cards.append(element("p", "empty", "Пока нет задач"));
    column.append(header, cards);
    board.append(column);
  }
}

notice(loaded.problem);
persist();
render();
