const rules = [
  { id: "oom", confidence: "high", title: "Memory or pagefile exhaustion", pattern: /(out of memory|is out of system memory|failed to allocate|pagefile)/i, evidence: "The logs contain an explicit memory-allocation failure.", action: "Check that the Windows pagefile is system-managed and that the game drive has free space.", link: "https://support.robertsspaceindustries.com/hc/en-us/articles/360000083387-Out-of-memory-errors-set-your-pagefile" },
  { id: "gpu", confidence: "medium", title: "Graphics driver or rendering API failure", pattern: /(device removed|device hung|dxgi_error|gpu crash|vulkan.*(error|failed))/i, evidence: "The logs contain a graphics device or rendering API failure.", action: "Update the GPU driver, then retry the alternate supported graphics API if the issue continues.", link: "https://support.robertsspaceindustries.com/hc/en-us/articles/360056254754-Star-Citizen-Alpha-Known-Issues" },
  { id: "verify", confidence: "medium", title: "Damaged or missing game data", pattern: /(data\.p4k.*(corrupt|error)|missing file|pak.*(corrupt|failed)|verify.*files)/i, evidence: "The selected evidence mentions missing or unreadable game data.", action: "Use the RSI Launcher verification flow before reinstalling the game.", link: "https://support.robertsspaceindustries.com/hc/en-us/articles/360000161747-Troubleshoot-the-RSI-Launcher" },
  { id: "access", confidence: "low", title: "Access violation detected", pattern: /(exception_access_violation|0xc0000005|access violation)/i, evidence: "An access violation is recorded, but this code has many possible causes.", action: "Treat this as a symptom. Review nearby log lines and recent driver, overclock, or game changes before taking broad action.", link: "https://support.robertsspaceindustries.com/hc/en-us/articles/360000161747-Troubleshoot-the-RSI-Launcher" },
  { id: "network", confidence: "medium", title: "Connection or server-session symptom", pattern: /(30k|30000|disconnected.*server|connection timeout|service unavailable)/i, evidence: "The logs show a connection or server-session failure rather than a confirmed local crash.", action: "Check current service status and retry before changing local hardware or reinstalling.", link: "https://status.robertsspaceindustries.com/" }
];

export function redact(text) {
  return text
    .replace(/[A-Z]:\\Users\\[^\\\s]+/gi, "%USERPROFILE%")
    .replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, "[REDACTED_EMAIL]")
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[REDACTED_IP]")
    .replace(/\b(?:token|password|auth(?:orization)?)[=: ]+[^\s,;]+/gi, "$1=[REDACTED]");
}

export function analyze(files) {
  const joined = files.map(file => `--- ${file.name} ---\n${file.text}`).join("\n");
  const findings = rules.filter(rule => rule.pattern.test(joined)).map(({ pattern, ...finding }) => finding);
  if (!findings.length) findings.push({ id: "unknown", confidence: "low", title: "No recognized cause", evidence: "The selected files do not contain a supported diagnostic signature.", action: "Add Game.log, launcher log, crash-handler text, and DxDiag if available. Do not assume the PC is at fault.", link: "https://support.robertsspaceindustries.com/hc/en-us/articles/360000065688-Send-In-Game-Files-for-RSI-Support" });
  return { createdAt: new Date().toISOString(), fileNames: files.map(file => file.name), findings, redactedEvidence: redact(joined) };
}
