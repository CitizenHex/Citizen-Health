const rules = [
  { id: "controlled-exit", confidence: "high", title: "Controlled client shutdown — not a crash", pattern: /(systemquit.*exitcode=0|cause=30016.*player requested disconnect)/i, evidence: "The game log records a normal exit code or a player-requested disconnect followed by shutdown.", action: "No crash remediation is indicated from this session. If the exit was unexpected, collect the matching launcher log and any crash-handler text from the same time window.", link: "https://support.robertsspaceindustries.com/hc/en-us/articles/360000065688-Send-In-Game-Files-for-RSI-Support" },
  { id: "cryengine-watchdog", confidence: "high", title: "CryEngine watchdog crash", pattern: /(status_cryengine_watch_dog|0x2badff60|732823392)/i, evidence: "The log contains Star Citizen's specific CryEngine watchdog crash status.", action: "This identifies an engine-level crash, not a single confirmed local cause. Record the exact build and check current patch issues before changing hardware settings.", link: "https://support.robertsspaceindustries.com/hc/en-us/articles/360000161747-Troubleshoot-the-RSI-Launcher" },
  { id: "cryengine-fatal", confidence: "high", title: "CryEngine fatal error", pattern: /(status_cryengine_fatal_error|0x2badf00d|732819469)/i, evidence: "The log contains Star Citizen's specific CryEngine fatal-error status.", action: "This identifies an engine-level fatal error, not a single confirmed local cause. Preserve the matching Game.log and check current patch issues.", link: "https://support.robertsspaceindustries.com/hc/en-us/articles/360000161747-Troubleshoot-the-RSI-Launcher" },
  { id: "oom", confidence: "high", title: "Memory or pagefile exhaustion", pattern: /(status_cryengine_out_of_sysmem|0x2badff61|732823393|out of memory|is out of system memory|failed to allocate|pagefile)/i, evidence: "The logs contain an explicit memory-allocation failure.", action: "Check that the Windows pagefile is system-managed and that the game drive has free space.", link: "https://support.robertsspaceindustries.com/hc/en-us/articles/360000083387-Out-of-memory-errors-set-your-pagefile" },
  { id: "gpu", confidence: "medium", title: "Graphics driver or rendering API failure", pattern: /(device removed|device hung|dxgi_error|gpu crash|vulkan.*(error|failed))/i, evidence: "The logs contain a graphics device or rendering API failure.", action: "Update the GPU driver, then retry the alternate supported graphics API if the issue continues.", link: "https://support.robertsspaceindustries.com/hc/en-us/articles/360056254754-Star-Citizen-Alpha-Known-Issues" },
  { id: "verify", confidence: "medium", title: "Damaged or missing game data", pattern: /(data\.p4k.*(?:corrupt|error)|(?:missing|could not find) file|(?:pak|p4k).{0,80}(?:corrupt|checksum|hash mismatch|failed to (?:open|read))|verify.*files)/i, evidence: "The selected evidence mentions missing or unreadable game data.", action: "Use the RSI Launcher verification flow before reinstalling the game.", link: "https://support.robertsspaceindustries.com/hc/en-us/articles/360000161747-Troubleshoot-the-RSI-Launcher" },
  { id: "access", confidence: "low", title: "Access violation detected", pattern: /(exception_access_violation|0xc0000005|3221225477|access violation)/i, evidence: "An access violation is recorded, but this code has many possible causes.", action: "Treat this as a symptom. Review nearby log lines and recent driver, overclock, or game changes before taking broad action.", link: "https://support.robertsspaceindustries.com/hc/en-us/articles/360000161747-Troubleshoot-the-RSI-Launcher" },
  { id: "network", confidence: "medium", title: "Connection or server-session symptom", pattern: /(30k|30000|disconnected.*server|connection timeout|service unavailable)/i, evidence: "The logs show a connection or server-session failure rather than a confirmed local crash.", action: "Check current service status and retry before changing local hardware or reinstalling.", link: "https://status.robertsspaceindustries.com/" }
];

export function redact(text) {
  return text
    .replace(/[A-Z]:\\Users\\[^\\\s]+/gi, "%USERPROFILE%")
    .replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, "[REDACTED_EMAIL]")
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[REDACTED_IP]")
    .replace(/\b(nickname|playerGEID|session|node_id|user)\s*=\s*(?:"[^"]*"|[^\s,;]+)/gi, "$1=[REDACTED]")
    .replace(/\b(token|password|auth(?:orization)?)[=: ]+[^\s,;]+/gi, "$1=[REDACTED]");
}

