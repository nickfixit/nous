import { randomUUID } from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';
import { FunctionCacheService } from '../cache/cache';
import { FileCacheService } from '../cache/fileCacheService';
import { SourceControlManagement } from '../functions/scm/sourceControlManagement';
import { UtilFunctions } from '../functions/util';
import { LLM, TaskLevel } from '../llm/llm';
import { FileSystem } from './filesystem';

/**
 * The LLMs for each Task Level
 */
export type WorkflowLLMs = Record<TaskLevel, LLM>;

export interface WorkflowContext {
	budget: number;
	budgetRemaining: number;
	cost: number;
	executionId: string;
	isRetry: boolean;
	systemPrompt: string;
	userEmail?: string;
	cacheService: FunctionCacheService;
	/** Working filesystem */
	fileSystem?: FileSystem | null;
	scm: SourceControlManagement | null;
	llms: Record<TaskLevel, LLM>;
	utils: UtilFunctions;
	/** Directory for cloning repositories etc */
	tempDir: string;
}

export const workflowContext = new AsyncLocalStorage<WorkflowContext>();

export function llms(): WorkflowLLMs {
	return workflowContext.getStore().llms;
}

/**
 * Adds LLM costs to the workflow context
 * @param cost the cost spent in $USD
 */
export function addCost(cost: number) {
	const store = workflowContext.getStore();
	console.log(`Adding cost $${cost}`);
	store.cost += cost;
	store.budgetRemaining -= cost;
	if (store.budgetRemaining < 0) store.budgetRemaining = 0;
}

export function getFileSystem(): FileSystem {
	const filesystem = workflowContext.getStore().fileSystem;
	if (!filesystem) throw new Error('No file system available in the workflow context');
	return filesystem;
}

export function runWithContext(context: { llms: WorkflowLLMs; retryExecutionId?: string }, func: () => any) {
	const isRetry = !!context.retryExecutionId;
	const store: WorkflowContext = {
		systemPrompt: '',
		userEmail: process.env.USER_EMAIL,
		executionId: context.retryExecutionId || randomUUID(),
		isRetry,
		cacheService: new FileCacheService('./.cache/tools'),
		budget: 0,
		budgetRemaining: 0,
		cost: 0,
		llms: context.llms,
		scm: null,
		utils: new UtilFunctions(),
		tempDir: './temp',
		fileSystem: new FileSystem(),
	};
	workflowContext.run(store, func);
}

/**
 * Sets the AsyncLocalStorage workflow context for the remainder of the current synchronous execution and then persists it through any following asynchronous calls.
 * @param llms
 * @param retryExecutionId
 */
export function enterWithContext(llms: WorkflowLLMs, retryExecutionId?: string) {
	const isRetry = !!retryExecutionId;
	workflowContext.enterWith({
		systemPrompt: '',
		executionId: retryExecutionId || randomUUID(),
		isRetry,
		cacheService: new FileCacheService('./.cache/tools'),
		budget: 0,
		budgetRemaining: 0,
		cost: 0,
		llms,
		scm: null,
		utils: new UtilFunctions(),
		tempDir: './temp',
		fileSystem: new FileSystem(),
	});
}

export function updateContext(updates: Partial<WorkflowContext>) {
	const store = workflowContext.getStore();
	Object.assign(store, updates);
}