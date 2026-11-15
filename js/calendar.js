"use strict";

const dayNames = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const fullDate = new Intl.DateTimeFormat("ru", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const monthTitle = new Intl.DateTimeFormat("ru", { month: "long", year: "numeric" });
const weekTitle = new Intl.DateTimeFormat("ru", { day: "numeric", month: "short", year: "numeric" });
let plannerView = "board";
let calendarDate = dateKey();
let calendarDragId = "";
let calendarDropTime = 0;

function asDate(key) {
  return new Date(`${key}T12:00:00`);
}

function addDays(date, count) {
  const result = new Date(date);
  result.setDate(result.getDate() + count);
  return result;
}

function monday(date) {
  return addDays(date, -((date.getDay() + 6) % 7));
}

function initCalendar() {
  const buttons = [...document.querySelectorAll("[data-view]")];
  for (const button of buttons) {
    button.addEventListener("click", () => {
      plannerView = button.dataset.view;
      for (const item of buttons) item.setAttribute("aria-pressed", String(item === button));
      render();
    });
  }
  byId("calendar-prev").addEventListener("click", () => shiftCalendar(-1));
  byId("calendar-next").addEventListener("click", () => shiftCalendar(1));
  byId("calendar-today").addEventListener("click", () => {
    calendarDate = dateKey();
    render();
  });
}

function shiftCalendar(direction) {
  const date = asDate(calendarDate);
  if (plannerView === "week") {
    calendarDate = calendarKey(addDays(date, 7 * direction));
  } else {
    date.setDate(1);
    date.setMonth(date.getMonth() + direction);
    calendarDate = calendarKey(date);
  }
  render();
}

function calendarDayControl() {
  return byId("calendar").hidden ? null :
    byId("calendar-grid").querySelector(".is-selected .calendar-day-select");
}

function calendarTaskControl(id) {
  if (byId("calendar").hidden) return null;
  return [...byId("calendar").querySelectorAll(".calendar-task")]
    .find(button => button.dataset.task === id && button.getClientRects().length);
}

function calendarTask(task, today, compact) {
  const button = element("button", compact ? "calendar-task compact" : "calendar-task");
  button.type = "button";
  button.dataset.task = task.id;
  button.dataset.priority = task.priority;
  button.dataset.status = task.status;
  const project = state.projects.find(item => item.id === task.projectId);
  const overdue = task.due && task.due < today && task.status !== "done";
  const details = [project?.name, statuses[task.status], priorities[task.priority], overdue ? "Просрочено" : ""].filter(Boolean);
  button.title = [task.title, ...details].join(" · ");
  button.setAttribute("aria-label", button.title);
  button.append(dot(colors[project?.color] ?? colors.sand), element("span", "calendar-task-title", task.title));
  if (!compact) button.append(element("span", "calendar-task-meta", details.join(" · ")));
  button.draggable = true;
  button.addEventListener("dragstart", event => {
    calendarDragId = task.id;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", task.id);
    button.classList.add("is-dragging");
  });
  button.addEventListener("dragend", clearCalendarDrag);
  button.addEventListener("click", () => {
    if (Date.now() - calendarDropTime > 300) openTask(task);
  });
  return button;
}

function clearCalendarDrag() {
  calendarDragId = "";
  byId("calendar").querySelectorAll(".is-over, .is-dragging").forEach(node =>
    node.classList.remove("is-over", "is-dragging"));
}

function dropCalendarTask(event, key) {
  if (!calendarDragId) return;
  event.preventDefault();
  const task = state.tasks.find(item => item.id === calendarDragId);
  clearCalendarDrag();
  calendarDropTime = Date.now();
  if (!task || task.due === key) return;
  task.due = key;
  calendarDate = key;
  update(`Задача перенесена на ${fullDate.format(asDate(key))}.`, () =>
    (calendarTaskControl(task.id) ?? calendarDayControl())?.focus());
}

function renderCalendar(tasks, today) {
  const focusDate = asDate(calendarDate);
  const isMonth = plannerView === "month";
  const first = new Date(focusDate);
  first.setDate(1);
  const last = new Date(first);
  last.setMonth(first.getMonth() + 1, 0);
  const start = monday(isMonth ? first : focusDate);
  const end = addDays(isMonth ? monday(last) : start, 6);
  byId("calendar-title").textContent = isMonth ? monthTitle.format(focusDate) :
    `${weekTitle.format(start)} — ${weekTitle.format(end)}`;
  const period = isMonth ? "месяц" : "неделя";
  byId("calendar-prev").setAttribute("aria-label", `Назад (${period})`);
  byId("calendar-next").setAttribute("aria-label", `Вперёд (${period})`);
  const byDate = new Map();
  for (const task of tasks) {
    if (!byDate.has(task.due)) byDate.set(task.due, []);
    byDate.get(task.due).push(task);
  }

  const grid = byId("calendar-grid");
  grid.className = `calendar-grid calendar-${plannerView}`;
  const weekdays = dayNames.map(name => element("span", "calendar-weekday", name));
  const days = [];
  for (let date = start; date <= end; date = addDays(date, 1)) {
    const key = calendarKey(date);
    days.push(calendarDay(date, key, byDate.get(key) ?? [], today, isMonth && date.getMonth() !== focusDate.getMonth()));
  }
  grid.replaceChildren(...weekdays, ...days);

  const agendaTitle = element("h3", "", fullDate.format(focusDate));
  agendaTitle.id = "agenda-title";
  agendaTitle.tabIndex = -1;
  const add = icon("+", `Добавить задачу на ${fullDate.format(focusDate)}`, () => openTask(null, "todo", calendarDate));
  const header = element("div", "agenda-header");
  header.append(agendaTitle, add);
  const selected = byDate.get(calendarDate) ?? [];
  const agenda = byId("calendar-agenda");
  agenda.replaceChildren(header, ...calendarList(selected, today, "На этот день нет задач по текущим фильтрам."));
  byId("calendar-undated").replaceChildren(...calendarList(byDate.get("") ?? [], today, "Нет задач без срока."));
}

function calendarList(tasks, today, emptyText) {
  return tasks.length ? tasks.map(task => calendarTask(task, today, false)) :
    [element("p", "empty", emptyText)];
}

function calendarDay(date, key, tasks, today, outside) {
  const day = element("div", "calendar-day");
  day.dataset.date = key;
  day.addEventListener("dragover", event => {
    if (!calendarDragId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    day.classList.add("is-over");
  });
  day.addEventListener("dragleave", event => {
    if (!day.contains(event.relatedTarget)) day.classList.remove("is-over");
  });
  day.addEventListener("drop", event => dropCalendarTask(event, key));
  if (outside) day.classList.add("outside");
  if (key === today) day.classList.add("is-today");
  if (key === calendarDate) day.classList.add("is-selected");
  const select = element("button", "calendar-day-select", String(date.getDate()));
  select.type = "button";
  const label = fullDate.format(date);
  select.setAttribute("aria-label", `Добавить задачу на ${label}`);
  select.title = select.getAttribute("aria-label");
  if (key === today) select.setAttribute("aria-current", "date");
  day.addEventListener("click", event => {
    if (Date.now() - calendarDropTime <= 300) return;
    if (event.target.closest(".calendar-task, .calendar-day-count")) return;
    calendarDate = key;
    render();
    calendarDayControl()?.focus();
    openTask(null, "todo", key);
  });
  const weekday = element("span", "calendar-mobile-weekday", dayNames[(date.getDay() + 6) % 7]);
  weekday.setAttribute("aria-hidden", "true");
  select.prepend(weekday);
  const header = element("div", "calendar-day-header");
  header.append(select);
  if (tasks.length) {
    const count = element("button", "calendar-day-count", String(tasks.length));
    count.type = "button";
    count.setAttribute("aria-label", `Показать задачи на ${label}. Всего: ${tasks.length}.`);
    count.title = count.getAttribute("aria-label");
    count.addEventListener("click", () => {
      calendarDate = key;
      render();
      byId("agenda-title").focus();
    });
    header.append(count);
  }
  day.append(header, ...tasks.map(task => calendarTask(task, today, true)));
  return day;
}
