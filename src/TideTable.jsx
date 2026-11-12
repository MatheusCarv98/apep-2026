import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, RefreshCw, Waves } from "lucide-react";

const TIME_ZONE = "America/Fortaleza";
const STATION_PATH = "ticon/natal-202c-bra-uhslc_rq";
const STORAGE_KEY = "apep-tides-natal-v1";
const MAX_AGE_MS = 12 * 60 * 60 * 1000;
const API_ROOT = "https://api.openwaters.io/tides/stations";

function todayLocal() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const part = (type) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function shiftDate(date, days) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function localDateOf(iso) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(iso));
  const part = (type) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function formatTime(iso) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

function formatTimestamp(iso) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

function formatDate(date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIME_ZONE, weekday: "long", day: "2-digit", month: "long", year: "numeric",
  }).format(new Date(`${date}T12:00:00-03:00`));
}

function isoLocalStart(date) {
  return `${date}T00:00:00-03:00`;
}

function buildUrl(kind, date) {
  const url = new URL(`${API_ROOT}/${STATION_PATH}/${kind}`);
  url.searchParams.set("start", isoLocalStart(date));
  url.searchParams.set("end", isoLocalStart(shiftDate(date, 1)));
  url.searchParams.set("units", "meters");
  return url;
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

function validatePayload(events, series, date) {
  const dayEvents = (events?.extremes || []).filter((item) => localDateOf(item.time) === date);
  const daySeries = (series?.timeline || []).filter((item) => localDateOf(item.time) === date);
  if (!dayEvents.length || !daySeries.length) {
    throw new Error("A fonte não retornou dados completos para esta data.");
  }
  if (dayEvents.some((item) => !Number.isFinite(Number(item.level))) || daySeries.some((item) => !Number.isFinite(Number(item.level)))) {
    throw new Error("A fonte retornou valores de maré inválidos.");
  }
  return {
    date,
    datum: events.datum || series.datum || "Referência não informada",
    station: events.station || series.station,
    events: dayEvents.map((item) => ({
      time: item.time,
      height: Number(item.level),
      type: item.high ? "alta" : item.low ? "baixa" : item.label?.toLowerCase() === "high" ? "alta" : "baixa",
    })),
    curve: daySeries.map((item) => {
      const local = new Date(item.time);
      const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", hourCycle: "h23" }).format(local));
      const minute = Number(new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, minute: "2-digit" }).format(local));
      return { time: item.time, hour: hour + minute / 60, height: Number(item.level) };
    }),
  };
}

function readCache(date) {
  try {
    const saved = JSON.parse(localStorage.getItem(`${STORAGE_KEY}:${date}`));
    if (saved?.date && saved?.events?.length && saved?.curve?.length && saved?.fetchedAt) return saved;
  } catch { /* cache ausente ou inválido */ }
  return null;
}

function TideTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return <div className="tide-chart-tooltip"><strong>{formatTime(point.time)}</strong><span>{point.height.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m</span></div>;
}

