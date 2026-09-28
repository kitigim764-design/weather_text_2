// Step 1: calendar skeleton. Step 2: current weather + geolocation/city search.
// Step 3: daily forecast overlay on calendar cells, 24h hourly strip, per-day detail modal.
// Weather+geocoding data: Open-Meteo (https://open-meteo.com/), free, no API key.

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const WEEKDAYS_CN = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const MONTHS_EN = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

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
  current: null,      // { temp, code, wind, time }
  daily: null,        // { 'YYYY-MM-DD': { code, max, min, precip, windMax } }
  hourly: null,        // [{ time, temp, code, humidity, wind }, ...] sorted ascending
  selectedDate: null,  // 'YYYY-MM-DD' currently shown in the detail modal
};

const els = {
  monthLabel: document.getElementById("month-label"),
  yearLabel: document.getElementById("year-label"),
  weekdayRow: document.getElementById("weekday-row"),
  calendarGrid: document.getElementById("calendar-grid"),
  calendarViewport: document.querySelector(".calendar-grid-viewport"),
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

  hourlyScroll: document.getElementById("hourly-scroll"),
  hourlyEmpty: document.getElementById("hourly-empty"),

  dayModalOverlay: document.getElementById("day-modal-overlay"),
  dayModalClose: document.getElementById("day-modal-close"),
  dmIcon: document.getElementById("dm-icon"),
  dmDate: document.getElementById("dm-date"),
  dmDesc: document.getElementById("dm-desc"),
  dmTemp: document.getElementById("dm-temp"),
  dmHumidity: document.getElementById("dm-humidity"),
  dmWind: document.getElementById("dm-wind"),
  dmPrecip: document.getElementById("dm-precip"),
};