function valueAfter(text, label) {
  return text.match(new RegExp(`^\\s*${label}\\s*:\\s*(.+)$`, "im"))?.[1]?.trim();
}

export function parseDxDiag(text) {
  const displayBlocks = text.split(/^-{5,}$/m).filter(block => /Card name:|Driver Version:/i.test(block));
  const card = displayBlocks.map(block => ({
    name: valueAfter(block, "Card name") || valueAfter(block, "Name"),
    memory: valueAfter(block, "Display Memory"),
    driver: valueAfter(block, "Driver Version")
  })).find(item => item.name);
  const snapshot = {
    windows: valueAfter(text, "Operating System"), systemMemory: valueAfter(text, "Memory"),
    cpu: valueAfter(text, "Processor"), gpu: card?.name, vram: card?.memory, driver: card?.driver
  };
  return Object.fromEntries(Object.entries(snapshot).filter(([, value]) => value));
}

function evidenceLines(text, pattern) {
  return text.split(/\r?\n/).filter(line => pattern.test(line)).slice(0, 3).map(redact);
}

function parseSession(file) {
  if (!file || !/game/i.test(file.name)) return {};
  const timestamps = [...file.text.matchAll(/<(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)>/g)].map(match => new Date(match[1]));
  const build = file.name.match(/Build\((\d+)\)/i)?.[1] || file.text.match(/Build[^\d]*(\d{7,})/i)?.[1];
  const start = timestamps[0]; const end = timestamps.at(-1);
  return Object.fromEntries(Object.entries({
    build, startedAt: start?.toISOString(), endedAt: end?.toISOString(),
    durationMinutes: start && end ? Math.round((end - start) / 60000) : undefined
  }).filter(([, value]) => value !== undefined));
}

function gameLogDate(file) {
  const match = file.name.match(/(\d{2})\s+([A-Za-z]{3})\s+(\d{2})\s+\((\d{2})\s+(\d{2})\s+(\d{2})\)/);
  if (match) return Date.parse(`${match[1]} ${match[2]} 20${match[3]} ${match[4]}:${match[5]}:${match[6]} UTC`);
  return file.lastModified || 0;
}

export function selectLatestGameLog(files) {
  const gameLogs = files.filter(file => /^game(?:\s|\.|$)/i.test(file.name) && /\.log$/i.test(file.name));
  if (gameLogs.length < 2) return { files, skippedFileNames: [] };
  const latest = gameLogs.toSorted((a, b) => gameLogDate(b) - gameLogDate(a))[0];
  return { files: files.filter(file => !gameLogs.includes(file) || file === latest), skippedFileNames: gameLogs.filter(file => file !== latest).map(file => file.name) };
}

export function analyze(files) {
  const selection = selectLatestGameLog(files);
  const joined = selection.files.map(file => `--- ${file.name} ---\n${file.text}`).join("\n");
  let findings = rules.filter(rule => rule.pattern.test(joined)).map(({ pattern, ...finding }) => ({ ...finding, evidenceLines: evidenceLines(joined, pattern) }));
  if (findings.some(finding => finding.id === "controlled-exit")) findings = findings.filter(finding => finding.id !== "network");
  if (!findings.length) findings.push({ id: "unknown", confidence: "low", title: "No recognized cause", evidence: "The selected files do not contain a supported diagnostic signature.", evidenceLines: [], action: "Add Game.log, launcher log, crash-handler text, and DxDiag if available. Do not assume the PC is at fault.", link: "https://support.robertsspaceindustries.com/hc/en-us/articles/360000065688-Send-In-Game-Files-for-RSI-Support" });
  const dxDiag = selection.files.find(file => /dxdiag/i.test(file.name));
  return { createdAt: new Date().toISOString(), fileNames: selection.files.map(file => file.name), skippedFileNames: selection.skippedFileNames, findings, session: parseSession(selection.files.find(file => /game/i.test(file.name))), hardwareSnapshot: dxDiag ? parseDxDiag(dxDiag.text) : {}, redactedEvidence: redact(joined) };
}

export function createExportBundle(report) {
  return {
    format: "citizen-health.redacted-report",
    version: 1,
    createdAt: report.createdAt,
    analyzedFiles: report.fileNames,
    skippedOlderGameLogs: report.skippedFileNames,
    session: report.session,
    hardwareSnapshot: report.hardwareSnapshot,
    findings: report.findings.map(({ id, confidence, title, evidence, evidenceLines, action, link }) => ({ id, confidence, title, evidence, evidenceLines, action, remediationLink: link })),
    privacy: "This export intentionally excludes complete source logs, binary dumps, and unrecognized raw data."
  };
}
