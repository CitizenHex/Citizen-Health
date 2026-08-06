import { analyze } from "./analysis.js";

const input = document.querySelector("#files");
const button = document.querySelector("#analyze");
const selected = document.querySelector("#selected");
const snapshot = document.querySelector("#snapshot");
const session = document.querySelector("#session");
let report;

input.addEventListener("change", () => {
  selected.replaceChildren(...[...input.files].map(file => Object.assign(document.createElement("li"), { textContent: `${file.name} · ${Math.ceil(file.size / 1024)} KB` })));
  button.disabled = !input.files.length;
});

button.addEventListener("click", async () => {
  const allowed = [...input.files].filter(file => !/\.(dmp|mdmp)$/i.test(file.name));
  const skipped = input.files.length - allowed.length;
  const files = await Promise.all(allowed.map(async file => ({ name: file.name, text: await file.text() })));
  if (!files.length) return;
  report = analyze(files);
  document.querySelector("#summary").textContent = `${report.findings.length} finding${report.findings.length === 1 ? "" : "s"} from ${report.fileNames.length} analyzed text file${report.fileNames.length === 1 ? "" : "s"}.${report.skippedFileNames.length ? ` ${report.skippedFileNames.length} older Game log backup${report.skippedFileNames.length === 1 ? " was" : "s were"} left out; only the newest was analyzed.` : ""}${skipped ? ` ${skipped} binary dump file${skipped === 1 ? " was" : "s were"} intentionally excluded from analysis and export.` : ""} Confidence describes evidence strength, not severity.`;
  document.querySelector("#findings").replaceChildren(...report.findings.map(finding => {
    const card = document.createElement("article");
    card.innerHTML = `<div><span class="confidence ${finding.confidence}">${finding.confidence} confidence</span><h3>${finding.title}</h3></div><p><strong>Evidence:</strong> ${finding.evidence}</p><p><strong>Next step:</strong> ${finding.action}</p><a href="${finding.link}" target="_blank" rel="noreferrer">Official remediation guidance ↗</a>`;
    if (finding.evidenceLines.length) {
      const lines = document.createElement("pre"); lines.className = "evidence-lines";
      lines.textContent = finding.evidenceLines.join("\n"); card.append(lines);
    }
    return card;
  }));
  session.replaceChildren();
  for (const [label, value] of Object.entries(report.session)) {
    const item = document.createElement("div");
    const term = document.createElement("dt"); term.textContent = label.replace(/([A-Z])/g, " $1");
    const detail = document.createElement("dd"); detail.textContent = `${value}${label === "durationMinutes" ? " min" : ""}`;
    item.append(term, detail); session.append(item);
  }
  document.querySelector("#session-section").classList.toggle("hidden", !session.children.length);
  snapshot.replaceChildren();
  for (const [label, value] of Object.entries(report.hardwareSnapshot)) {
    const item = document.createElement("div");
    const term = document.createElement("dt"); term.textContent = label.replace(/([A-Z])/g, " $1");
    const detail = document.createElement("dd"); detail.textContent = value;
    item.append(term, detail); snapshot.append(item);
  }
  document.querySelector("#snapshot-section").classList.toggle("hidden", !snapshot.children.length);
  document.querySelector("#redaction").textContent = report.redactedEvidence.slice(0, 5000);
  document.querySelector("#results").classList.remove("hidden");
});

document.querySelector("#export").addEventListener("click", () => {
  if (!report) return;
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const link = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `citizen-health-${Date.now()}.redacted.json` });
  link.click(); URL.revokeObjectURL(link.href);
});