function pad(n) { return String(n).padStart(2, "0"); }
function dateKey(y, m, d) { return `${y}-${pad(m + 1)}-${pad(d)}`; }
function isSameDate(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function renderWeekdayRow() {
  els.weekdayRow.innerHTML = WEEKDAYS.map((w) => `<div>${w}</div>`).join("");
}

// ---------- calendar grid ----------

function renderCalendar(direction) {
  const { viewYear, viewMonth } = state;

  els.monthLabel.textContent = String(viewMonth + 1).padStart(2, "0") + " / " + MONTHS_EN[viewMonth];
  els.yearLabel.textContent = String(viewYear);

  const firstDay = new Date(viewYear, viewMonth, 1);
  const startOffset = firstDay.getDay(); // 0 = Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const remainder = (startOffset + daysInMonth) % 7;
  const trailing = remainder === 0 ? 0 : 7 - remainder;
  const totalCells = startOffset + daysInMonth + trailing;

  const gridStart = new Date(viewYear, viewMonth, 1 - startOffset);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const cells = [];
  for (let i = 0; i < totalCells; i++) {
    const cellDate = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    const dow = cellDate.getDay();
    cells.push(dayCellHtml(cellDate.getDate(), dateKey(cellDate.getFullYear(), cellDate.getMonth(), cellDate.getDate()), {
      otherMonth: cellDate.getMonth() !== viewMonth,
      isToday: isSameDate(cellDate, today),
      isWeekend: dow === 0 || dow === 6,
      isPast: cellDate < today,
    }));
  }

  // rebuild grid with a transition class so month changes feel animated
  const grid = document.createElement("div");
  grid.className = "calendar-grid month-grid" + (direction ? ` slide-${direction}` : "");
  grid.id = "calendar-grid";
  grid.innerHTML = cells.join("");

  els.calendarGrid.replaceWith(grid);
  els.calendarGrid = grid;
}

function dayCellHtml(day, key, { otherMonth = false, isToday = false, isWeekend = false, isPast = false } = {}) {
  const classes = ["day-cell"];
  if (otherMonth) classes.push("other-month");
  if (isToday) classes.push("today");
  if (isWeekend) classes.push("weekend");
  if (key === state.selectedDate) classes.push("selected");

  const forecast = state.daily ? state.daily[key] : null;
  let weatherHtml = '<div class="day-weather-placeholder"></div>';
  if (forecast) {
    classes.push("has-weather");
    weatherHtml = `
      <div class="day-weather-icon">${weatherIcon(forecast.code)}</div>
      <div class="day-weather-temp">
        <span class="temp-max">${Math.round(forecast.max)}°</span>
        <span class="temp-min">${Math.round(forecast.min)}°</span>
      </div>
    `;
  } else if (isPast) {
    // Data source only covers a limited past window (see PAST_DAYS) or the
    // request hasn't resolved yet — show a dimmed "history unavailable"
    // marker instead of leaving the cell looking broken/empty.
    classes.push("history-fallback");
    weatherHtml = `
      <div class="day-weather-icon history-icon">🕓</div>
      <div class="day-weather-temp history-label">历史</div>
    `;
  }

  return `
    <div class="${classes.join(" ")}" data-date="${key}">
      <div class="day-num">${day}</div>
      ${weatherHtml}
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

// clicking any day cell opens its detail modal; delegated on the viewport
// wrapper since #calendar-grid itself gets replaced on every render.
els.calendarViewport.addEventListener("click", (e) => {
  const cell = e.target.closest(".day-cell[data-date]");
  if (!cell) return;
  openDayDetail(cell.dataset.date);
});

renderWeekdayRow();
renderCalendar();

// ---------- weather + geolocation/search ----------

async function geocodeCity(name) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=zh`;
  let res;
  try {
    res = await fetch(url);
  } catch (networkErr) {
    console.error("geocodeCity network error:", networkErr);
    throw new Error("地理编码请求失败（网络错误）。若通过双击文件直接打开页面，请改用本地服务器（如 `python -m http.server`）后用 http://localhost 访问");
  }
  if (!res.ok) throw new Error(`地理编码请求失败 (HTTP ${res.status})`);
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

// How many days of actual (historical) weather to pull alongside the
// forecast, via Open-Meteo's `past_days` param on the same endpoint — no
// separate Historical Weather API/key needed. 31 comfortably covers "this
// month so far" and spills a little into the previous month too.
const PAST_DAYS = 31;

async function fetchForecast(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current_weather=true` +
    `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max` +
    `&hourly=temperature_2m,weathercode,relative_humidity_2m,windspeed_10m` +
    `&timezone=auto&forecast_days=16&past_days=${PAST_DAYS}`;
  let res;
  try {
    res = await fetch(url);
  } catch (networkErr) {
    console.error("fetchForecast network error:", networkErr);
    throw new Error("天气数据请求失败（网络错误）。若通过双击文件直接打开页面，请改用本地服务器（如 `python -m http.server`）后用 http://localhost 访问");
  }
  if (!res.ok) throw new Error(`天气数据请求失败 (HTTP ${res.status})`);
  return res.json();
}

// Wraps navigator.geolocation.getCurrentPosition in a Promise with a hard
// timeout, and never rejects — resolves to `null` on any failure so callers
// can always fall back to a default city instead of hanging forever.
function getPositionSafe(timeoutMs = 6000) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const hardTimeout = setTimeout(() => done(null), timeoutMs);
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => { clearTimeout(hardTimeout); done(pos); },
        (err) => { clearTimeout(hardTimeout); console.warn("geolocation error:", err); done(null); },
        { timeout: timeoutMs }
      );
    } catch (err) {
      console.warn("geolocation threw synchronously:", err);
      clearTimeout(hardTimeout);
      done(null);
    }
  });
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

// ---------- hourly strip ----------

function renderHourlyStrip() {
  if (!state.hourly || state.hourly.length === 0) {
    els.hourlyEmpty.hidden = false;
    return;
  }
  els.hourlyEmpty.hidden = true;

  const now = new Date();
  const nowKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:00`;
  let startIdx = state.hourly.findIndex((h) => h.time >= nowKey);
  if (startIdx === -1) startIdx = 0;

  const slice = state.hourly.slice(startIdx, startIdx + 24);
  els.hourlyScroll.innerHTML = slice.map((h, idx) => {
    const d = new Date(h.time);
    const label = idx === 0 ? "现在" : `${pad(d.getHours())}:00`;
    return `
      <div class="hour-card${idx === 0 ? " now" : ""}">
        <div class="hour-time">${label}</div>
        <div class="hour-icon">${weatherIcon(h.code)}</div>
        <div class="hour-temp">${Math.round(h.temp)}°</div>
      </div>
    `;
  }).join("");
}

// ---------- day detail modal ----------

function parseDateKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDateHuman(date) {
  return `${date.getMonth() + 1}月${date.getDate()}日 ${WEEKDAYS_CN[date.getDay()]}`;
}

function computeAvgHumidity(key) {
  if (!state.hourly) return null;
  const entries = state.hourly.filter((h) => h.time.startsWith(key));
  if (entries.length === 0) return null;
  const sum = entries.reduce((acc, h) => acc + h.humidity, 0);
  return Math.round(sum / entries.length);
}

function openDayDetail(key) {
  state.selectedDate = key;
  renderCalendar(); // re-render so the clicked cell shows the "selected" ring

  const dateObj = parseDateKey(key);
  els.dmDate.textContent = formatDateHuman(dateObj);

  const forecast = state.daily ? state.daily[key] : null;
  if (!forecast) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isPast = dateObj < today;
    els.dmIcon.textContent = isPast ? "🕓" : "❓";
    els.dmDesc.textContent = isPast
      ? `历史天气数据暂缺（数据源仅覆盖最近 ${PAST_DAYS} 天）`
      : "超出预报范围（最多支持未来 16 天）";
    els.dmTemp.textContent = "--";
    els.dmHumidity.textContent = "--";
    els.dmWind.textContent = "--";
    els.dmPrecip.textContent = "--";
  } else {
    els.dmIcon.textContent = weatherIcon(forecast.code);
    els.dmDesc.textContent = weatherDesc(forecast.code);
    els.dmTemp.textContent = `${Math.round(forecast.max)}° / ${Math.round(forecast.min)}°`;

    const humidity = computeAvgHumidity(key);
    els.dmHumidity.textContent = humidity != null ? `${humidity}%` : "--";
    els.dmWind.textContent = forecast.windMax != null ? `${Math.round(forecast.windMax)} km/h` : "--";
    els.dmPrecip.textContent = forecast.precip != null ? `${forecast.precip.toFixed(1)} mm` : "--";
  }

  els.dayModalOverlay.hidden = false;
}

function closeDayDetail() {
  els.dayModalOverlay.hidden = true;
}

els.dayModalClose.addEventListener("click", closeDayDetail);
els.dayModalOverlay.addEventListener("click", (e) => {
  if (e.target === els.dayModalOverlay) closeDayDetail();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !els.dayModalOverlay.hidden) closeDayDetail();
});

