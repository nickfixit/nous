import { llms } from '#agent/agentContext';
import { GitLabProject } from '#functions/scm/gitlab';
import { SourceControlManagement, getSourceControlManagementTool } from '#functions/scm/sourceControlManagement';
import { buildPrompt } from '#swe/softwareDeveloperAgent';

export async function selectProject(requirements: string): Promise<GitLabProject> {
	const scm: SourceControlManagement = getSourceControlManagementTool();
	const projects: any[] = await scm.getProjects();
	const prompt: string = buildPrompt({
		information: `The following is a list of our projects in our git server:\n${JSON.stringify(projects)}`,
		requirements,
		action:
			'You task is to only select the project object for the relevant repository which needs to cloned so we can later edit it to complete task requirements. Output your answer in JSON format and only output JSON',
	});

	return await llms().hard.generateTextAsJson(prompt, null, { id: 'selectProject' });
}