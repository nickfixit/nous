import path from 'path';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import { func } from '../../agent/functions';
import { funcClass } from '../../agent/metadata';
import { getFileSystem } from '../../agent/workflows';
import { cacheRetry } from '../../cache/cache';
import { envVar } from '../../utils/env-var';
import { execCommand } from '../../utils/exec';
const { getJson } = require('serpapi');
import { readFileSync } from 'fs';
import axios, { AxiosInstance } from 'axios';
import { fileExistsAsync, fileExistsSync } from 'tsconfig-paths/lib/filesystem';
import { sleep } from '../../utils/async-utils';

// For Node.js
const TurndownService = require('turndown');
// import * as TurndownService from 'turndown';
// import {TurndownService} from 'turndown';
const turndownService = new TurndownService();

export interface OrganicSearchResult {
	url: string;
	title: string;
}

/**
 * Functions for reading web pages on the public internet
 */
@funcClass(__filename)
export class PublicWeb {
	/**
	 * Downloads the pages under the url 1 level deep to the .wget folder
	 * @param url The URL to crawl
	 * @returns the A map of the website contents, keyed by filenames of the scraped web pages
	 */
	// @func
	// @cacheRetry({scope: 'global' })
	async crawlWebsite(url: string): Promise<Map<string, string>> {
		console.log(`Crawling ${url}`);
		const cwd = path.join(getFileSystem().basePath, '.cache', 'wget');
		const { stdout, stderr, exitCode } = await execCommand(`wget -r -l 1  -k -p ${url}`, cwd);
		if (exitCode > 0) throw new Error(`${stdout} ${stderr}`);

		// console.log(stdout)
		// console.log(stderr)
		return new Map();
	}

	/**
	 * Get the contents of a web page on the public open internet at the provided URL. NOTE: Do NOT use this for URLs websites which would require authentication.
	 * @param url {string} The web page URL
	 * @returns the web page contents in Markdown format
	 */
	@func
	// @cacheRetry({scope: 'global' })
	async getWebPage(url: string): Promise<string> {
		// console.log(`Crawling ${url}`);
		const wgetBasePath = path.join(getFileSystem().basePath, '.cache', 'wget');
		// Remove https:// or http://
		const urlPath = url.slice(url.indexOf('/') + 2);

		const wgetCachedPath = path.join(wgetBasePath, urlPath);
		// If we haven't downloaded it, then download the page
		if (!fileExistsSync(wgetCachedPath)) {
			if (urlPath.startsWith('www.youtube.com')) {
				// TODO get YouTube transcript
				return '';
			}

			const { stdout, stderr, exitCode } = await execCommand(`wget -q -p ${url}`, wgetBasePath);
			if (exitCode > 0) await sleep(1000);
			{
				const { stdout, stderr, exitCode } = await execCommand(`wget -p ${url}`, wgetBasePath);
				if (exitCode > 0) throw new Error(`${stdout} ${stderr}`);
			}
		}

		const htmlContents: string = readFileSync(wgetCachedPath).toString();
		const readableHtml = this.readableVersionFromHtml(htmlContents, url);
		const markdown = this.htmlToMarkdown(readableHtml, url);
		// const newSizePercent = Number((markdown.length / htmlContents.length) * 100).toFixed(1);
		// console.log(`Readable and markdown conversion compressed to ${newSizePercent}%${url ? ` for ${url}` : ''}`);
		return markdown;
	}

	/**
	 * Transforms the HTML into a readable version, which reduces the text size for LLM processing
	 * @param html
	 * @param url
	 */
	readableVersionFromHtml(html: string, url?: string): string {
		const doc = new JSDOM(html, { url });
		const reader = new Readability(doc.window.document);
		try {
			const article = reader.parse();
			return article.content;
		} catch (e) {
			console.error(`Could not create readability version of ${url}`);
			console.error(e);
			return html;
		}
	}

	/**
	 * Transforms HTML into Markdown format, which reduces the text size for LLM processing
	 * @param html The HTML to convert
	 * @param url The URL of the HTML (optional)
	 */
	htmlToMarkdown(html: string, url?: string): string {
		// const start = Date.now()
		const markdown = turndownService.turndown(html);
		// console.log(`Markdown conversion took ${Date.now()-start}ms`)
		return markdown;
	}

	async readableVersionFromUrl(url): Promise<string> {
		const urlFetch = await fetch(url);
		const html = await urlFetch.text();
		return this.readableVersionFromHtml(html);
	}

	/**
	 * Performs a Google search and returns the URLs of the search results
	 * @param searchTerm
	 */
	// @func
	@cacheRetry()
	async googleSearch(searchTerm: string): Promise<string[]> {
		// console.log('Google search', searchTerm)
		// // https://programmablesearchengine.google.com/controlpanel/create
		// // Select "Search the entire web"
		// const searchEngineId = envVar('GOOGLE_CUSTOM_SEARCH_ENGINE_ID')
		// const searchKey = envVar('GOOGLE_CUSTOM_SEARCH_KEY')
		//
		// const url = `https://www.googleapis.com/customsearch/v1` // ?key=${searchKey}&cx=${searchEngineId}&q=${searchTerm}
		// const results = await axios.get(url, {
		// 	params: {
		// 		key: searchKey,
		// 		cx: searchEngineId,
		// 		q: searchTerm
		// 	}
		// })
		// console.log(results.data)
		// console.log(results.data.queries.request)
		// try {
		// 	return results.data.items.map((item: any) => item.link)
		// } catch (e) {
		// 	console.error(results.status)
		// 	console.error(results.data)
		// 	console.error(e)
		// 	throw new Error(e.message)
		// }

		// https://developers.google.com/custom-search/v1/reference/rest/v1/Search

		return (await this.serpApiSearch(searchTerm)).map((result) => result.url);
	}

	/**
	 * Performs a Google search and returns the URL and title of the search results
	 * @param searchTerm
	 */
	@func
	@cacheRetry()
	async serpApiSearch(searchTerm: string): Promise<OrganicSearchResult[]> {
		// https://serpapi.com/search-api
		// https://serpapi.com/search&q=
		// const searchedUrls = new Set<string>();
		console.log('SerpApi search', searchTerm);
		const json = await getJson({
			// engine: "google",
			q: searchTerm,
			// location: "Seattle-Tacoma, WA, Washington, United States",
			// hl: "en",
			// gl: "us",
			// google_domain: "google.com",
			// num: "10",
			// start: "10",
			// safe: "active",
			api_key: process.env.SERP_API_KEY,
		});
		return json.organic_results.map((result) => {
			return { url: result.link, title: result.title };
		});
	}

	/**
	 * Performs a Kagi search and returns a map with the contents of the search results keyed by the URL
	 * @param searchTerm
	 */
	async kagiSearch(searchTerm: string): Promise<Map<string, string>> {
		// TODO
		return new Map();
	}

	/**
	 * Calls the Kagi API which performs a web search and then summarises the results
	 * @param searchTerm
	 * @return A summary of the search results contents from the Kagi search engine
	 */
	async askKagi(question: string): Promise<string> {
		// TODO
		return '';
	}
}

export const PUBLIC_WEB = new PublicWeb();