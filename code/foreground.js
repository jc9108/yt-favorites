console.log("foreground");

let [
	favorites,
	contents,
	filter_btn_state
] = [];

const theme = (document.querySelector("html").getAttribute("dark") == "true" ? "dark" : "light");
const debounce_timeout = 50; // ms

const watch_mo = new MutationObserver((mutations) => {
	const sub_btn = document.querySelector("#subscribe-button > ytd-subscribe-button-renderer > tp-yt-paper-button");
	if (sub_btn) {
		watch_mo.disconnect();
		remove_star_btn();

		if (sub_btn.hasAttribute("subscribed")) {
			const channel_name = document.querySelector("#meta > #meta-contents > ytd-video-secondary-info-renderer > #container > #top-row > ytd-video-owner-renderer > #upload-info > #channel-name > #container > #text-container > #text > a").innerHTML;
			add_star_btn(channel_name, sub_btn);
		}
	}
});

const channel_mo = new MutationObserver((mutations) => {
	const sub_btn = document.querySelector("#subscribe-button > ytd-subscribe-button-renderer > tp-yt-paper-button");
	if (sub_btn) {
		channel_mo.disconnect();
		remove_star_btn();

		if (sub_btn.hasAttribute("subscribed")) {
			const channel_name = document.querySelector("#meta > #channel-name > #container > #text-container > #text").innerHTML;
			add_star_btn(channel_name, sub_btn);
		}
	}
});

const feed_mo = new MutationObserver((mutations) => {
	contents = document.querySelector('ytd-browse > * > #primary > ytd-section-list-renderer > #contents');
	if (contents) {
		feed_mo.disconnect();
		add_filter_btn();
	}
});

const debounced_modify_contents = create_debounced_function(() => {
	const item_sections = [...contents.children].slice(0, -1);
	for (const section of item_sections) {
		const items = section.querySelector("#items").children;
		for (const item of items) {
			const channel_name = item.querySelector("#meta > #metadata-container > #metadata > #byline-container > #channel-name > #container > #text-container > #text > a").innerHTML;
			(favorites.has(channel_name) ? item.style.removeProperty("display") : item.style.setProperty("display", "none", "important"));
		}
	}
}, debounce_timeout);
const contents_mo = new MutationObserver((mutations) => {
	debounced_modify_contents();
});

function create_element_from_html_string(html_string) {
	const dummy = document.createElement("div");
	dummy.innerHTML = html_string;
	const element = dummy.children[0];
	return element;
}

function create_debounced_function(fn, timeout) {
	let timer = null;
	return () => {
		(timer ? clearTimeout(timer) : null);
		timer = setTimeout(() => {
			fn.apply(this, arguments);
		}, timeout);
	};
}

function force_mo_activation(element) {
	const _ = create_element_from_html_string(`
		<div class="d_none"></div>
	`);
	element.append(_);
	_.remove();
}

function add_star_btn(channel_name, sub_btn) {
	const star_btn = create_element_from_html_string(`
		<button id="star_btn" class="${"btn_" + theme}" type="button">${(favorites.has(channel_name) ? "★" : "☆")}</button>
	`);

	star_btn.addEventListener("click", async (evt) => {
		(evt.target.innerHTML == "☆" ? evt.target.innerHTML = "★" : evt.target.innerHTML = "☆");

		try {
			(favorites.has(channel_name) ? await remove_favorite(channel_name) : await add_favorite(channel_name));
		} catch (err) {
			console.error(err);
		}
	});

	sub_btn.after(star_btn);
}

function remove_star_btn() {
	const star_btn = document.getElementById("star_btn");
	(star_btn ? star_btn.remove() : null);
}

function refresh_star_btn() {
	if (location.href.startsWith("https://www.youtube.com/watch?")) {
		watch_mo.observe(document, {
			attributes: true,
			childList: true,
			subtree: true
		});
	} else if (location.href.startsWith("https://www.youtube.com/channel/") || location.href.startsWith("https://www.youtube.com/c/") || location.href.startsWith("https://www.youtube.com/user/")) {
		channel_mo.observe(document, {
			attributes: true,
			childList: true,
			subtree: true
		});
	}
	force_mo_activation(document);
}

