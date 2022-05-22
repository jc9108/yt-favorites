console.log("foreground");

let [
	favorites,
	sidebar_favorites
] = [];

let click_again = true;

const favorites_url = "https://www.youtube.com/feed/favorites";
const theme = (document.getElementsByTagName("html")[0].getAttribute("dark") == "true" ? "dark" : "light");
console.log(theme); // REMOVE later. might need to get theme at a later point in runtime bc sometimes it isnt loaded yet upon getting it here

const url_mo = new MutationObserver((mutations) => {
	if (location.href != favorites_url) {
		url_mo.disconnect();

		set_custom_url_and_title();
	}
});

const sidebar_mo = new MutationObserver((mutations) => {
	const sidebar = document.getElementById("sections");

	let sidebar_subscriptions = null;
	try {
		const sidebar_top_section = sidebar.children[0].children[1];
		sidebar_subscriptions = sidebar_top_section.children[3];
	} catch (err) {
		null;
	}

	if (sidebar_subscriptions) {
		sidebar_mo.disconnect();

		sidebar_favorites = create_element_from_html_string(`
			<div id="sidebar_favorites" class="${"text_" + theme} sidebar_item_inactive sidebar_item_inactive_${theme}">
				<span class="sidebar_item_icon star">☆</span><span>Favorites</span>
			</div>
		`);
		
		if (location.href == favorites_url) {
			sidebar_subscriptions.removeAttribute("active");
			toggle_sf_active();
		}

		sidebar_subscriptions.addEventListener("click", (evt) => {
			(!sidebar_subscriptions.hasAttribute("active") ? sidebar_subscriptions.setAttribute("active", "") : null);
		});

		sidebar_favorites.addEventListener("click", (evt) => {
			const sidebar_subscriptions_anchor = sidebar_subscriptions.children[0];
			const original_href = sidebar_subscriptions_anchor.href;

			sidebar_subscriptions_anchor.href += "#favorites";

			sidebar_subscriptions.click();
			set_custom_url_and_title();
			url_mo.observe(document, {
				attributes: true,
				childList: true,
				subtree: true
			});

			sidebar_subscriptions_anchor.href = original_href;

			toggle_sf_active();
			sidebar_subscriptions.removeAttribute("active");
			setTimeout(() => {
				sidebar_subscriptions.toggleAttribute("active", false);
			}, 500);
		});

		sidebar_subscriptions.after(sidebar_favorites);
	}
});

const watch_mo = new MutationObserver((mutations) => {
	const meta = document.getElementById("meta");

	let sub_btn = null;
	try {
		sub_btn = meta.children[1].children[0].children[0].children[0].children[1].children[0].children[0];
	} catch (err) {
		null;
	}

	if (sub_btn) {
		watch_mo.disconnect();
		remove_star_btn();

		if (sub_btn.hasAttribute("subscribed")) {
			const channel_name = meta.children[1].children[0].children[0].children[0].children[0].children[1].children[0].children[0].children[0].children[0].children[0].innerHTML;
			add_star_btn(channel_name, sub_btn);
		}

		sub_btn.id = "sub_btn";
	}
});

const channel_mo = new MutationObserver((mutations) => {
	const channel_header = document.getElementById("channel-header");

	let sub_btn = null;
	try {
		sub_btn = channel_header.children[0].children[2].children[1].children[4].children[0].children[0];
	} catch (err) {
		null;
	}

	if (sub_btn) {
		channel_mo.disconnect();
		remove_star_btn();

		if (sub_btn.hasAttribute("subscribed")) {
			const channel_name = channel_header.children[0].children[2].children[0].children[0].children[0].children[0].children[0].innerHTML;
			add_star_btn(channel_name, sub_btn);
		}

		sub_btn.id = "sub_btn";
	}
});