export default function TideTable({ compact = false }) {
  const [date, setDate] = useState(todayLocal);
  const [saved, setSaved] = useState(() => readCache(todayLocal()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retrievedAt, setRetrievedAt] = useState(saved?.fetchedAt || null);
  const [now, setNow] = useState(Date.now());

  const fetchTides = useCallback(async (targetDate, { background = false } = {}) => {
    if (!background) setLoading(true);
    setError("");
    try {
      const [extremesResponse, timelineResponse] = await Promise.all([
        fetchWithTimeout(buildUrl("extremes", targetDate)),
        fetchWithTimeout(buildUrl("timeline", targetDate)),
      ]);
      if (!extremesResponse.ok || !timelineResponse.ok) throw new Error("A fonte de marés está temporariamente indisponível.");
      const [extremes, timeline] = await Promise.all([extremesResponse.json(), timelineResponse.json()]);
      const parsed = validatePayload(extremes, timeline, targetDate);
      const next = { ...parsed, fetchedAt: new Date().toISOString() };
      setSaved(next);
      setRetrievedAt(next.fetchedAt);
      try { localStorage.setItem(`${STORAGE_KEY}:${targetDate}`, JSON.stringify(next)); } catch { /* armazenamento indisponível; mantém dados em memória */ }
    } catch (cause) {
      setError(cause?.name === "AbortError" ? "A consulta demorou demais. Tente novamente." : cause?.message || "Não foi possível consultar as marés agora.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cached = readCache(date);
    setSaved(cached);
    setRetrievedAt(cached?.fetchedAt || null);
  }, [date]);
  useEffect(() => { fetchTides(date); }, [date, fetchTides]);
  useEffect(() => {
    const refresh = window.setInterval(() => {
      setNow(Date.now());
      fetchTides(date, { background: true });
    }, 6 * 60 * 60 * 1000);
    const clock = window.setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => { window.clearInterval(refresh); window.clearInterval(clock); };
  }, [date, fetchTides]);

  const currentData = saved?.date === date ? saved : null;
  const stale = !retrievedAt || now - new Date(retrievedAt).getTime() > MAX_AGE_MS;
  const selectedDay = useMemo(() => formatDate(date), [date]);
  const localClock = useMemo(() => {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(now));
    return { hour: Number(parts.find((item) => item.type === "hour")?.value), minute: Number(parts.find((item) => item.type === "minute")?.value) };
  }, [now]);
  const selectedMoment = new Date(`${date}T${String(localClock.hour).padStart(2, "0")}:${String(localClock.minute).padStart(2, "0")}:00-03:00`).getTime();
  const nextTide = useMemo(() => currentData?.events.find((event) => new Date(event.time).getTime() > selectedMoment), [currentData, selectedMoment]);
  const phaseSample = useMemo(() => {
    if (!currentData?.curve?.length) return null;
    const hour = localClock.hour + localClock.minute / 60;
    let index = currentData.curve.findIndex((point) => point.hour >= hour);
    if (index < 0) index = currentData.curve.length - 1;
    const point = currentData.curve[index];
    const next = currentData.curve[Math.min(index + 1, currentData.curve.length - 1)];
    return { rising: next.height >= point.height, height: point.height };
  }, [currentData, localClock]);
  const chartDomain = currentData?.curve?.length ? [
    Math.min(0, Math.floor(currentData.curve[0].hour)),
    Math.max(24, Math.ceil(currentData.curve[currentData.curve.length - 1].hour)),
  ] : [0, 24];
  const maxDate = shiftDate(todayLocal(), 365);
  const dateLabel = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });

  if (compact) {
    return (
      <section className="home-tide-card">
        <div className="home-tide-heading"><div><span className="home-eyebrow">PREVISÃO HARMÔNICA</span><strong>Tábua de marés · Natal</strong></div><Waves size={21} /></div>
        {currentData ? <>
          <div className="home-tide-next"><span>{nextTide ? `Próxima ${nextTide.type}` : "Eventos do dia"}</span><strong>{nextTide ? `${formatTime(nextTide.time)} · ${nextTide.height.toFixed(2)} m` : `${currentData.events.length} eventos previstos`}</strong></div>
          <div className="home-tide-events">{currentData.events.slice(0, 4).map((event, index) => <span key={`${event.time}-${index}`}>{event.type === "alta" ? "↑" : "↓"} {formatTime(event.time)} · {event.height.toFixed(2)} m</span>)}</div>
        </> : <div className="home-tide-empty">{loading ? "Consultando previsão…" : error || "Previsão indisponível no momento."}</div>}
        <div className="home-tide-footer"><span>{stale ? "Dados desatualizados" : retrievedAt ? `Consultado às ${dateLabel.format(new Date(retrievedAt))}` : "Fonte Open Waters · TICON-4"}</span><button type="button" onClick={() => fetchTides(date)} aria-label="Atualizar tábua de marés" disabled={loading}><RefreshCw size={13} className={loading ? "animate-spin" : ""} /></button></div>
      </section>
    );
  }

  return (
    <section className="tide-table-card">
      <div className="tide-table-header">
        <div className="tide-table-title"><span className="tide-icon"><Waves size={19} /></span><div><div className="home-eyebrow">TÁBUA INTEGRADA · NATAL/RN</div><h2>Previsão de marés</h2></div></div>
        <button className="tide-refresh" type="button" onClick={() => fetchTides(date)} disabled={loading}><RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Atualizar</button>
      </div>

      <div className="tide-date-row">
        <button type="button" className="tide-date-arrow" onClick={() => setDate(shiftDate(date, -1))} disabled={date <= todayLocal()} aria-label="Dia anterior"><ChevronLeft size={17} /></button>
        <label className="tide-date-picker"><CalendarDays size={15} /><span>{selectedDay}</span><input aria-label="Data da previsão" type="date" min={todayLocal()} max={maxDate} value={date} onChange={(event) => event.target.value && setDate(event.target.value)} /></label>
        <button type="button" className="tide-date-arrow" onClick={() => setDate(shiftDate(date, 1))} disabled={date >= maxDate} aria-label="Próximo dia"><ChevronRight size={17} /></button>
      </div>

      {loading && !currentData && <div className="tide-message"><RefreshCw size={16} className="animate-spin" /> Consultando previsões harmônicas para Natal…</div>}
      {error && <div className={`tide-message ${currentData ? "tide-message-warning" : "tide-message-error"}`}><AlertTriangle size={16} /> {error}{currentData && " Exibindo a última consulta salva para esta data."}</div>}
      {stale && currentData && <div className="tide-message tide-message-warning"><AlertTriangle size={16} /> Consulta desatualizada. A última atualização foi em {formatTimestamp(retrievedAt)}.</div>}

      {currentData && <>
        <div className="tide-status"><span className={`tide-status-dot ${phaseSample?.rising ? "is-rising" : "is-ebb"}`} />{phaseSample ? `Às ${String(localClock.hour).padStart(2, "0")}:${String(localClock.minute).padStart(2, "0")}, maré ${phaseSample.rising ? "enchendo" : "vazando"} · ${phaseSample.height.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m` : "Fase da maré indisponível"}<span className="tide-status-separator">·</span><span>referência {currentData.datum}</span></div>
        <div className="tide-chart-wrap">
          <div className="tide-chart-heading"><strong>Variação ao longo do dia</strong><span>altura em metros</span></div>
          <div className="tide-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={currentData.curve} margin={{ top: 12, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="#eaf0e7" vertical={false} />
                <XAxis type="number" dataKey="hour" domain={chartDomain} ticks={[0, 4, 8, 12, 16, 20, 24]} tickFormatter={(value) => `${String(value % 24).padStart(2, "0")}h`} axisLine={false} tickLine={false} tick={{ fill: "#87948a", fontSize: 10 }} />
                <YAxis domain={["dataMin - 0.15", "dataMax + 0.15"]} width={42} tickFormatter={(value) => value.toFixed(1)} axisLine={false} tickLine={false} tick={{ fill: "#87948a", fontSize: 10 }} />
                <Tooltip content={<TideTooltip />} />
                <Line type="monotone" dataKey="height" stroke="#18844c" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: "#0B5E22", stroke: "#fff", strokeWidth: 2 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="tide-events-heading"><strong>Marés altas e baixas</strong><span>{currentData.events.length} eventos</span></div>
        <div className="tide-events-grid">{currentData.events.map((event, index) => <div className="tide-event" key={`${event.time}-${index}`}><span className={`tide-event-icon ${event.type}`}>{event.type === "alta" ? "↑" : "↓"}</span><div className="tide-event-main"><strong>Maré {event.type}</strong><span>{formatTime(event.time)}</span></div><strong className="tide-event-height">{event.height.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <small>m</small></strong></div>)}</div>
      </>}

      {!currentData && !loading && <div className="tide-message tide-message-error"><AlertTriangle size={16} />{error || "Não há previsão disponível para a data selecionada."}</div>}

      <footer className="tide-attribution">
        <span>Fonte: previsões do Open Waters/Slackwater para a estação Natal. Constantes do TICON-4, baseadas no GESLA-4; dados harmônicos da estação: 1984–1985. Alturas referidas a {currentData?.datum || "MLWS"}.</span>
        <span>{currentData ? `Previsão para ${selectedDay} · última consulta ${retrievedAt ? formatTimestamp(retrievedAt) : "—"}` : "Previsões calculadas harmonicamente; atualização automática a cada 6 horas."}</span>
        <span>Hart-Davis, Dettmering e Seitz (2025), <a href="https://doi.org/10.17882/109129" target="_blank" rel="noreferrer">TICON-4 · SEANOE</a> · licença <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a> · previsão calculada pelo Open Waters/Slackwater · <a href="https://github.com/openwatersio/slackwater-database#modifications-to-source-data" target="_blank" rel="noreferrer">modificações</a></span>
        <small>Previsão astronômica aproximada. Ventos e pressão podem alterar o nível observado; não utilize para navegação.</small>
      </footer>
    </section>
  );
}

