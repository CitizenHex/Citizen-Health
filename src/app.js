import { analyze, createExportBundle } from "./analysis.js";

const input = document.querySelector("#files");
const analyzeButton = document.querySelector("#analyze");
const selected = document.querySelector("#selected");
const selectionStatus = document.querySelector("#selection-status");
const liveFolderButton = document.querySelector("#choose-live-folder");
const monitorButton = document.querySelector("#monitor-live-folder");
const monitorStatus = document.querySelector("#monitor-status");
const keepHistory = document.querySelector("#keep-history");
const clearHistory = document.querySelector("#clear-history");
const historyStatus = document.querySelector("#history-status");
const historyList = document.querySelector("#history-list");
const snapshot = document.querySelector("#snapshot");
const session = document.querySelector("#session");
const timeline = document.querySelector("#session-timeline");
const supportedExtensions = /\.(log|txt|json|xml)$/i;
const maxTextFileSize = 25 * 1024 * 1024;
let report;
let liveDirectory;
let monitorTimer;
let lastObservedLog;
const historyKey = "citizen-health.session-history.v1";
const historyEnabledKey = "citizen-health.session-history-enabled.v1";

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(historyKey) || "[]"); } catch { return []; }
}

function saveHistory(records) {
  localStorage.setItem(historyKey, JSON.stringify(records.slice(0, 100)));
}

function renderHistory() {
  const records = loadHistory();
  historyList.replaceChildren(...records.map(record => {
    const item = document.createElement("li");
    item.textContent = `${record.startedAt} — ${record.outcome} (${record.findings.join(", ") || "no finding"})`;
    return item;
  }));
  historyStatus.textContent = keepHistory.checked
    ? `${records.length} local session record${records.length === 1 ? "" : "s"}. Raw logs are not retained.`
    : "History is off. Existing local records remain until deleted.";
}

function recordLatestSession(nextReport) {
  if (!keepHistory.checked) return;
  const startIndex = nextReport.sessionEvents.map(event => event.type).lastIndexOf("entered-game");
  if (startIndex < 0) return;
  const events = nextReport.sessionEvents.slice(startIndex);
  const startedAt = events[0].at;
  const lastEvent = events.at(-1);
  const record = {
    id: startedAt,
    startedAt,
    outcome: lastEvent.label,
    findings: nextReport.findings.map(finding => finding.title),
    updatedAt: nextReport.createdAt
  };
  const records = loadHistory().filter(existing => existing.id !== record.id);
  records.unshift(record);
  saveHistory(records);
  renderHistory();
}

function updateSelection() {
  const files = [...input.files];
  selectionStatus.textContent = files.length ? `${files.length} file${files.length === 1 ? "" : "s"} selected. Ready to analyze.` : "No files selected yet.";
  selected.replaceChildren(...files.map(file => Object.assign(document.createElement("li"), { textContent: `${file.name} (${Math.ceil(file.size / 1024)} KB)` })));
  analyzeButton.disabled = !files.length;
}

function renderKeyValues(container, values, suffix = "") {
  container.replaceChildren();
  for (const [label, value] of Object.entries(values)) {
    const item = document.createElement("div");
    const term = document.createElement("dt"); term.textContent = label.replace(/([A-Z])/g, " $1");
    const detail = document.createElement("dd"); detail.textContent = `${value}${suffix && label === "durationMinutes" ? suffix : ""}`;
    item.append(term, detail); container.append(item);
  }
}

function renderReport(nextReport, skipped = 0) {
  report = nextReport;
  recordLatestSession(report);
  document.querySelector("#summary").textContent = `${report.findings.length} finding${report.findings.length === 1 ? "" : "s"} from ${report.fileNames.length} analyzed text file${report.fileNames.length === 1 ? "" : "s"}.${report.skippedFileNames.length ? ` ${report.skippedFileNames.length} older Game log backup${report.skippedFileNames.length === 1 ? " was" : "s were"} left out; only the newest was analyzed.` : ""}${skipped ? ` ${skipped} unsupported, binary, or over-25 MB file${skipped === 1 ? " was" : "s were"} intentionally excluded.` : ""} Confidence describes evidence strength, not severity.`;
  document.querySelector("#findings").replaceChildren(...report.findings.map(finding => {
    const card = document.createElement("article");
    card.innerHTML = `<div><span class="confidence ${finding.confidence}">${finding.confidence} confidence</span><h3>${finding.title}</h3></div><p><strong>Evidence:</strong> ${finding.evidence}</p><p><strong>Next step:</strong> ${finding.action}</p><a href="${finding.link}" target="_blank" rel="noreferrer">Official remediation guidance</a>`;
    if (finding.evidenceLines.length) {
      const lines = document.createElement("pre"); lines.className = "evidence-lines";
      lines.textContent = finding.evidenceLines.join("\n"); card.append(lines);
    }
    return card;
  }));
  renderKeyValues(session, report.session, " min");
  document.querySelector("#session-section").classList.toggle("hidden", !session.children.length);
  timeline.replaceChildren(...report.sessionEvents.map(event => {
    const item = document.createElement("li");
    item.textContent = `${event.at} — ${event.label}`;
    return item;
  }));
  document.querySelector("#timeline-section").classList.toggle("hidden", !timeline.children.length);
  renderKeyValues(snapshot, report.hardwareSnapshot);
  document.querySelector("#snapshot-section").classList.toggle("hidden", !snapshot.children.length);
  document.querySelector("#redaction").textContent = report.redactedEvidence.slice(0, 5000);
  document.querySelector("#results").classList.remove("hidden");
}

