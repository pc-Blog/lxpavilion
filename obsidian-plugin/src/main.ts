import { Plugin, PluginSettingTab, Setting, Notice, MarkdownView, TFile, Editor } from "obsidian";
import { ApiClient, ArticleSaveRequest, encodeArticleId, decodeArticleId, stripFrontmatter } from "./api";
import { PublishModal } from "./publish-modal";
import { ArticleSelectorModal } from "./article-selector";

interface BlogPublisherSettings {
  backendUrl: string;
  autoUploadPaste: boolean;
}

const DEFAULT_SETTINGS: BlogPublisherSettings = {
  backendUrl: "http://localhost:18016/api",
  autoUploadPaste: true,
};

export default class BlogPublisherPlugin extends Plugin {
  settings: BlogPublisherSettings;
  api: ApiClient;
  private headerActions: HTMLElement[] = [];
  private previousView: MarkdownView | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.api = new ApiClient(this.settings.backendUrl);

    this.addCommand({
      id: "publish-current-note",
      name: "打开发布面板",
      callback: () => this.openPublishModal(),
    });
    this.addCommand({
      id: "quick-publish",
      name: "快速发布/更新",
      callback: () => this.quickPublish(),
    });
    this.addCommand({
      id: "select-article",
      name: "选择已有文章进行更新",
      callback: () => this.openArticleSelector(),
    });

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu) => {
        menu.addItem((item) => item.setTitle("打开发布面板").setIcon("pencil").onClick(() => this.openPublishModal()));
        menu.addItem((item) => item.setTitle("快速发布/更新").setIcon("send").onClick(() => this.quickPublish()));
        menu.addItem((item) => item.setTitle("选择已有文章").setIcon("search").onClick(() => this.openArticleSelector()));
      }),
    );

    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => this.updateHeaderActions()),
    );
    this.app.workspace.onLayoutReady(() => this.updateHeaderActions());

    // ── 粘贴图片自动上传 ──
    this.registerEvent(
      this.app.workspace.on("editor-paste", (evt: ClipboardEvent, editor: Editor) => {
        if (!this.settings.autoUploadPaste) return;
        const files = evt.clipboardData?.files;
        if (!files || files.length === 0) return;
        const img = Array.from(files).find((f) => f.type.startsWith("image/"));
        if (!img) return;

        evt.preventDefault();
        this.pasteAndUpload(editor, img);
      }),
    );

    this.addSettingTab(new BlogPublisherSettingTab(this.app, this));
  }

  onunload(): void {
    this.cleanupHeaderActions();
  }

  // ── 粘贴图片自动上传 ──

  private async pasteAndUpload(editor: Editor, file: File): Promise<void> {
    new Notice("正在上传图片...");
    try {
      const media = await this.api.uploadImage(file);
      const cursor = editor.getCursor();
      editor.replaceRange(`![${file.name}](${media.fileUrl})`, cursor);
      new Notice("图片已上传 ✅");
    } catch (e) {
      new Notice(`图片上传失败: ${e}`);
    }
  }

  private updateHeaderActions(): void {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (view === this.previousView) return;
    this.previousView = view;
    this.cleanupHeaderActions();
    if (!view) return;

    try {
      this.headerActions.push(
        view.addAction("pencil", "打开发布面板", () => this.openPublishModal()),
      );
      this.headerActions.push(
        view.addAction("send", "快速发布/更新", () => this.quickPublish()),
      );
      this.headerActions.push(
        view.addAction("search", "选择已有文章", () => this.openArticleSelector()),
      );
    } catch (e) {
      console.warn("[Blog Publisher] addAction failed:", e);
    }
  }

  private cleanupHeaderActions(): void {
    for (const el of this.headerActions) el.remove();
    this.headerActions = [];
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.api = new ApiClient(this.settings.backendUrl);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.api = new ApiClient(this.settings.backendUrl);
  }

  // ── 完整发布面板 ──

  private async openArticleSelector(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file || file.extension !== "md") { new Notice("请先打开一个 Markdown 文件"); return; }
    new ArticleSelectorModal(this.app, this.api, file).open();
  }

  private async openPublishModal(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file || file.extension !== "md") {
      new Notice("请先打开一个 Markdown 文件");
      return;
    }
    const metadata = this.app.metadataCache.getFileCache(file)?.frontmatter;
    const content = await this.app.vault.read(file);
    new PublishModal(this.app, this.api, file, metadata, content).open();
  }

  // ── 快速发布/更新 ──

  private async quickPublish(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file || file.extension !== "md") {
      new Notice("请先打开一个 Markdown 文件");
      return;
    }

    // 直接读文件，不走 cache
    const rawContent = await this.app.vault.read(file);
    const fm = this.parseFrontmatter(rawContent);
    const content = stripFrontmatter(rawContent);

    const title = (fm?.title as string)?.trim() || file.basename;
    const summary = (fm?.summary as string)?.trim() || "";
    const coverImage = String(fm?.coverImage || fm?.cover_image || "");
    const catName = fm?.category ? String(fm.category) : "";
    const tagNames: string[] = fm?.tags && Array.isArray(fm.tags) ? fm.tags.map(String) : [];
    const articleId = decodeArticleId(fm?.article_id);
    const hasInvalidArticleId = (fm?.article_id !== undefined && fm?.article_id !== null) && !articleId;

    // 校验
    if (!title) { new Notice("标题为空"); return; }
    if (!catName) { new Notice("请在 frontmatter 中设置 category"); return; }
    if (hasInvalidArticleId) { new Notice("article_id 格式无效，无法更新"); return; }

    // 获取分类/标签 ID
    let categoryId = 0;
    const tagIds: number[] = [];

    try {
      const [categories, tags] = await Promise.all([
        this.api.fetchCategories(),
        this.api.fetchTags(),
      ]);

      const matched = categories.find((c) => c.name === catName);
      if (!matched) { new Notice(`分类「${catName}」不存在`); return; }
      categoryId = matched.id;

      for (const name of tagNames) {
        const t = tags.find((t) => t.name === name);
        if (t) tagIds.push(t.id);
      }
    } catch (e) {
      new Notice(`连接后端失败: ${e}`);
      return;
    }

    // 提交
    const article: ArticleSaveRequest = { title, summary, content, coverImage: coverImage || undefined, categoryId, tagIds, isPublished: 1 };

    try {
      if (articleId) {
        article.id = articleId;
        await this.api.updateArticle(article);
        new Notice("文章更新成功！");
      } else {
        const created = await this.api.createArticle(article);
        await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
          fm.article_id = encodeArticleId(created.id);
        });
        new Notice("文章发布成功！");
      }
    } catch (e) {
      new Notice(`发布失败: ${e}`);
    }
  }

  // ── frontmatter 解析 ──

  private parseFrontmatter(content: string): Record<string, unknown> | null {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return null;
    const lines = match[1].split("\n");
    const result: Record<string, unknown> = {};
    for (const line of lines) {
      if (line.includes(": [")) {
        const kv = line.match(/^(\w+):\s*\[(.*)\]/);
        if (kv) result[kv[1]] = kv[2].split(",").map((s) => s.trim().replace(/['"]/g, ""));
        continue;
      }
      const kv = line.match(/^(\w+):\s*(.+)$/);
      if (kv) result[kv[1]] = kv[2];
    }
    return result;
  }
}

class BlogPublisherSettingTab extends PluginSettingTab {
  plugin: BlogPublisherPlugin;

  constructor(app: typeof BlogPublisherPlugin.prototype.app, plugin: BlogPublisherPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Blog Publisher 设置" });

    new Setting(containerEl)
      .setName("后端 API 地址")
      .setDesc("Java 后端的 base URL，默认 http://localhost:18016/api")
      .addText((text) =>
        text
          .setPlaceholder("http://localhost:18016/api")
          .setValue(this.plugin.settings.backendUrl)
          .onChange(async (value) => {
            this.plugin.settings.backendUrl = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("粘贴图片自动上传")
      .setDesc("复制/截图后直接 Ctrl+V 粘贴到笔记中，自动上传并插入 URL")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoUploadPaste)
          .onChange(async (value) => {
            this.plugin.settings.autoUploadPaste = value;
            await this.plugin.saveSettings();
          }),
      );
  }
}
