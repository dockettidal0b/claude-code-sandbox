import Docker from 'dockerode';
import { simpleGit, SimpleGit } from 'simple-git';
import chalk from 'chalk';
import { CredentialManager } from './credentials';
import { GitMonitor } from './git-monitor';
import { ContainerManager } from './container';
import { UIManager } from './ui';
import { SandboxConfig } from './types';
import path from 'path';

export class ClaudeSandbox {
  private docker: Docker;
  private git: SimpleGit;
  private config: SandboxConfig;
  private credentialManager: CredentialManager;
  private gitMonitor: GitMonitor;
  private containerManager: ContainerManager;
  private ui: UIManager;

  constructor(config: SandboxConfig) {
    this.config = config;
    this.docker = new Docker();
    this.git = simpleGit();
    this.credentialManager = new CredentialManager();
    this.gitMonitor = new GitMonitor(this.git);
    this.containerManager = new ContainerManager(this.docker, config);
    this.ui = new UIManager();
  }

  async run(): Promise<void> {
    try {
      // Verify we're in a git repository
      await this.verifyGitRepo();

      // Check current branch
      const currentBranch = await this.git.branchLocal();
      console.log(chalk.blue(`Current branch: ${currentBranch.current}`));

      // Generate branch name (but don't switch yet)
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      const branchName = `claude/${timestamp}-${Date.now()}`;
      console.log(chalk.blue(`Will create branch in container: ${branchName}`));

      // Discover credentials
      const credentials = await this.credentialManager.discover();
      console.log(chalk.green('✓ Discovered credentials'));

      // Prepare container environment
      const containerConfig = await this.prepareContainer(branchName, credentials);

      // Start container
      const containerId = await this.containerManager.start(containerConfig);
      console.log(chalk.green(`✓ Started container: ${containerId.substring(0, 12)}`));

      // Start monitoring for commits
      this.gitMonitor.on('commit', async (commit) => {
        await this.handleCommit(commit);
      });

      await this.gitMonitor.start(branchName);
      console.log(chalk.blue('✓ Git monitoring started'));

      // Attach to container or run detached
      if (!this.config.detached) {
        console.log(chalk.blue('Preparing to attach to container...'));

        // Set up cleanup handler
        const cleanup = async () => {
          console.log(chalk.blue('\nShutting down...'));
          await this.cleanup();
          process.exit(0);
        };

        // Handle process signals
        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);

        try {
          console.log(chalk.gray('About to call attach method...'));
          await this.containerManager.attach(containerId, branchName);
          console.log(chalk.gray('Attach method completed'));
        } catch (error) {
          console.error(chalk.red('Failed to attach to container:'), error);
          await this.cleanup();
          throw error;
        }
      } else {
        console.log(chalk.blue('Running in detached mode. Container is running in the background.'));
        console.log(chalk.gray(`Container ID: ${containerId}`));
        console.log(chalk.yellow('\nTo connect to the container, run:'));
        console.log(chalk.white(`  docker attach ${containerId.substring(0, 12)}`));
        console.log(chalk.yellow('\nOr use docker exec for a new shell:'));
        console.log(chalk.white(`  docker exec -it ${containerId.substring(0, 12)} /bin/bash`));
        console.log(chalk.yellow('\nTo stop the container:'));
        console.log(chalk.white(`  docker stop ${containerId.substring(0, 12)}`));
        console.log(chalk.gray('\nThe container will continue running until you stop it manually.'));
      }

    } catch (error) {
      console.error(chalk.red('Error:'), error);
      throw error;
    }
  }

  private async verifyGitRepo(): Promise<void> {
    const isRepo = await this.git.checkIsRepo();
    if (!isRepo) {
      throw new Error('Not a git repository. Please run claude-sandbox from within a git repository.');
    }
  }


  private async prepareContainer(branchName: string, credentials: any): Promise<any> {
    const workDir = process.cwd();
    const repoName = path.basename(workDir);

    return {
      branchName,
      credentials,
      workDir,
      repoName,
      dockerImage: this.config.dockerImage || 'claude-sandbox:latest',
    };
  }

  private async handleCommit(commit: any): Promise<void> {
    // Show commit notification
    this.ui.showCommitNotification(commit);

    // Show diff
    const diff = await this.git.diff(['HEAD~1', 'HEAD']);
    this.ui.showDiff(diff);

    // Ask user what to do
    const action = await this.ui.askCommitAction();

    switch (action) {
      case 'nothing':
        console.log(chalk.blue('Continuing...'));
        break;
      case 'push':
        await this.pushBranch();
        break;
      case 'push-pr':
        await this.pushBranchAndCreatePR();
        break;
      case 'exit':
        await this.cleanup();
        process.exit(0);
    }
  }

  private async pushBranch(): Promise<void> {
    const currentBranch = await this.git.branchLocal();
    await this.git.push('origin', currentBranch.current);
    console.log(chalk.green(`✓ Pushed branch: ${currentBranch.current}`));
  }

  private async pushBranchAndCreatePR(): Promise<void> {
    await this.pushBranch();

    // Use gh CLI to create PR
    const { execSync } = require('child_process');
    try {
      execSync('gh pr create --fill', { stdio: 'inherit' });
      console.log(chalk.green('✓ Created pull request'));
    } catch (error) {
      console.error(chalk.yellow('Could not create PR automatically. Please create it manually.'));
    }
  }

  private async cleanup(): Promise<void> {
    await this.gitMonitor.stop();
    await this.containerManager.cleanup();
  }
}

export * from './types';