async function fileForAnalysis(file) {
  return { name: file.name, text: await file.text(), lastModified: file.lastModified };
}

async function latestGameLogFrom(directory) {
  const entries = [];
  for await (const [name, handle] of directory.entries()) entries.push({ name, handle });
  const current = entries.find(entry => entry.handle.kind === "file" && entry.name.toLowerCase() === "game.log");
  if (current) return current.handle.getFile();
  const backups = entries.find(entry => entry.handle.kind === "directory" && entry.name.toLowerCase() === "logbackups");
  if (!backups) return undefined;
  const candidates = [];
  for await (const [name, handle] of backups.handle.entries()) if (handle.kind === "file" && /^game.*\.log$/i.test(name)) candidates.push(await handle.getFile());
  return candidates.toSorted((a, b) => b.lastModified - a.lastModified)[0];
}

async function checkLiveFolder() {
  if (!liveDirectory) return;
  const gameLog = await latestGameLogFrom(liveDirectory);
  if (!gameLog) { monitorStatus.textContent = "No Game.log or Game backup found in the selected LIVE folder."; return; }
  if (gameLog.size > maxTextFileSize) { monitorStatus.textContent = "The newest Game log is over 25 MB and was not read."; return; }
  const fingerprint = `${gameLog.name}:${gameLog.size}:${gameLog.lastModified}`;
  if (fingerprint === lastObservedLog) return;
  lastObservedLog = fingerprint;
  renderReport(analyze([await fileForAnalysis(gameLog)]));
  monitorStatus.textContent = `Monitoring this LIVE folder while Citizen Health stays open. Last analyzed: ${gameLog.name}.`;
}

input.addEventListener("change", updateSelection);
input.addEventListener("input", updateSelection);

keepHistory.checked = localStorage.getItem(historyEnabledKey) === "true";
renderHistory();
keepHistory.addEventListener("change", () => {
  localStorage.setItem(historyEnabledKey, String(keepHistory.checked));
  if (keepHistory.checked && report) recordLatestSession(report);
  renderHistory();
});
clearHistory.addEventListener("click", () => {
  if (!window.confirm("Delete all Citizen Health session history stored in this browser? This cannot be undone.")) return;
  localStorage.removeItem(historyKey);
  renderHistory();
});

analyzeButton.addEventListener("click", async () => {
  const allowed = [...input.files].filter(file => supportedExtensions.test(file.name) && file.size <= maxTextFileSize);
  if (!allowed.length) { selectionStatus.textContent = "No supported text files were selected."; return; }
  renderReport(analyze(await Promise.all(allowed.map(fileForAnalysis))), input.files.length - allowed.length);
});

liveFolderButton.addEventListener("click", async () => {
  if (!window.showDirectoryPicker) { monitorStatus.textContent = "Folder monitoring needs a current Chromium browser opened through Start-Citizen-Health.cmd."; return; }
  try {
    liveDirectory = await window.showDirectoryPicker({ mode: "read" });
    monitorButton.disabled = false;
    monitorStatus.textContent = `Selected ${liveDirectory.name}. Monitoring is off until you enable it.`;
  } catch (error) {
    if (error.name !== "AbortError") monitorStatus.textContent = "Citizen Health could not open that folder.";
  }
});

monitorButton.addEventListener("click", async () => {
  if (monitorTimer) { clearInterval(monitorTimer); monitorTimer = undefined; monitorButton.textContent = "Enable local monitoring"; monitorStatus.textContent = "Monitoring stopped. Folder access ends when the page closes."; return; }
  await checkLiveFolder();
  monitorTimer = setInterval(checkLiveFolder, 15000);
  monitorButton.textContent = "Stop local monitoring";
});

document.querySelector("#export").addEventListener("click", () => {
  if (!report) return;
  const blob = new Blob([JSON.stringify(createExportBundle(report), null, 2)], { type: "application/json" });
  const link = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `citizen-health-${Date.now()}.redacted.json` });
  link.click(); URL.revokeObjectURL(link.href);
});

window.addEventListener("beforeunload", () => clearInterval(monitorTimer));
