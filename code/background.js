console.log("background");

function handle_navigation(details) {
	if (details.frameId == 0 && details.url.startsWith("https://www.youtube.com")) {
		chrome.tabs.sendMessage(details.tabId, {
			subject: "navigation",
			content: details.url
		}).catch((err) => null);
	}
}

chrome.runtime.onMessage.addListener(async (msg, sender) => {
	console.log(msg);
	switch (msg.subject) {
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

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
	const favorites_url = "https://www.youtube.com/feed/favorites";
	if (details.frameId == 0 && (details.url == favorites_url || details.url == favorites_url+"/")) {
		try {
			chrome.tabs.update(details.tabId, {
				url: "https://www.youtube.com/feed/subscriptions#favorites" // using # bc yt removes invalid ? on navigation
			}).catch((err) => console.error(err));
		} catch (err) {
			console.error(err);
		}
	}
});

chrome.webNavigation.onCompleted.addListener((details) => {
	handle_navigation(details);
});

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
	handle_navigation(details);
});
