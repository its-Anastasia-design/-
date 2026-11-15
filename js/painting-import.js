"use strict";
(() => {
  const button = document.getElementById("import-painting");
  button.addEventListener("click", () => {
    const already = state.tasks.filter(task => task.id.startsWith("painting-2026-")).length;
    const exists = state.projects.some(project => project.id === "painting-2026");
    if (!exists) state.projects.push({ id: "painting-2026", name: "Живопись · просмотр", color: "rose" });
    const known = new Set(state.tasks.map(task => task.id));
    const additions = PAINTING_PLAN.filter(task => !known.has(task.id));
    state.tasks.push(...additions);
    activeProject = "painting-2026";
    if (typeof plannerView !== "undefined") plannerView = "week";
    if (typeof calendarDate !== "undefined") calendarDate = "2026-11-16";
    persist();
    render();
    if (typeof renderCalendar === "function") {
      // View selection is refreshed through the regular renderer.
    }
    announce(additions.length ? `План живописи добавлен: ${additions.length} задач.` : "План живописи уже добавлен, ваши отметки сохранены.");
    button.textContent = already ? "✓ План живописи открыт" : "✓ План живописи добавлен";
  });
  if (state.projects.some(project => project.id === "painting-2026")) button.textContent = "✓ Открыть план живописи";
})();