// ---------- orchestration ----------

async function loadWeatherFor(lat, lon, placeName) {
  setWeatherLoading();
  try {
    const data = await fetchForecast(lat, lon);
    state.lat = lat;
    state.lon = lon;
    state.placeName = placeName || `${lat.toFixed(2)}, ${lon.toFixed(2)}`;

    state.current = {
      temp: data.current_weather.temperature,
      code: data.current_weather.weathercode,
      wind: data.current_weather.windspeed,
      time: data.current_weather.time,
    };

    state.daily = {};
    const d = data.daily;
    for (let i = 0; i < d.time.length; i++) {
      state.daily[d.time[i]] = {
        code: d.weathercode[i],
        max: d.temperature_2m_max[i],
        min: d.temperature_2m_min[i],
        precip: d.precipitation_sum ? d.precipitation_sum[i] : null,
        windMax: d.windspeed_10m_max ? d.windspeed_10m_max[i] : null,
      };
    }

    const h = data.hourly;
    state.hourly = h.time.map((t, i) => ({
      time: t,
      temp: h.temperature_2m[i],
      code: h.weathercode[i],
      humidity: h.relative_humidity_2m[i],
      wind: h.windspeed_10m[i],
    }));

    state.selectedDate = null;
    if (!els.dayModalOverlay.hidden) closeDayDetail();

    renderCurrentWeather();
    renderHourlyStrip();
    renderCalendar();
  } catch (err) {
    setWeatherError(err.message || "获取天气失败");
  }
}

async function loadDefaultCity() {
  try {
    const loc = await geocodeCity("Seoul");
    await loadWeatherFor(loc.lat, loc.lon, loc.name);
  } catch (err) {
    setWeatherError(err.message || "获取默认城市天气失败");
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

els.locateBtn.addEventListener("click", async () => {
  setWeatherLoading();
  const pos = await getPositionSafe(10000);
  if (pos) {
    await loadWeatherFor(pos.coords.latitude, pos.coords.longitude, "当前位置");
  } else {
    // Geolocation denied/unavailable/timed out — always fall back to Seoul.
    await loadDefaultCity();
  }
});

// Initial load: try geolocation; on any failure (denied, unsupported, times
// out, insecure context, etc.) fall back to showing Seoul's weather so the
// panel and calendar are never left blank.
(async () => {
  setWeatherLoading();
  const pos = await getPositionSafe(8000);
  if (pos) {
    await loadWeatherFor(pos.coords.latitude, pos.coords.longitude, "当前位置");
  } else {
    await loadDefaultCity();
  }
})();
