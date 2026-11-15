"use strict";

let habitOffset = 0;
let editingHabitId = "";
const money = value => new Intl.NumberFormat("ru", { style: "currency", currency: "RUB" }).format(Number(value) || 0);

function occurrenceDate(task, index) {
  const base = asDate(task.due);
  if (task.repeat === "daily") return calendarKey(addDays(base, index));
  if (task.repeat === "weekly") return calendarKey(addDays(base, index * 7));
  const day = base.getDate();
  base.setDate(1);
  if (task.repeat === "monthly") base.setMonth(base.getMonth() + index);
  else base.setFullYear(base.getFullYear() + index);
  const end = new Date(base);
  end.setMonth(end.getMonth() + 1, 0);
  base.setDate(Math.min(day, end.getDate()));
  return calendarKey(base);
}

function calendarOccurrences(tasks, start, end) {
  const from = calendarKey(start);
  const to = calendarKey(end);
  const result = tasks.filter(task => !task.deleted);
  for (const task of tasks) {
    if (!task.repeat || !task.due || task.seriesId || task.deleted) continue;
    const base = asDate(task.due);
    let index = 1;
    if (task.repeat === "daily" || task.repeat === "weekly") {
      const interval = task.repeat === "daily" ? 1 : 7;
      index = Math.max(1, Math.floor((start - base) / 86400000 / interval) - 2);
    } else if (task.repeat === "monthly") {
      index = Math.max(1, (start.getFullYear() - base.getFullYear()) * 12 + start.getMonth() - base.getMonth() - 1);
    } else {
      index = Math.max(1, start.getFullYear() - base.getFullYear() - 1);
    }
    for (let due = occurrenceDate(task, index); due <= to; due = occurrenceDate(task, ++index)) {
      if (due < from) continue;
      const id = task.id + "@" + due;
      if (state.tasks.some(item => item.id === id)) continue;
      result.push({
        ...task, id, due, seriesId: task.id, repeat: "", virtual: true, status: "todo",
        subtasks: (task.subtasks ?? []).map(step => ({ title: step.title, done: false })),
      });
    }
  }
  return result;
}

function materialize(task) {
  const existing = state.tasks.find(item => item.id === task.id);
  if (existing) return existing;
  const copy = { ...task, virtual: false };
  state.tasks.push(copy);
  persist();
  return copy;
}

function taskChecklist(task) {
  const list = element("div", "checklist");
  if (!task.subtasks?.length) return list;
  const summary = element("p", "checklist-summary");
  const refreshSummary = () => {
    summary.textContent = `Шаги: ${task.subtasks.filter(step => step.done).length} из ${task.subtasks.length}`;
  };
  refreshSummary();
  list.append(summary);
  for (const [index, step] of (task.subtasks ?? []).entries()) {
    const label = element("label", "check-item");
    const checkbox = element("input");
    checkbox.type = "checkbox";
    checkbox.checked = step.done;
    checkbox.setAttribute("aria-label", step.title);
    checkbox.addEventListener("change", () => {
      const saved = task.virtual ? materialize(task) : task;
      saved.subtasks[index].done = checkbox.checked;
      step.done = checkbox.checked;
      refreshSummary();
      persist();
      announce(step.done ? "Подзадача выполнена." : "Отметка снята.");
    });
    label.append(checkbox, element("span", "", step.title));
    list.append(label);
  }
  return list;
}

function syncTaskKind(defaultRepeat) {
  const fields = taskForm.elements;
  const kind = fields.kind.value;
  byId("amount-field").hidden = kind !== "subscription";
  fields.amount.required = kind === "subscription";
  fields.due.required = !!fields.repeat.value || kind !== "task";
  if (defaultRepeat && !fields.repeat.disabled) {
    fields.repeat.value = { birthday: "yearly", subscription: "monthly", task: "" }[kind];
    fields.due.required = !!fields.repeat.value;
  }
}

function initExtras() {
  byId("habit-edit-form").addEventListener("submit", event => {
    event.preventDefault();
    const input = event.target.elements.title;
    if (!validateName(input)) return;
    const habit = state.habits.find(item => item.id === editingHabitId);
    if (!habit) return;
    habit.title = input.value.trim();
    byId("habit-dialog").close();
    update("Название привычки обновлено.");
  });
  byId("habit-edit-form").elements.title.addEventListener("input", event => event.target.setCustomValidity(""));
  taskForm.elements.kind.addEventListener("change", () => syncTaskKind(true));
  taskForm.elements.repeat.addEventListener("change", () => syncTaskKind(false));
  byId("habit-form").addEventListener("submit", event => {
    event.preventDefault();
    const input = event.target.elements.title;
    const title = input.value.trim();
    if (!title) return;
    state.habits.push({ id: newId(), title, days: {} });
    input.value = "";
    update("Привычка добавлена.");
  });
  byId("habit-prev").addEventListener("click", () => { habitOffset -= 7; renderHabits(); });
  byId("habit-next").addEventListener("click", () => { habitOffset += 7; renderHabits(); });
  byId("habit-today").addEventListener("click", () => { habitOffset = 0; renderHabits(); });
}

function renderHabits() {
  const start = addDays(monday(asDate(dateKey())), habitOffset);
  byId("board-title").textContent = "Мои привычки";
  byId("progress-text").textContent = "Небольшие действия каждый день";
  byId("progress").hidden = true;
  byId("habit-period").textContent = weekTitle.format(start) + " — " + weekTitle.format(addDays(start, 6));
  const list = byId("habit-list");
  list.replaceChildren();
  if (!state.habits.length) list.append(element("p", "empty", "Добавьте первую привычку и отмечайте дни, когда удалось её выполнить."));
  for (const habit of state.habits) {
    const row = element("article", "habit-row");
    const head = element("div", "agenda-header");
    head.append(element("h3", "", habit.title), icon("✎", "Изменить привычку «" + habit.title + "»", () => {
      editingHabitId = habit.id;
      const input = byId("habit-edit-form").elements.title;
      input.value = habit.title;
      input.setCustomValidity("");
      byId("habit-dialog").showModal();
    }), icon("×", "Удалить привычку «" + habit.title + "»", () =>
      confirmDeletion("Удалить привычку и все её отметки?", () => {
        state.habits = state.habits.filter(item => item.id !== habit.id);
        update("Привычка удалена.");
      })));
    row.append(head);
    const days = element("div", "habit-days");
    for (let i = 0; i < 7; i++) {
      const date = addDays(start, i);
      const key = calendarKey(date);
      const label = element("label", "habit-day", dayNames[i] + " " + date.getDate());
      const input = element("input");
      input.type = "checkbox";
      input.checked = !!habit.days[key];
      input.setAttribute("aria-label", habit.title + ", " + fullDate.format(date));
      input.addEventListener("change", () => {
        habit.days[key] = input.checked;
        persist();
        announce("Отметка привычки сохранена.");
      });
      label.append(input);
      days.append(label);
    }
    row.append(days);
    list.append(row);
  }
}