const debounced_apply_d_none_to_feed_items = create_debounced_function(() => {
	const item_sections = document.querySelector('ytd-browse[role="main"] > * > #primary > ytd-section-list-renderer > #contents');
	if (item_sections) {
		for (const section of item_sections.children) {
			const items = section.querySelector("#items");
			if (items) {
				for (const item of items.children) {
					const channel_name = item.querySelector("a.yt-simple-endpoint.yt-formatted-string").innerHTML;
					(favorites.has(channel_name) ? item.style.removeProperty("display") : item.style.setProperty("display", "none", "important"));
				}
			}
		}
	}
}, 50);
const feed_mo = new MutationObserver((mutations) => {
	debounced_apply_d_none_to_feed_items();
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

function force_mo_activation() {
	const _ = create_element_from_html_string(`
		<div class="d_none"></div>
	`);
	document.body.append(_);
	_.remove();
}

function set_custom_url_and_title() {
	history.pushState(null, "", favorites_url);
	document.title = document.title.replace("Subscriptions", "Favorites");
}

function toggle_sf_active() {
	sidebar_favorites.classList.replace("sidebar_item_inactive", "sidebar_item_active");
	sidebar_favorites.classList.replace(`sidebar_item_inactive_${theme}`, `sidebar_item_active_${theme}`);
	sidebar_favorites.children[0].innerHTML = "★";
}

function toggle_sf_inactive() {
	sidebar_favorites.classList.replace("sidebar_item_active", "sidebar_item_inactive");
	sidebar_favorites.classList.replace(`sidebar_item_active_${theme}`, `sidebar_item_inactive_${theme}`);
	sidebar_favorites.children[0].innerHTML = "☆";
}

function add_star_btn(channel_name, sub_btn) {
	const star_btn = create_element_from_html_string(`
		<span id="star_btn" class="star ${"text_" + theme} ${"btn_" + theme}">${(favorites.has(channel_name) ? "★" : "☆")}</span>
	`);

	star_btn.addEventListener("click", async (evt) => {
		(evt.target.innerHTML == "☆" ? evt.target.innerHTML = "★" : evt.target.innerHTML = "☆");

		try {
			(favorites.has(channel_name) ? await remove_favorite(channel_name) : await add_favorite(channel_name));
		} catch (err) {
			console.error(err);
		}
	});

	// sub_btn.parentElement.prepend(star_btn);
	sub_btn.after(star_btn);
}

function remove_star_btn() {
	const star_btn = document.getElementById("star_btn");
	(star_btn ? star_btn.remove() : null);
}

function refresh_star_btn() {
	// remove_star_btn(); // REMOVE ?
	
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
	force_mo_activation();
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

chrome.storage.sync.get(null, (items) => {
	favorites = new Set(Object.keys(items));
	console.log(favorites);
});

sidebar_mo.observe(document, {
	attributes: true,
	childList: true,
	subtree: true
});

chrome.runtime.onMessage.addListener(async (msg, sender) => {
	console.log(msg);
	switch (msg.subject) {
		case "navigation":
			watch_mo.disconnect();
			channel_mo.disconnect();
			feed_mo.disconnect();

			switch (location.href) {
				case "https://www.youtube.com/feed/subscriptions#favorites":
					set_custom_url_and_title();
					url_mo.observe(document, {
						attributes: true,
						childList: true,
						subtree: true
					});
					break;
				case favorites_url:
					feed_mo.observe(document, {
						attributes: true,
						childList: true,
						subtree: true
					});
					break;
				default:
					(sidebar_favorites ? toggle_sf_inactive() : null);

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
					}

					break;
			}

			break;
		case "favorites updated":
			try {
				const synced_storage = await chrome.storage.sync.get(null);
				favorites = new Set(Object.keys(synced_storage));
				
				(document.getElementById("star_btn") ? refresh_star_btn() : null);

				(location.href == favorites_url ? force_mo_activation() : null);
			} catch (err) {
				console.error(err);
			}
			break;
		default:
			break;
	}
});

window.addEventListener("click", (evt) => {
	if (evt.target.closest('[id="sub_btn"]')) {
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
