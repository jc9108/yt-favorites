console.log("foreground");

let [
	favorites,
	manage_contents,
	feed_layout,
	feed_contents,
	filter_btn_state
] = [];

const theme = (document.querySelector("html").getAttribute("dark") == "true" ? "dark" : "light");
const debounce_timeout = 50; // ms

const watch_mo = new MutationObserver((mutations) => {
	const watch_page = document.querySelector('ytd-page-manager > ytd-watch-flexy[role="main"][video-id]');
	if (watch_page) {
		const sub_btn = watch_page.querySelector("#subscribe-button > ytd-subscribe-button-renderer > tp-yt-paper-button");
		const element = watch_page.querySelector("#meta > #meta-contents > ytd-video-secondary-info-renderer > #container > #top-row > ytd-video-owner-renderer > #upload-info > #channel-name > #container > #text-container > #text > a");
		if (sub_btn && element) {
			watch_mo.disconnect();
			remove_star_btn();
	
			const channel_name = element.innerHTML;
			(sub_btn.hasAttribute("subscribed") ? add_star_btn(channel_name, sub_btn) : null);
		}	
	}
});

const channel_mo = new MutationObserver((mutations) => {
	const channel_page = document.querySelector('ytd-page-manager > ytd-browse[role="main"][page-subtype="channels"]');
	if (channel_page) {
		const sub_btn = channel_page.querySelector("#subscribe-button > ytd-subscribe-button-renderer > tp-yt-paper-button");
		const element = channel_page.querySelector("#meta > #channel-name > #container > #text-container > #text");
		if (sub_btn && element) {
			channel_mo.disconnect();
			remove_star_btn();
	
			const channel_name = element.innerHTML;
			(sub_btn.hasAttribute("subscribed") ? add_star_btn(channel_name, sub_btn) : null);
		}	
	}
});

const debounced_modify_manage_contents = create_debounced_function(() => {
	const sections = [...(manage_contents.children)].slice(0, -1);
	for (const section of sections) {
		const channel_containers = section.querySelector("#grid-container").children;
		for (const channel_container of channel_containers) {
			const channel = channel_container.querySelector("#content-section");
			const info_section = channel.querySelector("#info-section");

			const channel_name = info_section.querySelector("#main-link > #info > #channel-title > #container > #text-container > #text").innerHTML;
			const sub_btn = info_section.querySelector("#subscribe-button > ytd-subscribe-button-renderer > tp-yt-paper-button");
			
			const star_btn = info_section.querySelector(".star_btn");
			(!star_btn ? add_star_btn(channel_name, sub_btn) : null);
		}
	}
}, debounce_timeout);
const manage_contents_mo = new MutationObserver((mutations) => {
	debounced_modify_manage_contents();
});

const manage_mo = new MutationObserver((mutations) => {
	manage_contents = document.querySelector('ytd-page-manager > ytd-browse[role="main"]:not([page-subtype]) > * > #primary > ytd-section-list-renderer > #contents');
	if (manage_contents) {
		manage_mo.disconnect();
		manage_contents_mo.observe(manage_contents, {
			attributes: true,
			childList: true,
			subtree: true
		});
	}
});

const debounced_modify_feed_contents = create_debounced_function(() => {
	feed_layout = (feed_contents.querySelector("#description-text") ? "list" : "grid");
	// console.log(feed_layout);
	switch (feed_layout) {
		case "grid":
			const sections = [...(feed_contents.children)].slice(0, -1);
			for (const section of sections) {
				const videos = section.querySelector("#items").children;
				for (const video of videos) {
					const channel_name = video.querySelector("#meta > #metadata-container > #metadata > #byline-container > #channel-name > #container > #text-container > #text > a").innerHTML;
					(favorites.has(channel_name) ? video.style.removeProperty("display") : video.style.setProperty("display", "none", "important"));
				}
			}
			break;
		case "list":
			const videos = [...(feed_contents.children)].slice(0, -1);
			for (const video of videos) {
				const channel_name = video.querySelector("#title-container > h2 > #image-container > #title-text > a > #title").innerHTML;
				(favorites.has(channel_name) ? video.style.removeProperty("display") : video.style.setProperty("display", "none", "important"));
			}
			break;
		default:
			break;
	}
}, debounce_timeout);
const feed_contents_mo = new MutationObserver((mutations) => {
	debounced_modify_feed_contents();
});

