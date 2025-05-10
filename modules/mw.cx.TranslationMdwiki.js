//
const mdwiki_last_url = { url: "" };

const ENDPOINTS = {
	mdwiki: "https://mdwiki.org",
	mdwiki_wmcloud: "https://mdwiki.wmcloud.org",
	medwikiToolforge: "https://medwiki.toolforge.org",
	local: "http://localhost:8000"
}

function get_last_url() {
	return mdwiki_last_url.url;
}

function createCategoryObject(cat) {
	console.log("createCategoryObject:", cat);
	return {
		adapted: true,
		sourceTitle: `Category:${cat}`,
		targetTitle: `Jamii:${cat}`
	};
}

// Utility to detect Swahili categories in HTML
async function add_sw_categories(html) {
	const categories = [];
	const regexInfoboxDrug = /infobox drug/i;
	const regexInfoboxMedicalCondition = /infobox medical condition/i;

	// if html has "infobox drug" categories.push( createCategoryObject("Madawa") );
	// if html has "infobox medical condition" categories.push( createCategoryObject("Magonjwa") );

	if (regexInfoboxDrug.test(html)) categories.push(createCategoryObject("Madawa"));

	if (regexInfoboxMedicalCondition.test(html)) categories.push(createCategoryObject("Magonjwa"));

	console.log(JSON.stringify(categories));

	console.log("add_sw_categories. Done");

	return categories;
}

async function fetchJson(url, options) {
	mdwiki_last_url.url += url + "\n";
	// ---
	console.log("fetchJson:", url);
	// ---
	if (!options) {
		options = {
			method: "GET",
			// mode: "cors", // السماح بطلب CORS
			dataType: "json",
		}
	}
	// ---
	options.headers = {
		"Content-Type": "application/json",
		"User-Agent": "WikiProjectMed Translation Dashboard/1.0 (https://mdwiki.toolforge.org/; tools.mdwiki@toolforge.org)",
		...(options.headers ?? {})
	};
	// ---
	try {
		const response = await fetch(url, options);
		if (!response.ok) {
			console.error("Fetch GET error:", response.status, response.statusText, url);
			return false;
		}
		return await response.json();
	} catch (error) {
		console.error("Fetch Error: ", error, url);
		return false;
	}
}

async function postJson(end_point, data) {
	const options = {
		method: "POST",
		dataType: "json",
		// mode: "no-c",
		body: JSON.stringify(data)
	};
	return await fetchJson(end_point, options);
}

