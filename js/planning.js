"use strict";

const categories = {
  study: { name: "Учёба", color: "#95745c" },
  work: { name: "Работа", color: "#8b6685" },
  personal: { name: "Личное", color: "#a25948" },
  health: { name: "Здоровье", color: "#55724f" },
};
let lastParsedDate = null;
let dateBeforeTyping = {};
const deliveredReminders = new Set();

function decorateTask(node, task, compact = false) {
  const category = categories[task.category];
  if (!category) return;
  node.style.borderLeft = "4px solid " + category.color;
  if (!compact) node.append(element("span", "badge", category.name));
}

function parseTaskDate(text, now = new Date()) {
  const lower = text.toLocaleLowerCase("ru");
  const date = new Date(now);
  date.setHours(12, 0, 0, 0);
  let found = false;
  const relative = lower.match(/(?:^|\s)(послезавтра|завтра|сегодня)(?=\s|$|,)/u);
  if (relative) {
    date.setDate(date.getDate() + ({ сегодня: 0, завтра: 1, послезавтра: 2 }[relative[1]]));
    found = true;
  }
  const explicit = lower.match(/\b(\d{1,2})[.\/](\d{1,2})(?:[.\/](\d{4}))?\b/);
  const months = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  const written = lower.match(/(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?:\s+(\d{4}))?/u);
  const match = explicit || written;
  if (match) {
    const day = Number(match[1]);
    const month = explicit ? Number(match[2]) - 1 : months.indexOf(match[2]);
    const year = Number(match[3] || now.getFullYear());
    date.setFullYear(year, month, day);
    if (date.getDate() !== day || date.getMonth() !== month || year < 1000) return { error: "Такой даты нет. Проверьте число, месяц и год." };
    found = true;
  }
  const time = lower.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (!found) return { error: "Укажите дату, например «завтра в 15:00», «2.11.2027» или «2 ноября»." };
  return { due: calendarKey(date), time: time ? time[1].padStart(2, "0") + ":" + time[2] : "" };
}

function resetTypedDate() {
  lastParsedDate = null;
  dateBeforeTyping = { due: taskForm.elements.due.value, time: taskForm.elements.time.value };
}

function applyTypedDate() {
  const parsed = parseTaskDate(taskForm.elements.title.value);
  const fields = taskForm.elements;
  const next = parsed.error ? { due: "", time: "" } : parsed;
  for (const key of ["due", "time"]) {
    const previous = lastParsedDate?.[key] || "";
    if (next[key] && next[key] !== previous) {
      // Keep the value preceding automatic entry so removing the phrase restores it.
      if (!previous) dateBeforeTyping[key] = fields[key].value;
      fields[key].value = next[key];
    } else if (!next[key] && previous && fields[key].value === previous) {
      fields[key].value = dateBeforeTyping[key];
    }
  }
  lastParsedDate = next;
  byId("date-suggestion").textContent = parsed.error ? "" :
    "Дата из названия: " + fullDate.format(asDate(parsed.due)) + (parsed.time ? ", " + parsed.time : "") + ".";
}

function initPlanning() {
  taskForm.elements.title.addEventListener("input", applyTypedDate);
  byId("enable-notifications").addEventListener("click", async () => {
    const status = byId("notification-state");
    if (!("Notification" in window)) {
      status.textContent = "Браузер не поддерживает уведомления. Напоминания будут показаны внутри приложения.";
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      status.textContent = permission === "granted" ? "Уведомления разрешены, пока приложение открыто." : "Напоминания будут показаны внутри приложения.";
    } catch {
      status.textContent = "Не удалось включить уведомления. Напоминания доступны внутри приложения.";
    }
  });
  setInterval(checkReminders, 15000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) checkReminders(); });
  checkReminders();
}

function checkReminders() {
  const now = new Date();
  const tasks = calendarOccurrences(state.tasks.filter(task => !task.deleted), addDays(now, -1), addDays(now, 4));
  for (const task of tasks) {
    if (task.deleted || task.status === "done" || task.reminder === undefined || task.reminder === "" || !task.due || !task.time) continue;
    const eventTime = new Date(task.due + "T" + task.time);
    const alertTime = eventTime.getTime() - Number(task.reminder) * 60000;
    if (now.getTime() < alertTime || now.getTime() > eventTime.getTime() + 3600000) continue;
    const key = task.id + "|" + task.due + "|" + task.time + "|" + task.reminder;
    if (deliveredReminders.has(key)) continue;
    deliveredReminders.add(key);
    const text = task.title + " · " + task.due + " " + task.time;
    const banner = element("div", "notice");
    const open = element("button", "secondary", text);
    open.type = "button";
    open.addEventListener("click", () => {
      const latest = state.tasks.find(item => item.id === task.id) ?? (task.virtual ? task : null);
      if (latest && !latest.deleted && (!latest.seriesId || state.tasks.some(item => item.id === latest.seriesId))) openTask(latest);
    });
    banner.append(open, icon("×", "Закрыть напоминание", () => banner.remove()));
    byId("reminder-list").append(banner);
    if ("Notification" in window && Notification.permission === "granted") {
      try { new Notification("Лад", { body: text, tag: key }); } catch { /* The in-app reminder remains visible. */ }
    }
  }
}
