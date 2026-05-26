import * as vscode from 'vscode';
import { runGhJson, runGh } from './gh';

export type GhRepo = {
  name: string;
  owner: { login: string };
  description: string | null;
  isPrivate: boolean;
  url: string;
  sshUrl: string;
};

type RepoBranch = {
  name: string;
};

class AccountNode extends vscode.TreeItem {
  constructor(public readonly login: string) {
    super(login, vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = 'githubAccount';
  }
}

class RepoNode extends vscode.TreeItem {
  public readonly url: string;
  public readonly cloneUrl: string;

  constructor(public readonly repo: GhRepo) {
    super(repo.name, vscode.TreeItemCollapsibleState.Collapsed);
    this.description = repo.isPrivate ? 'private' : '';
    this.tooltip = repo.description ?? '';
    this.contextValue = 'githubRepo';
    this.url = repo.url;
    this.cloneUrl = repo.sshUrl;
    this.iconPath = new vscode.ThemeIcon(repo.isPrivate ? 'lock' : 'repo');
  }
}

class BranchNode extends vscode.TreeItem {
  constructor(public readonly branchName: string) {
    super(branchName, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'githubBranch';
    this.iconPath = new vscode.ThemeIcon('git-branch');
  }
}

export class GitHubGhTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private cachedLogin: string | null = null;
  private cachedRepos: GhRepo[] | null = null;

  refresh(): void {
    this.cachedLogin = null;
    this.cachedRepos = null;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    try {
      if (!element) {
        const login = await this.getLogin();
        return [new AccountNode(login)];
      }

      if (element instanceof AccountNode) {
        const repos = await this.getRepos(element.login);
        return repos
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((r) => new RepoNode(r));
      }

      if (element instanceof RepoNode) {
        const branches = await this.getBranches(element.repo.owner.login, element.repo.name);
        return branches
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((b) => new BranchNode(b.name));
      }

      return [];
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const item = new vscode.TreeItem('Error: ' + msg, vscode.TreeItemCollapsibleState.None);
      item.iconPath = new vscode.ThemeIcon('error');
      return [item];
    }
  }

  private async getLogin(): Promise<string> {
    if (this.cachedLogin) {
      return this.cachedLogin;
    }

    const res = await runGh(['api', 'user', '--jq', '.login']);
    if (res.exitCode !== 0) {
      const message = (res.stderr || res.stdout || '').trim();
      throw new Error(
        message ||
          'Failed to run gh. Ensure `gh` is installed and you are logged in (`gh auth login`).',
      );
    }

    const login = res.stdout.trim();
    if (!login) {
      throw new Error('Could not determine GitHub login from `gh api user`.');
    }

    this.cachedLogin = login;
    return login;
  }

  private async getRepos(login: string): Promise<GhRepo[]> {
    if (this.cachedRepos) {
      return this.cachedRepos;
    }

    const repos = await runGhJson<GhRepo[]>([
      'repo',
      'list',
      login,
      '--limit',
      '200',
      '--json',
      'name,owner,description,isPrivate,url,sshUrl',
    ]);

    this.cachedRepos = repos;
    return repos;
  }

  private async getBranches(owner: string, repo: string): Promise<RepoBranch[]> {
    return await runGhJson<RepoBranch[]>([
      'api',
      `repos/${owner}/${repo}/branches?per_page=100`,
    ]);
  }
}