async function get_mdtexts_2024(title) {
	let sanitizedTitle = title.replace(/['" :/]/g, "_");
	// ---
	let host = (window.location.hostname === "mdwikicx.toolforge.org") ? window.location.hostname : "medwiki.toolforge.org";
	const url = `https://${host}/mdtexts/segments.php?title=${sanitizedTitle}`;
	// ---
	const data = await fetchJson(url);
	// ---
	if (!data) {
		console.log("get_mdtexts_2024: not found");
		return false;
	}
	// ---
	const out = {
		sourceLanguage: "mdwiki",
		title: title,
		revision: "5200",
		segmentedContent: "",
		categories: []
	}
	// ---
	out.segmentedContent = removeUnlinkedWikibase(data.html);
	// ---
	const html = data.html.replaceAll("&#34;", '"');
	const matches = html.match(/Mdwiki_revid"\},"params":\{"1":\{"wt":"(\d+)"\}\}/);
	// ---
	// if (matches && matches[1]) {
	if (matches?.[1]) {
		out.revision = matches[1];
		console.log("get_mdtexts_2024 ", out.revision);
	}
	// ---
	return out;
}

function isMedwikiHost() {
	return window.location.hostname === "medwiki.toolforge.org";
}

function shouldUse2025() {
	var use2025 = window.location.hostname === "mdwikicx.toolforge.org";
	// ---
	// if server == "localhost" then use2025 = false
	// if (window.location.hostname === "localhost") use2025 = false;
	// ---
	// if (user_name === "Mr. Ibrahem" || user_name === "Mr. Ibrahem 1") use2025 = true;
	// ---
	return use2025;
}

// Convert HTML to segmented content
async function HtmltoSegments(text) {
	const url = "https://ncc2c.toolforge.org/HtmltoSegments";

	// if (window.location.hostname === "localhost") {
	// 	url = "http://localhost:8000/HtmltoSegments";
	// }

	const segmentedReq = await postJson(url, { html: text });

	// Handle the response from your API
	if (!segmentedReq || segmentedReq.error) {
		console.error("HtmltoSegments Error:", segmentedReq?.error || "unknown error");
		return "";
	}
	const segmentedContent = segmentedReq.result || '';
	return segmentedContent;
}

// Fetch HTML from medwiki
async function getMedwikiHtml(title, tr_type) {
	title = title.replace(/\s/g, "_");

	const { end_point, title: formattedTitle } = get_endpoint_and_title(tr_type, title);

	const encodedTitle = encodeURIComponent(formattedTitle).replace(/\//g, "%2F");

	const url = `${end_point}/w/rest.php/v1/page/${encodedTitle}/with_html`;

	const data = await fetchJson(url);
	return data?.html || "";
}

function get_endpoint_and_title(tr_type, title) {
	let end_point = ENDPOINTS.medwikiToolforge;

	if (tr_type === "all") {
		// if title contains slashes
		if (title.includes("/")) {
			title = title + "/fulltext";
		} else {
			// end_point = ENDPOINTS.mdwiki_wmcloud;
			end_point = ENDPOINTS.mdwiki;
		}
	}

	title = end_point === ENDPOINTS.medwikiToolforge ? `Md:${title}` : title;

	return { end_point, title };
}

function get_html_revision(HTMLText) {
	if (HTMLText !== '') {
		const matches = HTMLText.match(/Redirect\/revision\/(\d+)/);
		// if (matches && matches[1]) {
		if (matches?.[1]) {
			const revision = matches[1];
			return revision;
		}
	}
	return "";
}

function removeUnlinkedWikibase(html) {
	const dom = new DOMParser().parseFromString(html, "text/html");

	const elements = dom.getElementsByTagName("span");

	Array.from(elements).forEach(element => {
		const lowerOuterHtml = element.outerHTML.toLowerCase();

		if (lowerOuterHtml.includes("unlinkedwikibase") || lowerOuterHtml.includes("mdwiki revid")) {
			// element.parentNode.removeChild(element);
			// element.remove();

			html = html.replace(element.outerHTML, '');
		}
	});

	// return dom.documentElement.outerHTML;
	return html;
}

async function get_from_medwiki_or_mdwiki_api(title, tr_type) {
	const html = await getMedwikiHtml(title, tr_type);
	if (!html) {
		console.log("getMedwikiHtml: not found");
		return false;
	};

	const cleanedHtml = removeUnlinkedWikibase(html);
	const revision = get_html_revision(cleanedHtml);

	const segmentedContent = await HtmltoSegments(cleanedHtml);
	if (segmentedContent == "") {
		console.log("HtmltoSegments: not found");
		return false;
	};
	return {
		sourceLanguage: "mdwiki",
		title: title,
		revision: revision,
		segmentedContent: segmentedContent,
		categories: []
	};
}

async function get_new_html_2025(title, tr_type) {
	const params = {
		title: title
	};
	if (tr_type === "all") params.all = "all";
	// ---
	let host = (window.location.hostname === "mdwikicx.toolforge.org") ? window.location.hostname : "medwiki.toolforge.org";
	// ---
	const url = `https://${host}/new_html/index.php?${$.param(params)}`;
	// ---
	return await fetchJson(url);
}

async function get_Segments_from_mdwiki(targetLanguage, title, tr_type) {
	// var url = "https://medwiki.toolforge.org/get_html/index.php";

	let host = (window.location.hostname === "mdwikicx.toolforge.org") ? window.location.hostname : "medwiki.toolforge.org";

	const params = {
		sourcelanguage: "mdwiki",
		targetlanguage: targetLanguage,
		tr_type: tr_type,
		title: title
	};
	// ---
	if (tr_type !== "all") params.section0 = 1;
	if (tr_type === "all") params.all = "all";
	// ---
	const url = `https://${host}/get_html/index.php?${$.param(params)}`;

	const result = await fetchJson(url);
	return result;
}

async function fetchSourcePageContent_mdwiki_user_test(page_title, targetLanguage, tr_type, user_name) {
	mdwiki_last_url.url = "";
	// ---
	// make first litter Capital
	page_title = page_title.charAt(0).toUpperCase() + page_title.slice(1);
	// ---
	// if page_title start with "Video:" then tr_type = all
	if (page_title.startsWith("Video:") || page_title.startsWith("video:")) {
		tr_type = "all";
	}
	// ---
	// Manual normalisation to avoid redirects on spaces but not to break namespaces
	const title = page_title.replace(/ /g, "_");
	// ---
	console.log("tr_type: ", tr_type)
	// ---
	let result1;
	// ---
	if (user_name === "get_mdtexts_2024") {
		result1 = await get_mdtexts_2024(title);
	} else if (user_name === "get_from_medwiki_or_mdwiki_api") {
		result1 = await get_from_medwiki_or_mdwiki_api(title, tr_type);
	} else if (user_name === "get_new_html_2025") {
		result1 = await get_new_html_2025(title, tr_type);
	} else if (user_name === "get_Segments_from_mdwiki") {
		result1 = await get_Segments_from_mdwiki(targetLanguage, title, tr_type);
	}
	// ---
	return result1;
}

async function fetchSourcePageContent_mdwiki_new(page_title, targetLanguage, tr_type, user_name) {
	// make first litter Capital
	page_title = page_title.charAt(0).toUpperCase() + page_title.slice(1);
	// ---
	// Manual normalisation to avoid redirects on spaces but not to break namespaces
	const title = page_title.replace(/ /g, "_");
	// ---
	// Try 2025 method first if applicable
	// if (shouldUse2025()) {
	const result0 = await get_new_html_2025(title, tr_type);
	if (result0) return result0;
	// }
	// ---
	// try segments method
	// ---
	const result = await get_Segments_from_mdwiki(targetLanguage, title, tr_type);
	if (result) return result;
	// ---
	// const result2 = await get_mdtexts_2024(title);
	// if (result2) return result2;
	// ---
	// Try medwiki method if on medwiki host
	// if (isMedwikiHost()) {
	const result1 = await get_from_medwiki_or_mdwiki_api(title, tr_type);
	if (result1) return result1;
	// }
	// ---
	return "";
}

async function fetchSourcePageContent_mdwiki(page_title, targetLanguage, tr_type, user_name) {
	mdwiki_last_url.url = "";
	// ---
	// if page_title start with "Video:" then tr_type = all
	if (page_title.startsWith("Video:") || page_title.startsWith("video:")) {
		tr_type = "all";
	}
	// ---
	const result = await fetchSourcePageContent_mdwiki_new(page_title, targetLanguage, tr_type, user_name);
	// ---
	// if (result && result.segmentedContent && targetLanguage === "sw") {
	if (result?.segmentedContent && targetLanguage === "sw") {
		result.categories = await add_sw_categories(result.segmentedContent);
	}
	// ---
	return result;
}

mw.cx.TranslationMdwiki = {
	fetchSourcePageContent_mdwiki,
	fetchSourcePageContent_mdwiki_user_test,
	get_last_url,
}
