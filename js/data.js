"use strict";

const STORAGE_KEY = "designflow.board.v1";
const statuses = { todo: "Запланировано", doing: "В работе", done: "Готово" };
const priorities = { high: "Высокий", medium: "Средний", low: "Низкий" };
const colors = { rose: "#ab6b61", sage: "#648060", clay: "#a2664f", sand: "#967957" };

function dateKey(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return calendarKey(date);
}

function calendarKey(date) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map(part => String(part).padStart(2, "0")).join("-");
}

function newId() {
  return globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function demoState() {
  const projects = [
    { id: "studio", name: "Айдентика студии", color: "rose" },
    { id: "portfolio", name: "Портфолио", color: "sage" },
    { id: "class", name: "Учебный проект", color: "clay" },
  ];
  const tasks = [
    ["Собрать мудборд", "Цвет, типографика и 5 визуальных референсов.", "studio", "todo", "high", 2],
    ["Обновить обложку кейса", "Подобрать первый экран для проекта.", "portfolio", "todo", "medium", 5],
    ["Сделать эскизы логотипа", "Проверить три идеи в чёрно-белом варианте.", "studio", "doing", "medium", 3],
    ["Собрать прототип", "Связать экраны для демонстрации.", "class", "doing", "low", null],
    ["Разобрать бриф", "Зафиксировать цели, аудиторию и формат сдачи.", "studio", "done", "low", null],
    ["Выбрать проекты для кейсов", "", "portfolio", "done", "medium", null],
  ].map(([title, description, projectId, status, priority, days], i) => ({
    id: `demo-${i}`, title, description, projectId, status, priority,
    due: days === null ? "" : dateKey(days),
  }));
  return { projects, tasks };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return { state: demoState(), problem: "" };
    const saved = JSON.parse(raw);
    if (!Array.isArray(saved?.tasks) || !Array.isArray(saved?.projects)) {
      throw new Error("Invalid board");
    }
    return { state: saved, problem: "" };
  } catch {
    return { state: { tasks: [], projects: [] }, problem: "Не удалось прочитать сохранённую доску. Изменения в этом сеансе будут доступны до закрытия страницы." };
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
