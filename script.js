// Step 1: calendar skeleton. Step 2: current weather + geolocation/city search.
// Weather+geocoding data: Open-Meteo (https://open-meteo.com/), free, no API key.
// Step 3 (daily forecast overlay on calendar cells) comes next.

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

const WEATHER_CODES = {
  0: ["☀️", "晴朗"],
  1: ["🌤️", "大部晴朗"],
  2: ["⛅", "局部多云"],
  3: ["☁️", "阴天"],
  45: ["🌫️", "雾"],
  48: ["🌫️", "霜雾"],
  51: ["🌦️", "小毛毛雨"],
  53: ["🌦️", "毛毛雨"],
  55: ["🌦️", "大毛毛雨"],
  56: ["🌧️", "冻雨(小)"],
  57: ["🌧️", "冻雨"],
  61: ["🌧️", "小雨"],
  63: ["🌧️", "中雨"],
  65: ["🌧️", "大雨"],
  66: ["🌧️", "冻雨(小)"],
  67: ["🌧️", "冻雨(大)"],
  71: ["🌨️", "小雪"],
  73: ["🌨️", "中雪"],
  75: ["🌨️", "大雪"],
  77: ["🌨️", "雪粒"],
  80: ["🌦️", "阵雨(小)"],
  81: ["🌦️", "阵雨"],
  82: ["⛈️", "强阵雨"],
  85: ["🌨️", "阵雪(小)"],
  86: ["🌨️", "阵雪(大)"],
  95: ["⛈️", "雷雨"],
  96: ["⛈️", "雷雨伴冰雹"],
  99: ["⛈️", "强雷雨伴冰雹"],
};

function weatherIcon(code) { return (WEATHER_CODES[code] || ["❓", "未知"])[0]; }
function weatherDesc(code) { return (WEATHER_CODES[code] || ["❓", "未知"])[1]; }

const state = {
  viewYear: new Date().getFullYear(),
  viewMonth: new Date().getMonth(), // 0-indexed
  lat: null,
  lon: null,
  placeName: "",
  current: null, // { temp, code, wind, time }
};

const els = {
  monthLabel: document.getElementById("month-label"),
  yearLabel: document.getElementById("year-label"),
  weekdayRow: document.getElementById("weekday-row"),
  calendarGrid: document.getElementById("calendar-grid"),
  prevBtn: document.getElementById("prev-month"),
  nextBtn: document.getElementById("next-month"),
  todayBtn: document.getElementById("today-btn"),

  searchForm: document.getElementById("search-form"),
  cityInput: document.getElementById("city-input"),
  locateBtn: document.getElementById("locate-btn"),
  weatherDisplay: document.getElementById("weather-display"),
  weatherContent: document.querySelector(".weather-content"),
  weatherError: document.getElementById("weather-error"),
  cwIcon: document.getElementById("cw-icon"),
  cwTemp: document.getElementById("cw-temp"),
  cwDesc: document.getElementById("cw-desc"),
  cwPlace: document.getElementById("cw-place"),
  cwWind: document.getElementById("cw-wind"),
  cwUpdated: document.getElementById("cw-updated"),
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

// ---------- Step 2: weather + geolocation/search ----------

async function geocodeCity(name) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=zh`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("地理编码请求失败");
  const data = await res.json();
  if (!data.results || data.results.length === 0) {
    throw new Error(`未找到城市 "${name}"`);
  }
  const r = data.results[0];
  return {
    lat: r.latitude,
    lon: r.longitude,
    name: [r.name, r.admin1, r.country].filter(Boolean).join(", "),
  };
}

async function fetchCurrentWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("天气数据请求失败");
  return res.json();
}

function setWeatherLoading() {
  els.weatherDisplay.classList.add("is-loading");
  els.weatherContent.hidden = true;
  els.weatherError.hidden = true;
}

function setWeatherError(message) {
  els.weatherDisplay.classList.remove("is-loading");
  els.weatherContent.hidden = true;
  els.weatherError.hidden = false;
  els.weatherError.textContent = message;
}

function renderCurrentWeather() {
  els.weatherDisplay.classList.remove("is-loading");
  els.weatherError.hidden = true;
  els.weatherContent.hidden = false;

  const c = state.current;
  els.cwIcon.textContent = weatherIcon(c.code);
  els.cwTemp.textContent = `${Math.round(c.temp)}°C`;
  els.cwDesc.textContent = weatherDesc(c.code);
  els.cwPlace.textContent = state.placeName;
  els.cwWind.textContent = c.wind;
  els.cwUpdated.textContent = new Date(c.time).toLocaleString("zh-CN", {
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

async function loadWeatherFor(lat, lon, placeName) {
  setWeatherLoading();
  try {
    const data = await fetchCurrentWeather(lat, lon);
    state.lat = lat;
    state.lon = lon;
    state.placeName = placeName || `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
    state.current = {
      temp: data.current_weather.temperature,
      code: data.current_weather.weathercode,
      wind: data.current_weather.windspeed,
      time: data.current_weather.time,
    };
    renderCurrentWeather();
  } catch (err) {
    setWeatherError(err.message || "获取天气失败");
  }
}

els.searchForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const city = els.cityInput.value.trim();
  if (!city) return;
  setWeatherLoading();
  try {
    const loc = await geocodeCity(city);
    await loadWeatherFor(loc.lat, loc.lon, loc.name);
  } catch (err) {
    setWeatherError(err.message || "查找城市失败");
  }
});

els.locateBtn.addEventListener("click", () => {
  if (!navigator.geolocation) {
    setWeatherError("当前浏览器不支持定位");
    return;
  }
  setWeatherLoading();
  navigator.geolocation.getCurrentPosition(
    (pos) => loadWeatherFor(pos.coords.latitude, pos.coords.longitude, "当前位置"),
    () => setWeatherError("无法获取位置，请手动搜索城市"),
    { timeout: 10000 }
  );
});

// Initial load: try geolocation, fall back to a default city.
if (navigator.geolocation) {
  setWeatherLoading();
  navigator.geolocation.getCurrentPosition(
    (pos) => loadWeatherFor(pos.coords.latitude, pos.coords.longitude, "当前位置"),
    () => {
      geocodeCity("Seoul")
        .then((loc) => loadWeatherFor(loc.lat, loc.lon, loc.name))
        .catch((err) => setWeatherError(err.message));
    },
    { timeout: 8000 }
  );
} else {
  geocodeCity("Seoul")
    .then((loc) => loadWeatherFor(loc.lat, loc.lon, loc.name))
    .catch((err) => setWeatherError(err.message));
}