async function add_favorite(channel_name) {
	favorites.add(channel_name);
	
	await chrome.storage.sync.set({
		[channel_name]: null // value doesnt matter, only need key existence
	});
	console.log(`favorited (${channel_name})`);
	chrome.runtime.sendMessage({
		subject: "favorites updated",
		content: "added"
	}).catch((err) => null);
}

async function remove_favorite(channel_name) {
	favorites.delete(channel_name);

	await chrome.storage.sync.remove(channel_name);
	console.log(`unfavorited (${channel_name})`);
	chrome.runtime.sendMessage({
		subject: "favorites updated",
		content: "removed"
	}).catch((err) => null);
}

function add_filter_btn() {
	const filter_btn = create_element_from_html_string(`
		<button id="filter_btn" class="${"btn_" + theme}" type="button">★ ${filter_btn_state = "FILTER"} ★</button>
	`);

	filter_btn.addEventListener("click", (evt) => {
		switch (filter_btn_state) {
			case "FILTER":
				filter_btn_state = "UNFILTER";
				evt.target.innerHTML = `★ ${filter_btn_state} ★`;
				
				contents_mo.observe(contents, {
					attributes: true,
					childList: true,
					subtree: true
				});
				force_mo_activation(contents);

				break;
			case "UNFILTER":
				filter_btn_state = "FILTER";
				evt.target.innerHTML = `★ ${filter_btn_state} ★`;

				contents_mo.disconnect();
				
				setTimeout(() => {
					const item_sections = [...contents.children].slice(0, -1);
					for (const section of item_sections) {
						const items = section.querySelector("#items").children;
						for (const item of items) {
							item.style.removeProperty("display");
						}
					}
				}, debounce_timeout + 50);

				break;
			default:
				break;
		}
	});

	contents.querySelector("#title-container > #spacer").after(filter_btn);
}

chrome.storage.sync.get(null, (items) => {
	favorites = new Set(Object.keys(items));
	console.log(favorites);
});

chrome.runtime.onMessage.addListener(async (msg, sender) => {
	console.log(msg);
	switch (msg.subject) {
		case "navigation":
			watch_mo.disconnect();
			channel_mo.disconnect();
			feed_mo.disconnect();
			contents_mo.disconnect();

			if (location.href.startsWith("https://www.youtube.com/watch?")) {
				console.log("watch");

				watch_mo.observe(document, {
					attributes: true,
					childList: true,
					subtree: true
				});
			} else if (location.href.startsWith("https://www.youtube.com/channel/") || location.href.startsWith("https://www.youtube.com/c/") || location.href.startsWith("https://www.youtube.com/user/")) {
				console.log("channel");

				channel_mo.observe(document, {
					attributes: true,
					childList: true,
					subtree: true
				});
			} else if (location.href == "https://www.youtube.com/feed/subscriptions") {
				console.log("feed");

				feed_mo.observe(document, {
					attributes: true,
					childList: true,
					subtree: true
				});
			}

			break;
		case "favorites updated":
			try {
				const synced_storage = await chrome.storage.sync.get(null);
				favorites = new Set(Object.keys(synced_storage));
				
				if (document.getElementById("star_btn")) {
					refresh_star_btn();
				} else if (location.href == "https://www.youtube.com/feed/subscriptions") {
					force_mo_activation(contents);
				}
			} catch (err) {
				console.error(err);
			}
			break;
		default:
			break;
	}
});

window.addEventListener("click", (evt) => {
	if (evt.target.closest("#subscribe-button > ytd-subscribe-button-renderer > tp-yt-paper-button")) {
		setTimeout(() => {
			refresh_star_btn();
		}, 50);

		window.addEventListener("click", (evt) => {
			(evt.target.innerHTML == "Unsubscribe" ? remove_star_btn() : null);
		}, {
			once: true
		});
	}
});
