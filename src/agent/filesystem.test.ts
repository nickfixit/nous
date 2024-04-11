import { resolve } from 'path';
import { expect } from 'chai';
import { FileSystem } from './filesystem';

describe('FileSystem', () => {
	const fileSystem = new FileSystem('/basePath');
	describe('setWorkingDirectory', () => {
		it('should be able to set a path from the baseDir when the new working directory starts with /', async () => {
			fileSystem.setWorkingDirectory('/otherWorkDir');
			fileSystem.setWorkingDirectory('/newWorkDir');
			expect(fileSystem.getWorkingDirectory()).to.equal('/basePath/newWorkDir');
		});

		it('should be able to set a relative new working directory', async () => {
			const fileSystem = new FileSystem('/basePath');
			fileSystem.setWorkingDirectory('dir1');
			fileSystem.setWorkingDirectory('dir2');
			expect(fileSystem.getWorkingDirectory()).to.equal('/basePath/dir1/dir2');
		});

		it('should be able to navigate up a directory', async () => {
			const fileSystem = new FileSystem('/basePath');
			fileSystem.setWorkingDirectory('dir1/dir2');
			fileSystem.setWorkingDirectory('..');
			expect(fileSystem.getWorkingDirectory()).to.equal('/basePath/dir1');
		});

		it('should assume if the new working directory starts with basePath, then its the basePath', async () => {
			const fileSystem = new FileSystem('/basePath');
			fileSystem.setWorkingDirectory('/basePath/dir1');
			expect(fileSystem.getWorkingDirectory()).to.equal('/basePath/dir1');
		});

		it('should not allow setting the working directory higher than the basePath', () => {
			fileSystem.setWorkingDirectory('dir1');
			fileSystem.setWorkingDirectory('../..');
			expect(resolve(fileSystem.getWorkingDirectory())).to.equal(resolve(fileSystem.basePath));

			fileSystem.setWorkingDirectory('/..');
			expect(resolve(fileSystem.getWorkingDirectory())).to.equal(resolve(fileSystem.basePath));

			fileSystem.setWorkingDirectory('./../..');
			expect(resolve(fileSystem.getWorkingDirectory())).to.equal(resolve(fileSystem.basePath));
		});
	});

	describe('fileExists', () => {
		const fileSystem = new FileSystem();
		it('should return true if a file exists', async () => {
			expect(await fileSystem.fileExists('package.json')).to.be.true;
			expect(await fileSystem.fileExists('/package.json')).to.true;
			expect(await fileSystem.fileExists('./package.json')).to.be.true;
		});
		it('should return false if a file doesnt exist', async () => {
			expect(await fileSystem.fileExists('./apivheoirvaifvjaoiergalenrbna')).to.be.false;
		});
	});

	describe('listFilesInDirectory', () => {
		const fileSystem = new FileSystem();
		it('should list files and folders only in the current directory', async () => {
			const files: string[] = await fileSystem.listFilesInDirectory('./');
			expect(files).to.include('package.json');
			expect(files).to.include('node_modules');
			expect(files).not.to.include('src/index.ts');
		});
		it('should list files and folders in the src directory', async () => {
			let files: string[] = await fileSystem.listFilesInDirectory('./src');
			expect(files).to.include('src/index.ts');
			expect(files).not.to.include('package.json');

			files = await fileSystem.listFilesInDirectory('src');
			expect(files).to.include('src/index.ts');
			expect(files).not.to.include('package.json');
		});
	});

	describe('getMultipleFileContentsAsXml', () => {
		const fileSystem = new FileSystem();
		it('should list files and folders only in the current directory', async () => {
			const paths = ['package.json', '/README.md', '/src/index.ts'];
			const contents: string = await fileSystem.getMultipleFileContentsAsXml(paths);
			console.log(contents);
			expect(contents).to.include('file_content file_path="package.json"');
			expect(contents).to.include('file_content file_path="README.md"');
			expect(contents).to.include('file_content file_path="src/index.ts"');
		});
		it.skip('should list files and folders in the src directory', async () => {
			let files: string[] = await fileSystem.listFilesInDirectory('./src');
			expect(files).to.include('src/index.ts');
			expect(files).not.to.include('package.json');

			files = await fileSystem.listFilesInDirectory('src');
			expect(files).to.include('src/index.ts');
			expect(files).not.to.include('package.json');
		});
	});

	describe('', () => {
		it('should', async () => {
			// expect().to.equal();
		});
	});
});