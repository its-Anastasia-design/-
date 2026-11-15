"use strict";

function renderHome() {
  const home = byId("home");
  const today = dateKey();
  const start = monday(asDate(today));
  const end = addDays(start, 6);
  const tasks = calendarOccurrences(state.tasks.filter(task => !task.deleted), start, end);
  const week = tasks.filter(task => task.due >= calendarKey(start) && task.due <= calendarKey(end));
  const done = week.filter(task => task.status === "done").length;
  home.replaceChildren(element("h1", "home-title", "Мой прогресс"));
  const welcome = element("section", "home-welcome");
  const intro = element("div", "home-intro");
  const name = state.profile?.displayName?.trim();
  intro.append(element("p", "home-greeting", name ? `Привет, ${name}!` : "Привет!"),
    element("h2", "", "В своём темпе, шаг за шагом"),
    element("p", "", week.length ? `На этой неделе выполнено ${done} из ${week.length} дел.` : "На этой неделе пока нет запланированных дел."));
  const add = element("button", "primary", "＋ Новая задача");
  add.type = "button";
  add.addEventListener("click", () => openTask(null, "todo", today));
  intro.append(add);
  welcome.append(intro);
  for (const [name, color, matches] of [
    ["Учёба", "sand", task => task.category === "study"],
    ["Работа", "rose", task => task.category === "work"],
    ["Личные дела", "sage", task => !["study", "work"].includes(task.category)],
  ]) {
    const group = week.filter(matches);
    const completed = group.filter(task => task.status === "done").length;
    const card = element("div", "home-category " + color);
    const progress = element("progress");
    progress.max = group.length || 1;
    progress.value = completed;
    progress.setAttribute("aria-label", name + " — выполнено " + completed + " из " + group.length);
    card.append(element("h3", "", name), element("p", "", `Выполнено ${completed} из ${group.length}`), progress);
    welcome.append(card);
  }
  home.append(welcome);
  const layout = element("div", "home-layout");
  const left = element("div");
  const stats = element("div", "home-stats");
  const activity = element("article", "home-panel");
  activity.append(element("h2", "", "Планы на неделю"));
  const bars = element("div", "home-bars");
  for (let i = 0; i < 7; i++) {
    const key = calendarKey(addDays(start, i));
    const count = week.filter(task => task.due === key).length;
    const item = element("div", "home-bar");
    item.append(element("span", "", String(count)));
    const bar = element("div", "home-bar-fill");
    bar.style.height = Math.max(4, Math.min(80, count * 12)) + "px";
    item.append(bar, element("span", "", dayNames[i]));
    bars.append(item);
  }
  activity.append(bars);
  stats.append(activity);
  left.append(stats, element("h2", "home-section-title", "Дела на сегодня"));
  const todays = tasks.filter(task => task.due === today).sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));
  if (!todays.length) left.append(element("p", "empty", "На сегодня пока нет задач. Можно оставить время для себя."));
  for (const task of todays) left.append(calendarTask(task, today, false));
  const mini = element("aside", "home-panel home-mini");
  const date = asDate(today);
  mini.append(element("h2", "", monthTitle.format(date)));
  const grid = element("div", "home-mini-grid");
  const first = new Date(date);
  first.setDate(1);
  const last = new Date(date);
  last.setMonth(last.getMonth() + 1, 0);
  const monthTasks = calendarOccurrences(state.tasks.filter(task => !task.deleted), first, last);
  for (const name of dayNames) grid.append(element("span", "calendar-weekday", name));
  for (let i = 0; i < (first.getDay() + 6) % 7; i++) grid.append(element("span"));
  for (let n = 1; n <= last.getDate(); n++) {
    const day = new Date(first);
    day.setDate(n);
    const key = calendarKey(day);
    const count = monthTasks.filter(task => task.due === key).length;
    const button = element("button", key === today ? "mini-today" : "", String(n));
    button.type = "button";
    button.setAttribute("aria-label", fullDate.format(day) + ". Задач: " + count);
    if (count) button.append(element("span", "mini-dot", "•"));
    button.addEventListener("click", () => {
      calendarDate = key;
      navigateHome("month");
    });
    grid.append(button);
  }
  mini.append(grid, element("p", "form-help", "Выберите день, чтобы открыть календарь. Точкой отмечены дни с задачами."));
  layout.append(left, mini);
  home.append(layout);
}

function navigateHome(view) {
  plannerView = view;
  render();
}

function initProfile() {
  const dialog = byId("profile-dialog");
  const form = byId("profile-form");
  byId("profile-settings").addEventListener("click", () => {
    form.elements.displayName.value = state.profile?.displayName ?? "";
    dialog.showModal();
  });
  form.addEventListener("submit", event => {
    event.preventDefault();
    state.profile = { ...state.profile, displayName: form.elements.displayName.value.trim() };
    dialog.close();
    update("Настройки сохранены.", () => byId("profile-settings").focus());
  });
}
