console.log("popup");

let favorites = null;

const view_favorites_btn = document.querySelector("#view_favorites_btn");
const hide_favorites_btn = document.querySelector("#hide_favorites_btn");
const favorites_list = document.querySelector("#favorites_list");
const clear_favorites_btn = document.querySelector("#clear_favorites_btn");
const cancel_confirm_btns_wrapper = document.querySelector("#cancel_confirm_btns_wrapper");
const cancel_btn = document.querySelector("#cancel_btn");
const confirm_btn = document.querySelector("#confirm_btn");

function refresh_favorites_list() {
	favorites_list.innerHTML = "";

	for (const favorite of favorites) {
		favorites_list.insertAdjacentHTML("beforeend", `
			<li>${favorite}</li>
		`);
	}
}

async function main() {
	const synced_storage = await chrome.storage.sync.get(null);
	favorites = Object.keys(synced_storage).sort((a, b) => a.localeCompare(b, "en"));
	refresh_favorites_list();
	
	chrome.runtime.onMessage.addListener(async (msg, sender) => {
		console.log(msg);
		switch (msg.subject) {
			case "favorites updated":
				const synced_storage = await chrome.storage.sync.get(null);		
				favorites = Object.keys(synced_storage).sort((a, b) => a.localeCompare(b, "en"));
				refresh_favorites_list();
				break;
			default:
				break;
		}
	});
	
	view_favorites_btn.addEventListener("click", (evt) => {
		evt.target.classList.add("d_none");
		hide_favorites_btn.classList.remove("d_none");
		favorites_list.classList.remove("d_none");
	});
	
	hide_favorites_btn.addEventListener("click", (evt) => {
		evt.target.classList.add("d_none");
		view_favorites_btn.classList.remove("d_none");
		favorites_list.classList.add("d_none");
	});
	
	clear_favorites_btn.addEventListener("click", (evt) => {
		cancel_confirm_btns_wrapper.classList.toggle("d_none");
	});
	
	cancel_btn.addEventListener("click", (evt) => {
		cancel_confirm_btns_wrapper.classList.add("d_none");
	});
	
	confirm_btn.addEventListener("click", async (evt) => {
		cancel_confirm_btns_wrapper.classList.add("d_none");
	
		try {
			await chrome.storage.sync.clear();
		
			const yt_tabs = await chrome.tabs.query({
				url: "https://www.youtube.com/*"
			});
			for (const tab of yt_tabs) {
				chrome.tabs.sendMessage(tab.id, {
					subject: "favorites updated",
					content: "cleared"
				}).catch((err) => null);
			}
	
			favorites = [];
			refresh_favorites_list();
		} catch (err) {
			console.error(err);
		}
	});
}

main().catch((err) => console.error(err));
