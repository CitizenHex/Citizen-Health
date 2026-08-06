import { analyze } from "./analysis.js";

const input = document.querySelector("#files");
const button = document.querySelector("#analyze");
const selected = document.querySelector("#selected");
let report;

input.addEventListener("change", () => {
  selected.replaceChildren(...[...input.files].map(file => Object.assign(document.createElement("li"), { textContent: `${file.name} · ${Math.ceil(file.size / 1024)} KB` })));
  button.disabled = !input.files.length;
});

button.addEventListener("click", async () => {
  const files = await Promise.all([...input.files].map(async file => ({ name: file.name, text: await file.text() })));
  report = analyze(files);
  document.querySelector("#summary").textContent = `${report.findings.length} finding${report.findings.length === 1 ? "" : "s"} from ${files.length} selected file${files.length === 1 ? "" : "s"}. Confidence describes evidence strength, not severity.`;
  document.querySelector("#findings").replaceChildren(...report.findings.map(finding => {
    const card = document.createElement("article");
    card.innerHTML = `<div><span class="confidence ${finding.confidence}">${finding.confidence} confidence</span><h3>${finding.title}</h3></div><p><strong>Evidence:</strong> ${finding.evidence}</p><p><strong>Next step:</strong> ${finding.action}</p><a href="${finding.link}" target="_blank" rel="noreferrer">Official remediation guidance ↗</a>`;
    return card;
  }));
  document.querySelector("#redaction").textContent = report.redactedEvidence.slice(0, 5000);
  document.querySelector("#results").classList.remove("hidden");
});

document.querySelector("#export").addEventListener("click", () => {
  if (!report) return;
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const link = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `citizen-health-${Date.now()}.redacted.json` });
  link.click(); URL.revokeObjectURL(link.href);
});
