import "../ui/theme.css";
import { BETA_MODE } from "../config";
import { activate, deactivate, isPro } from "../license";
import { pricingText, renderNav } from "../ui/pro";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/** Free beta: everything is unlocked, so there is nothing to buy and no license key to enter. */
function showBeta() {
  $("plan").textContent = "Free during beta";
  $("plan").dataset.plan = "beta";
  $("plan-detail").textContent = "Every feature is free while LaunchReady is in beta. Thanks for trying it. Please send feedback from the popup.";
  for (const id of ["pro-list", "pricing", "license-panel", "license-form", "pro-actions"]) $(id).hidden = true;
}

async function refresh() {
  if (BETA_MODE) return showBeta();
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
