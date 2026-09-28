// Step 1: calendar skeleton only. No network calls, no weather data yet.
// Weather integration comes in Step 2 (current conditions) and Step 3 (daily overlay).

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

const state = {
  viewYear: new Date().getFullYear(),
  viewMonth: new Date().getMonth(), // 0-indexed
};

const els = {
  monthLabel: document.getElementById("month-label"),
  yearLabel: document.getElementById("year-label"),
  weekdayRow: document.getElementById("weekday-row"),
  calendarGrid: document.getElementById("calendar-grid"),
  prevBtn: document.getElementById("prev-month"),
  nextBtn: document.getElementById("next-month"),
  todayBtn: document.getElementById("today-btn"),
};

function pad(n) { return String(n).padStart(2, "0"); }

function renderWeekdayRow() {
  els.weekdayRow.innerHTML = WEEKDAYS.map((w) => `<div>${w}</div>`).join("");
}

function renderCalendar(direction) {
  const { viewYear, viewMonth } = state;

  els.monthLabel.textContent = String(viewMonth + 1).padStart(2, "0") + " / " +
    ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"][viewMonth];
  els.yearLabel.textContent = String(viewYear);

  const firstDay = new Date(viewYear, viewMonth, 1);
  const startOffset = firstDay.getDay(); // 0 = Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === viewYear && today.getMonth() === viewMonth;

  const cells = [];

  // leading days from previous month (visual continuity, muted)
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    cells.push(dayCellHtml(d, { otherMonth: true }));
  }

  // current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const dow = new Date(viewYear, viewMonth, day).getDay();
    const isToday = isCurrentMonth && today.getDate() === day;
    cells.push(dayCellHtml(day, {
      isToday,
      isWeekend: dow === 0 || dow === 6,
    }));
  }

  // trailing days from next month to fill the last row
  const totalCells = cells.length;
  const remainder = totalCells % 7;
  if (remainder !== 0) {
    const trailing = 7 - remainder;
    for (let d = 1; d <= trailing; d++) {
      cells.push(dayCellHtml(d, { otherMonth: true }));
    }
  }

  // rebuild grid with a transition class so month changes feel animated
  const grid = document.createElement("div");
  grid.className = "calendar-grid month-grid" + (direction ? ` slide-${direction}` : "");
  grid.id = "calendar-grid";
  grid.innerHTML = cells.join("");

  els.calendarGrid.replaceWith(grid);
  els.calendarGrid = grid;
}

function dayCellHtml(day, { otherMonth = false, isToday = false, isWeekend = false } = {}) {
  const classes = ["day-cell"];
  if (otherMonth) classes.push("other-month");
  if (isToday) classes.push("today");
  if (isWeekend) classes.push("weekend");

  return `
    <div class="${classes.join(" ")}">
      <div class="day-num">${day}</div>
      <div class="day-weather-placeholder"></div>
    </div>
  `;
}

function changeMonth(delta) {
  let m = state.viewMonth + delta;
  let y = state.viewYear;
  if (m < 0) { m = 11; y -= 1; }
  if (m > 11) { m = 0; y += 1; }
  state.viewYear = y;
  state.viewMonth = m;
  renderCalendar(delta > 0 ? "left" : "right");
}

function goToToday() {
  const now = new Date();
  const changed = state.viewYear !== now.getFullYear() || state.viewMonth !== now.getMonth();
  state.viewYear = now.getFullYear();
  state.viewMonth = now.getMonth();
  if (changed) renderCalendar();
}

els.prevBtn.addEventListener("click", () => changeMonth(-1));
els.nextBtn.addEventListener("click", () => changeMonth(1));
els.todayBtn.addEventListener("click", goToToday);

renderWeekdayRow();
renderCalendar();
