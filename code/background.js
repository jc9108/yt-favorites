console.log("background");

function main() {
	chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
		if (details.frameId == 0 && details.url.startsWith("https://www.youtube.com")) {
			chrome.tabs.sendMessage(details.tabId, {
				subject: "navigation",
				content: details.url
			}).catch((err) => null);
		}
	});
	
	chrome.runtime.onMessage.addListener(async (msg, sender) => {
		console.log(msg);
		switch (msg.subject) {
			case "trigger navigation":
				chrome.tabs.sendMessage(sender.tab.id, {
					subject: "navigation",
					content: msg.content
				}).catch((err) => null);
				break;
			case "favorites updated":
				try {
					const active_window = await chrome.windows.getLastFocused();
					const yt_tabs = await chrome.tabs.query({
						url: "https://www.youtube.com/*"
					});
					for (const tab of yt_tabs) {
						if (!(tab.windowId == active_window.id && tab.active)) {
							chrome.tabs.sendMessage(tab.id, {
								subject: "favorites updated",
								content: msg.content
							}).catch((err) => null);
						}
					}
				} catch (err) {
					console.error(err);
				}
				break;
			default:
				break;
		}
	});
}

main();
