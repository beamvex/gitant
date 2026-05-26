import * as vscode from 'vscode';
import { GitHubGhTreeDataProvider } from './githubTree';
import { setGhOutputChannel } from './gh';

export function activate(context: vscode.ExtensionContext) {
  const ghOutput = vscode.window.createOutputChannel('GitHub (gh) Explorer');
  setGhOutputChannel(ghOutput);
  context.subscriptions.push(ghOutput);

  const provider = new GitHubGhTreeDataProvider();
  const treeView = vscode.window.createTreeView('githubGhExplorer', {
    treeDataProvider: provider,
    showCollapseAll: true,
  });

  context.subscriptions.push(treeView);

  context.subscriptions.push(
    vscode.commands.registerCommand('githubGhExplorer.refresh', () => provider.refresh()),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('githubGhExplorer.openInBrowser', async (item: unknown) => {
      if (!item || typeof item !== 'object') {
        return;
      }
      const anyItem = item as { url?: string };
      if (!anyItem.url) {
        return;
      }
      await vscode.env.openExternal(vscode.Uri.parse(anyItem.url));
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('githubGhExplorer.copyCloneUrl', async (item: unknown) => {
      if (!item || typeof item !== 'object') {
        return;
      }
      const anyItem = item as { cloneUrl?: string };
      if (!anyItem.cloneUrl) {
        return;
      }
      await vscode.env.clipboard.writeText(anyItem.cloneUrl);
      void vscode.window.setStatusBarMessage('Clone URL copied', 2000);
    }),
  );
}

export function deactivate() {}
