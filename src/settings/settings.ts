import "../ui/theme.css";
import { activate, deactivate, isPro } from "../license";
import { pricingText, renderNav } from "../ui/pro";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

async function refresh() {
  const pro = await isPro();
  $("plan").textContent = pro ? "Pro plan active" : "Free plan";
  $("plan").dataset.plan = pro ? "pro" : "free";
  $("plan-detail").textContent = pro
    ? "Thanks for supporting LaunchReady. Everything below is unlocked."
    : "Free includes 5 scans per day. Pro unlocks:";
  $("pro-list").hidden = pro;
  $("pricing").hidden = pro;
  $("license-form").hidden = pro;
  $("pro-actions").hidden = !pro;
}

$("pricing").textContent = pricingText();
renderNav($("nav"), "settings");

$("license-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = $("license-message");
  const result = await activate($<HTMLInputElement>("key").value);
  message.className = result.ok ? "field-ok" : "field-error";
  message.textContent = result.ok ? "Pro activated." : result.error;
  if (result.ok) {
    $<HTMLInputElement>("key").value = "";
    $("pro-message").textContent = "Pro activated.";
  }
  await refresh();
});

$("deactivate").addEventListener("click", async () => {
  await deactivate();
  $("license-message").textContent = "";
  await refresh();
});

void refresh();
