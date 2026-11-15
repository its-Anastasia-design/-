"use strict";

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
  taskForm.elements.kind.addEventListener("change", () => syncTaskKind(true));
  taskForm.elements.repeat.addEventListener("change", () => syncTaskKind(false));
}
