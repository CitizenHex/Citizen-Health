import { analyze, createExportBundle, createSupportSummary, summarizeCombatHistory } from "./analysis.js";
import { appVersion } from "./version.js";

const input = document.querySelector("#files");
const analyzeButton = document.querySelector("#analyze");
const selected = document.querySelector("#selected");
const selectionStatus = document.querySelector("#selection-status");
const liveFolderButton = document.querySelector("#choose-live-folder");
const launcherFolderButton = document.querySelector("#choose-launcher-folder");
const monitorButton = document.querySelector("#monitor-live-folder");
const forgetFoldersButton = document.querySelector("#forget-folders");
const monitorStatus = document.querySelector("#monitor-status");
const activityNotice = document.querySelector("#activity-notice");
const keepHistory = document.querySelector("#keep-history");
const clearHistory = document.querySelector("#clear-history");
const historyStatus = document.querySelector("#history-status");
const historyList = document.querySelector("#history-list");
const combatHistoryList = document.querySelector("#combat-history-list");
const combatHistorySummary = document.querySelector("#combat-history-summary");
const recentAttackers = document.querySelector("#recent-attackers");
const recentAttackersList = document.querySelector("#recent-attackers-list");
const purchaseHistoryList = document.querySelector("#purchase-history-list");
const purchaseHistorySummary = document.querySelector("#purchase-history-summary");
const privacyStatus = document.querySelector("#privacy-status");
const snapshot = document.querySelector("#snapshot");
const session = document.querySelector("#session");
const timeline = document.querySelector("#session-timeline");
const combatEvents = document.querySelector("#combat-events");
const shopPurchases = document.querySelector("#shop-purchases");
const supportSummary = document.querySelector("#support-summary");
const copySupportSummaryButton = document.querySelector("#copy-support-summary");
const inputCoverage = document.querySelector("#input-coverage");
const appVersionLabel = document.querySelector("#app-version");
const homeTitle = document.querySelector("#home-title");
const homeStatus = document.querySelector("#home-status");
const homeSetupButton = document.querySelector("#home-setup");
const tabs = [...document.querySelectorAll("[data-tab]")];
const tabPanels = [...document.querySelectorAll("[data-tab-panel]")];
const supportedExtensions = /\.(log|txt|json|xml)$/i;
const maxTextFileSize = 25 * 1024 * 1024;
let report;
let liveDirectory;
let launcherDirectory;
let monitorTimer;
let lastObservedFingerprint;
let lastActivityKey;
let combatHistoryFilter = "all";
const historyKey = "citizen-health.session-history.v1";
const historyEnabledKey = "citizen-health.session-history-enabled.v1";
const folderStoreName = "folder-selections";
const folderRecordId = "saved-folders";