const feed_mo = new MutationObserver((mutations) => {
	feed_contents = document.querySelector('ytd-page-manager > ytd-browse[role="main"][page-subtype="subscriptions"] > * > #primary > ytd-section-list-renderer > #contents');
	if (feed_contents) {
		feed_mo.disconnect();
		(!document.querySelector("#filter_btn") ? add_filter_btn() : null);
	}
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
	try {
		element.append(_);
		_.remove();
	} catch (err) {
		(err.message == "Failed to execute 'append' on 'Document': Only one element on document allowed." ? null : console.error(err));
	}
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

function add_star_btn(channel_name, sub_btn) {
	const star_btn = create_element_from_html_string(`
		<button class="star_btn ${"btn_" + theme}" type="button">${(favorites.has(channel_name) ? "★" : "☆")}</button>
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

function remove_star_btn(multiple=false) {
	if (multiple) {
		const star_btns = document.querySelectorAll(".star_btn");
		for (const star_btn of star_btns) {
			star_btn.remove();
		}
	} else {
		const star_btn = document.querySelector(".star_btn");
		(star_btn ? star_btn.remove() : null);
	}
}

function refresh_star_btn() {
	if (location.href.startsWith("https://www.youtube.com/watch?")) {
		watch_mo.observe(document.body, {
			attributes: true,
			childList: true,
			subtree: true
		});
	} else if (location.href.startsWith("https://www.youtube.com/channel/") || location.href.startsWith("https://www.youtube.com/c/") || location.href.startsWith("https://www.youtube.com/user/")) {
		channel_mo.observe(document.body, {
			attributes: true,
			childList: true,
			subtree: true
		});
	} else if (location.href == "https://www.youtube.com/feed/channels") {
		remove_star_btn(multiple=true);

		manage_mo.observe(document.body, {
			attributes: true,
			childList: true,
			subtree: true
		});
	}
	force_mo_activation(document);
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
				
				feed_contents_mo.observe(feed_contents, {
					attributes: true,
					childList: true,
					subtree: true
				});
				force_mo_activation(feed_contents);

				break;
			case "UNFILTER":
				filter_btn_state = "FILTER";
				evt.target.innerHTML = `★ ${filter_btn_state} ★`;

				feed_contents_mo.disconnect();
				setTimeout(() => {
					switch (feed_layout) {
						case "grid":
							const sections = [...(feed_contents.children)].slice(0, -1);
							for (const section of sections) {
								const videos = section.querySelector("#items").children;
								for (const video of videos) {
									video.style.removeProperty("display");
								}
							}
							break;
						case "list":
							const videos = [...(feed_contents.children)].slice(0, -1);
							for (const video of videos) {
								video.style.removeProperty("display");
							}
							break;
						default:
							break;
					}
				}, debounce_timeout + 50);

				break;
			default:
				break;
		}
	});

	feed_contents.querySelector("#title-container > #spacer").after(filter_btn);
}

chrome.storage.sync.get(null, (items) => {
	favorites = new Set(Object.keys(items));
	console.log(favorites);
});

chrome.runtime.onMessage.addListener(async (msg, sender) => {
	console.log(msg);
	switch (msg.subject) {
		case "navigation":
			manage_contents_mo.disconnect();
			feed_contents_mo.disconnect();

			if (location.href.startsWith("https://www.youtube.com/watch?")) {
				console.log("watch");

				watch_mo.observe(document.body, {
					attributes: true,
					childList: true,
					subtree: true
				});
			} else if (location.href.startsWith("https://www.youtube.com/channel/") || location.href.startsWith("https://www.youtube.com/c/") || location.href.startsWith("https://www.youtube.com/user/")) {
				console.log("channel");

				channel_mo.observe(document.body, {
					attributes: true,
					childList: true,
					subtree: true
				});
			} else if (location.href == "https://www.youtube.com/feed/channels") {
				console.log("manage");

				manage_mo.observe(document.body, {
					attributes: true,
					childList: true,
					subtree: true
				});
			} else if (location.href.startsWith("https://www.youtube.com/feed/subscriptions")) {
				console.log("feed");

				feed_mo.observe(document.body, {
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
				
				if (document.querySelector(".star_btn")) {
					refresh_star_btn();
				} else if (location.href.startsWith("https://www.youtube.com/feed/subscriptions")) {
					force_mo_activation(feed_contents);
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
