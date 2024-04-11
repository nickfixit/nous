import { DOMParser } from 'xmldom';
import { FunctionCalls } from './llm';

/**
 * Extracts the function call details from an LLM response
 * @param response
 * @returns the function call parameters
 */
export function parseFunctionCallsXml(response: string): FunctionCalls {
	const funcCallIndex = response.lastIndexOf('<function_calls>');
	if (funcCallIndex < 0) throw new Error('Could not find <function_calls> in the response');
	const xmlString = response.slice(funcCallIndex);

	const parser = new DOMParser();
	// TODO if XML parsing fails because of a syntax error we could have a fallback using a LLM to parse the result
	const doc = parser.parseFromString(xmlString, 'text/xml');

	const functionCalls: FunctionCalls = { invoke: [] };

	const invokes = doc.getElementsByTagName('invoke');
	for (let i = 0; i < invokes.length; i++) {
		const invoke = invokes[i];

		const toolName = invoke.getElementsByTagName('tool_name')[0].textContent;
		const parameters: { [key: string]: string } = {};
		const params = invoke.getElementsByTagName('parameters')[0];
		if (params) {
			const nodeList: NodeList = params.childNodes;
			for (const node of Object.values(nodeList)) {
				// if node is an element
				if (node.nodeType !== 1) continue;
				const param = node as Element;

				if (param.tagName === 'parameter') {
					const paramName = param.getElementsByTagName('name')[0].textContent.trim();
					const paramValue = param.getElementsByTagName('value')[0].textContent.trim();
					// const param = params[j];
					// const paramName = param.tagName;
					// const paramValue = param.textContent;
					parameters[paramName] = paramValue;
				} else {
					const paramName = param.tagName;
					const paramValue = param.textContent;
					parameters[paramName] = paramValue;
				}
			}
		}
		functionCalls.invoke.push({
			tool_name: toolName,
			parameters: parameters,
		});
	}

	return functionCalls;
}

/**
 * Parses text into an object.
 * The provided string may be a well-formed JSON string, or it might be wrapped in markdown lines (i.e. starting with the line ```json and ending with the line ```)
 * @param rawText
 */
export function extractJsonResult(rawText: string): any {
	let text = rawText.trim();
	if ((text.startsWith('```json') || text.startsWith('```JSON')) && text.endsWith('```')) {
		// Gemini returns in this format
		return JSON.parse(text.slice(7, -3));
	}
	if (text.startsWith('```') && text.endsWith('```')) {
		// Gemini returns in this format
		return JSON.parse(text.slice(3, -3));
	}

	const regex = /```[jJ][sS][oO][nN]\n({.*})\n```/s;
	const match = regex.exec(text);
	if (match) {
		return JSON.parse(match[1]);
	}

	const regexXml = /<json>(.*)<\/json>/is;
	const matchXml = regexXml.exec(text);
	if (matchXml) {
		return JSON.parse(matchXml[1]);
	}

	// Sometimes more than three trailing backticks
	while (text.endsWith('`')) {
		text = text.slice(0, -1);
	}
	try {
		return JSON.parse(text);
	} catch (e) {
		console.error(`Could not parse:\n${text}`);
		throw e;
	}
}

/**
 * Extracts the text within <result></result> tags
 * @param response response from the LLM
 */
export function extractStringResult(response: string): any {
	const index = response.lastIndexOf('<result>');
	if (index < 0) throw new Error('Could not find <result> in response');
	const resultText = response.slice(index);
	const regexXml = /<result>(.*)<\/result>/is;
	const matchXml = regexXml.exec(resultText);

	if (!matchXml) throw new Error(`Could not find <result></result> in the response \n${resultText}`);

	return matchXml[1].trim();
}