function openFolderStore() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("citizen-health.settings.v1", 1);
    request.onupgradeneeded = () => request.result.createObjectStore(folderStoreName, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveFolders() {
  const database = await openFolderStore();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(folderStoreName, "readwrite");
    transaction.objectStore(folderStoreName).put({ id: folderRecordId, liveDirectory, launcherDirectory });
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

async function loadSavedFolders() {
  const database = await openFolderStore();
  const saved = await new Promise((resolve, reject) => {
    const request = database.transaction(folderStoreName, "readonly").objectStore(folderStoreName).get(folderRecordId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return saved;
}

async function clearSavedFolders() {
  const database = await openFolderStore();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(folderStoreName, "readwrite");
    transaction.objectStore(folderStoreName).delete(folderRecordId);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

function selectTab(tabName) {
  tabs.forEach(tab => {
    const selected = tab.dataset.tab === tabName;
    tab.setAttribute("aria-selected", String(selected));
    tab.classList.toggle("active-tab", selected);
  });
  tabPanels.forEach(panel => panel.classList.toggle("hidden", panel.dataset.tabPanel !== tabName));
}

function renderHomeStatus() {
  if (!liveDirectory) {
    homeTitle.textContent = "Set up Citizen Health";
    homeStatus.textContent = "Choose your Star Citizen LIVE folder once. After that, Citizen Health will watch your game automatically whenever it is open.";
    homeSetupButton.textContent = "Choose game folder";
    homeSetupButton.classList.remove("hidden");
    return;
  }
  homeSetupButton.classList.add("hidden");
  if (monitorTimer) {
    homeTitle.textContent = "Watching your game";
    homeStatus.textContent = "Citizen Health is watching your latest game activity and saving your history on this PC.";
  } else {
    homeTitle.textContent = "Game folder is ready";
    homeStatus.textContent = "Open Settings and choose Start watching to reconnect Citizen Health to your game.";
  }
}

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
    const heading = document.createElement("div");
    heading.textContent = `${record.startedAt} — ${record.outcome} (${record.findings.join(", ") || "no finding"})`;
    item.append(heading);
    if (record.combatEvents?.length) {
      const details = document.createElement("details");
      const summary = document.createElement("summary"); summary.textContent = `${record.combatEvents.length} direct combat event${record.combatEvents.length === 1 ? "" : "s"}`;
      const events = document.createElement("ul");
      events.replaceChildren(...record.combatEvents.map(event => {
        const eventItem = document.createElement("li");
        const context = [event.weapon && `weapon: ${event.weapon}`, event.damageType && `damage: ${event.damageType}`].filter(Boolean).join(" · ");
        eventItem.textContent = `${event.at} — ${event.label}${context ? ` (${context})` : ""}`;
        return eventItem;
      }));
      details.append(summary, events); item.append(details);
    }
    return item;
  }));
  historyStatus.textContent = keepHistory.checked
    ? `${records.length} local session record${records.length === 1 ? "" : "s"}. Direct combat names and shop purchases may be retained; raw logs are not.`
    : "History is off. Existing local records remain until deleted.";
  renderCombatHistory(records);
}

function renderCombatHistory(records = loadHistory()) {
  const summary = summarizeCombatHistory(records, combatHistoryFilter);
  combatHistorySummary.textContent = records.length
    ? `${summary.totalDeaths} recorded death${summary.totalDeaths === 1 ? "" : "s"} · ${summary.totalKills} recorded kill${summary.totalKills === 1 ? "" : "s"}. Names are local-only and come directly from saved combat events.`
    : "No saved combat history yet. Turn on local history before analyzing or monitoring a session; earlier sessions cannot be reconstructed.";
  combatHistoryList.replaceChildren(...summary.events.map(event => {
    const item = document.createElement("li");
    const details = [event.weapon && `weapon: ${event.weapon}`, event.damageType && `damage: ${event.damageType}`].filter(Boolean).join(" · ");
    item.textContent = `${event.at} — ${event.label}${details ? ` (${details})` : ""}`;
    return item;
  }));
  recentAttackersList.replaceChildren(...summary.recentAttackers.map(([name, count]) => {
    const item = document.createElement("li"); item.textContent = `${name} — ${count} recorded death${count === 1 ? "" : "s"}`; return item;
  }));
  recentAttackers.classList.toggle("hidden", !summary.recentAttackers.length);
  document.querySelectorAll("[data-combat-filter]").forEach(button => button.classList.toggle("active-filter", button.dataset.combatFilter === combatHistoryFilter));
  const purchases = records.flatMap(record => record.shopPurchases || []).toSorted((left, right) => right.at.localeCompare(left.at));
  purchaseHistorySummary.textContent = purchases.length
    ? `${purchases.length} confirmed shop purchase${purchases.length === 1 ? "" : "s"} saved locally.`
    : "No saved purchases yet. Purchases require both a shop request and nearby transaction completion in the Game.log.";
  purchaseHistoryList.replaceChildren(...purchases.map(purchase => {
    const item = document.createElement("li");
    item.textContent = `${purchase.at} — ${purchase.quantity}× ${purchase.item} from ${purchase.shop} (${purchase.unitPrice * purchase.quantity} ${purchase.currency})`;
    return item;
  }));
}

function renderPrivacyStatus() {
  renderKeyValues(privacyStatus, {
    liveFolder: liveDirectory ? "Saved on this PC" : "Not selected",
    launcherFolder: launcherDirectory ? "Saved on this PC" : "Not selected",
    monitoring: monitorTimer ? "On while this tab stays open" : "Off",
    analyzedReport: report ? "In this tab only" : "None",
    localHistory: keepHistory.checked ? `${loadHistory().length} compact record${loadHistory().length === 1 ? "" : "s"}` : "Off",
    networkUploads: "Never"
  });
  forgetFoldersButton.disabled = !liveDirectory && !launcherDirectory;
  renderHomeStatus();
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
    combatEvents: nextReport.combatEvents.filter(event => event.at >= startedAt).slice(-25).map(({ at, type, label, otherParty, weapon, damageType }) => ({ at, type, label, otherParty, weapon, damageType })),
    shopPurchases: nextReport.shopPurchases.filter(purchase => purchase.at >= startedAt).slice(-50),
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

function announceActivity(nextReport) {
  const actionable = nextReport.findings.find(finding => !["controlled-exit", "unknown", "network"].includes(finding.id));
  const latestEvent = nextReport.sessionEvents.at(-1);
  const activity = actionable
    ? { key: `finding:${actionable.id}:${actionable.evidenceLines.join("|")}`, text: `Review needed: ${actionable.title}. Open the findings below for the evidence and next step.` }
    : latestEvent?.type === "entered-game"
      ? { key: `event:${latestEvent.at}:${latestEvent.type}`, text: "New game session detected from the local Game log." }
      : latestEvent?.type === "disconnected"
        ? { key: `event:${latestEvent.at}:${latestEvent.type}:${latestEvent.label}`, text: `Disconnect recorded: ${latestEvent.label}` }
        : latestEvent?.type === "application-exit"
          ? { key: `event:${latestEvent.at}:${latestEvent.type}`, text: "Game session ended normally according to the local log." }
          : undefined;
  if (!activity || activity.key === lastActivityKey) return;
  lastActivityKey = activity.key;
  activityNotice.textContent = activity.text;
  activityNotice.classList.remove("hidden");
}

function renderReport(nextReport, skipped = 0, automated = false) {
  report = nextReport;
  recordLatestSession(report);
  if (automated) announceActivity(report);
  document.querySelector("#summary").textContent = `${report.findings.length} finding${report.findings.length === 1 ? "" : "s"} from ${report.fileNames.length} analyzed text file${report.fileNames.length === 1 ? "" : "s"}.${report.skippedFileNames.length ? ` ${report.skippedFileNames.length} older Game log backup${report.skippedFileNames.length === 1 ? " was" : "s were"} left out; only the newest was analyzed.` : ""}${skipped ? ` ${skipped} unsupported, binary, or over-25 MB file${skipped === 1 ? " was" : "s were"} intentionally excluded.` : ""} Confidence describes evidence strength, not severity.`;
  document.querySelector("#findings").replaceChildren(...report.findings.map(finding => {
    const card = document.createElement("article");
    const heading = document.createElement("div");
    const confidence = document.createElement("span"); confidence.className = `confidence ${finding.confidence}`; confidence.textContent = `${finding.confidence} confidence`;
    const title = document.createElement("h3"); title.textContent = finding.title;
    heading.append(confidence, title);
    const evidence = document.createElement("p"); const evidenceStrong = document.createElement("strong"); evidenceStrong.textContent = "Evidence: "; evidence.append(evidenceStrong, finding.evidence);
    const action = document.createElement("p"); const actionStrong = document.createElement("strong"); actionStrong.textContent = "Next step: "; action.append(actionStrong, finding.action);
    const link = document.createElement("a"); link.href = finding.link; link.target = "_blank"; link.rel = "noreferrer"; link.textContent = "Official remediation guidance";
    card.append(heading, evidence, action, link);
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
  combatEvents.replaceChildren(...report.combatEvents.map(event => {
    const item = document.createElement("li");
    const details = [event.weapon && `weapon: ${event.weapon}`, event.damageType && `damage: ${event.damageType}`].filter(Boolean).join(" · ");
    item.textContent = `${event.at} — ${event.label}${details ? ` (${details})` : ""}`;
    return item;
  }));
  document.querySelector("#combat-section").classList.toggle("hidden", !combatEvents.children.length);
  shopPurchases.replaceChildren(...report.shopPurchases.map(purchase => {
    const item = document.createElement("li");
    const total = purchase.unitPrice * purchase.quantity;
    item.textContent = `${purchase.at} — ${purchase.quantity}× ${purchase.item} from ${purchase.shop} (${total} ${purchase.currency})`;
    return item;
  }));
  document.querySelector("#purchases-section").classList.toggle("hidden", !shopPurchases.children.length);
  renderKeyValues(snapshot, report.hardwareSnapshot);
  document.querySelector("#snapshot-section").classList.toggle("hidden", !snapshot.children.length);
  document.querySelector("#redaction").textContent = report.redactedEvidence.slice(0, 5000);
  inputCoverage.textContent = `Analyzed: ${report.inputCoverage.present.join(", ") || "selected text files"}. Optional inputs not included: ${report.inputCoverage.missing.join(", ") || "none"}.`;
  supportSummary.textContent = createSupportSummary(report);
  copySupportSummaryButton.textContent = "Copy summary";
  document.querySelector("#results").classList.remove("hidden");
  if (!automated) selectTab("crash");
  renderPrivacyStatus();
}

async function fileForAnalysis(file) {
  const text = await file.text();
  if (text.includes("\0")) throw new Error("Selected file is not plain text");
  return { name: file.name, text, lastModified: file.lastModified };
}

async function readFilesSafely(files) {
  const results = await Promise.allSettled(files.map(fileForAnalysis));
  return {
    files: results.filter(result => result.status === "fulfilled").map(result => result.value),
    unreadable: results.filter(result => result.status === "rejected").length
  };
}

function stopMonitoring(message, forgetFolders = false) {
  if (monitorTimer) clearInterval(monitorTimer);
  monitorTimer = undefined;
  monitorButton.textContent = "Start watching";
  if (forgetFolders) {
    liveDirectory = undefined;
    launcherDirectory = undefined;
    lastObservedFingerprint = undefined;
    monitorButton.disabled = true;
    clearSavedFolders().catch(() => {});
  }
  monitorStatus.textContent = message;
  renderPrivacyStatus();
}

async function startMonitoring() {
  if (!liveDirectory) return;
  await checkLiveFolder();
  monitorTimer = setInterval(checkLiveFolder, 15000);
  monitorButton.textContent = "Stop watching";
  renderPrivacyStatus();
}

async function canReadFolder(directory, request = false) {
  if (!directory?.queryPermission) return false;
  const permission = await directory.queryPermission({ mode: "read" });
  if (permission === "granted") return true;
  return request && (await directory.requestPermission({ mode: "read" })) === "granted";
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

async function launcherLogFrom(directory) {
  const entries = [];
  for await (const [name, handle] of directory.entries()) entries.push({ name, handle });
  const log = entries.find(entry => entry.handle.kind === "file" && entry.name.toLowerCase() === "log.log");
  return log ? log.handle.getFile() : undefined;
}

async function checkLiveFolder() {
  if (!liveDirectory) return;
  try {
    const gameLog = await latestGameLogFrom(liveDirectory);
    if (!gameLog) { monitorStatus.textContent = "No Game.log or Game backup found in the selected LIVE folder."; return; }
    if (gameLog.size > maxTextFileSize) { monitorStatus.textContent = "The newest Game log is over 25 MB and was not read."; return; }
    const launcherLog = launcherDirectory ? await launcherLogFrom(launcherDirectory) : undefined;
    const readableLauncher = launcherLog && launcherLog.size <= maxTextFileSize ? launcherLog : undefined;
    const fingerprint = [gameLog, readableLauncher].filter(Boolean).map(file => `${file.name}:${file.size}:${file.lastModified}`).join("|");
    if (fingerprint === lastObservedFingerprint) return;
    const read = await readFilesSafely([gameLog, readableLauncher].filter(Boolean));
    if (read.unreadable) {
      stopMonitoring("Monitoring stopped because the newest log could not be read as plain text. No file was changed.");
      return;
    }
    lastObservedFingerprint = fingerprint;
    renderReport(analyze(read.files), 0, true);
    monitorStatus.textContent = `Monitoring Game.log${readableLauncher ? " and launcher log.log" : ""} while Citizen Health stays open. Last analyzed: ${gameLog.name}.`;
  } catch (error) {
    const accessLost = ["NotAllowedError", "NotFoundError", "SecurityError"].includes(error?.name);
    stopMonitoring(accessLost
      ? "Monitoring stopped because this browser can no longer access the selected folder. Select it again to resume."
      : "Monitoring stopped because the selected folder could not be read. No file was changed.", accessLost);
  }
}

input.addEventListener("change", updateSelection);
input.addEventListener("input", updateSelection);
tabs.forEach(tab => tab.addEventListener("click", () => selectTab(tab.dataset.tab)));
homeSetupButton.addEventListener("click", () => liveFolderButton.click());

keepHistory.checked = localStorage.getItem(historyEnabledKey) !== "false";
if (localStorage.getItem(historyEnabledKey) === null) localStorage.setItem(historyEnabledKey, "true");
appVersionLabel.textContent = `Citizen Health ${appVersion}`;
renderHistory();
renderPrivacyStatus();
loadSavedFolders().then(async saved => {
  if (!saved?.liveDirectory) return;
  liveDirectory = saved.liveDirectory;
  launcherDirectory = saved.launcherDirectory;
  monitorButton.disabled = false;
  renderPrivacyStatus();
  if (await canReadFolder(liveDirectory)) {
    monitorStatus.textContent = "Saved game folder found. Citizen Health is watching your game.";
    await startMonitoring();
  } else {
    monitorStatus.textContent = "Saved game folder found. Choose Start watching when you are ready to reconnect it.";
    renderPrivacyStatus();
  }
}).catch(() => {
  monitorStatus.textContent = "Choose your game folder to start.";
});
keepHistory.addEventListener("change", () => {
  localStorage.setItem(historyEnabledKey, String(keepHistory.checked));
  if (keepHistory.checked && report) recordLatestSession(report);
  renderHistory();
  renderPrivacyStatus();
});
clearHistory.addEventListener("click", () => {
  if (!window.confirm("Delete all Citizen Health session, combat, and purchase history stored in this browser? This cannot be undone.")) return;
  localStorage.removeItem(historyKey);
  renderHistory();
  renderPrivacyStatus();
});

document.querySelectorAll("[data-combat-filter]").forEach(button => button.addEventListener("click", () => {
  combatHistoryFilter = button.dataset.combatFilter;
  renderCombatHistory();
}));

analyzeButton.addEventListener("click", async () => {
  const allowed = [...input.files].filter(file => supportedExtensions.test(file.name) && file.size <= maxTextFileSize);
  if (!allowed.length) { selectionStatus.textContent = "No supported text files were selected."; return; }
  const read = await readFilesSafely(allowed);
  if (!read.files.length) { selectionStatus.textContent = "The selected files could not be read as plain text. No file was changed."; return; }
  renderReport(analyze(read.files), input.files.length - allowed.length + read.unreadable);
  if (read.unreadable) selectionStatus.textContent = `${read.unreadable} selected file${read.unreadable === 1 ? " was" : "s were"} excluded because it could not be read as plain text.`;
});

liveFolderButton.addEventListener("click", async () => {
  if (!window.showDirectoryPicker) { monitorStatus.textContent = "Folder monitoring needs a current Chromium browser opened through Start-Citizen-Health.cmd."; return; }
  try {
    liveDirectory = await window.showDirectoryPicker({ mode: "read" });
    monitorButton.disabled = false;
    monitorStatus.textContent = `Game folder selected. Citizen Health is starting to watch it now.`;
    await saveFolders();
    renderPrivacyStatus();
    await startMonitoring();
  } catch (error) {
    if (error.name !== "AbortError") monitorStatus.textContent = "Citizen Health could not open that folder.";
  }
});

launcherFolderButton.addEventListener("click", async () => {
  if (!window.showDirectoryPicker) { monitorStatus.textContent = "Folder monitoring needs a current Chromium browser opened through Start-Citizen-Health.cmd."; return; }
  try {
    launcherDirectory = await window.showDirectoryPicker({ mode: "read" });
    lastObservedFingerprint = undefined;
    monitorStatus.textContent = `Launcher folder selected. Citizen Health will include it while watching your game.`;
    await saveFolders();
    renderPrivacyStatus();
    if (monitorTimer) await checkLiveFolder();
  } catch (error) {
    if (error.name !== "AbortError") monitorStatus.textContent = "Citizen Health could not open that launcher folder.";
  }
});

monitorButton.addEventListener("click", async () => {
  if (monitorTimer) { stopMonitoring("Watching paused. Your saved game folder is still ready for next time."); return; }
  if (!await canReadFolder(liveDirectory, true)) {
    monitorStatus.textContent = "Citizen Health needs access to your saved game folder before it can start watching.";
    return;
  }
  await startMonitoring();
});

forgetFoldersButton.addEventListener("click", () => {
  if (monitorTimer) clearInterval(monitorTimer);
  monitorTimer = undefined;
  liveDirectory = undefined;
  launcherDirectory = undefined;
  lastObservedFingerprint = undefined;
  lastActivityKey = undefined;
  monitorButton.disabled = true;
  monitorButton.textContent = "Start watching";
  monitorStatus.textContent = "Saved folders have been reset.";
  activityNotice.classList.add("hidden");
  activityNotice.textContent = "";
  clearSavedFolders().catch(() => { monitorStatus.textContent = "Folders were cleared from this page, but Citizen Health could not clear the saved folder settings."; });
  renderPrivacyStatus();
});

document.querySelector("#export").addEventListener("click", () => {
  if (!report) return;
  const blob = new Blob([JSON.stringify(createExportBundle(report), null, 2)], { type: "application/json" });
  const link = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `citizen-health-${Date.now()}.redacted.json` });
  link.click(); URL.revokeObjectURL(link.href);
});

copySupportSummaryButton.addEventListener("click", async () => {
  if (!report || !navigator.clipboard?.writeText) {
    copySupportSummaryButton.textContent = "Select the text to copy";
    return;
  }
  try {
    await navigator.clipboard.writeText(createSupportSummary(report));
    copySupportSummaryButton.textContent = "Copied";
  } catch {
    copySupportSummaryButton.textContent = "Select the text to copy";
  }
});

window.addEventListener("beforeunload", () => clearInterval(monitorTimer));
