// Service worker. Scanning/licensing logic arrives in later phases.
chrome.runtime.onInstalled.addListener(() => {
  console.log("LaunchReady installed");
});
