import { App, Modal, Notice, TFile } from "obsidian";
import { ApiClient, encodeArticleId } from "./api";

export class ArticleSelectorModal extends Modal {
  private api: ApiClient;
  private file: TFile;
  private keyword = "";
  private pageNum = 1;
  private total = 0;
  private pageSize = 10;
  private loading = false;
  private debounceTimer: number | null = null;

  private listEl!: HTMLElement;
  private pageInfoEl!: HTMLElement;
  private searchInput!: HTMLInputElement;

  constructor(app: App, api: ApiClient, file: TFile) {
    super(app);
    this.api = api;
    this.file = file;
  }

  async onOpen(): Promise<void> {
    this.modalEl.addClass("blog-publisher-modal");
    this.setTitle("选择要更新的文章");

    const { contentEl } = this;
    contentEl.empty();

    this.searchInput = contentEl.createEl("input", { type: "text", attr: { placeholder: "搜索文章标题..." } });
    this.searchInput.focus();

    this.listEl = contentEl.createDiv({ cls: "bp-tags" });
    this.listEl.style.maxHeight = "400px";

    this.pageInfoEl = contentEl.createDiv();
    this.pageInfoEl.style.cssText = "display:flex;align-items:center;justify-content:space-between;margin-top:8px;gap:8px;";

    this.searchInput.addEventListener("input", () => {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        this.keyword = this.searchInput.value;
        this.pageNum = 1;
        this.fetchPage();
      }, 300);
    });

    this.fetchPage();
  }

  private async fetchPage(): Promise<void> {
    this.loading = true;
    this.listEl.empty();
    this.listEl.createEl("div", { text: "加载中...", cls: "bp-empty" });

    try {
      const data = await this.api.fetchArticles(this.keyword || undefined, this.pageNum, this.pageSize);
      this.total = data.total;
      this.listEl.empty();

      if (data.rows.length === 0) {
        this.listEl.createEl("div", { text: this.keyword ? "无匹配文章" : "暂无文章", cls: "bp-empty" });
        this.renderPagination();
        return;
      }

      for (const a of data.rows) {
        const btn = this.listEl.createEl("button", { type: "button" });
        const status = a.isPublished ? "已发布" : "草稿";
        btn.textContent = `${a.title}  [${a.categoryName || "未分类"}]  (${status})`;
        btn.addEventListener("click", () => this.selectArticle(a.id, a.title));
      }
    } catch (e) {
      this.listEl.empty();
      this.listEl.createEl("div", { text: `加载失败: ${e}`, cls: "bp-empty" });
    } finally {
      this.loading = false;
      this.renderPagination();
    }
  }

  private renderPagination(): void {
    this.pageInfoEl.empty();
    if (this.total === 0) return;
    const totalPages = Math.ceil(this.total / this.pageSize);
    const info = this.pageInfoEl.createEl("span");
    info.style.cssText = "font-size:0.85em;color:var(--text-muted);";
    info.textContent = `共 ${this.total} 篇  第 ${this.pageNum}/${totalPages} 页`;

    const btnGroup = this.pageInfoEl.createDiv();
    btnGroup.style.cssText = "display:flex;gap:4px;";
    const prevBtn = btnGroup.createEl("button", { text: "上一页" });
    prevBtn.disabled = this.pageNum <= 1;
    prevBtn.addEventListener("click", () => { if (this.pageNum > 1) { this.pageNum--; this.fetchPage(); } });
    const nextBtn = btnGroup.createEl("button", { text: "下一页" });
    nextBtn.disabled = this.pageNum >= totalPages;
    nextBtn.addEventListener("click", () => { if (this.pageNum < totalPages) { this.pageNum++; this.fetchPage(); } });
  }

  private async selectArticle(id: number, title: string): Promise<void> {
    // 1. 从后端拉文章详情
    let detail: Awaited<ReturnType<typeof this.api.getArticleDetail>>;
    try {
      detail = await this.api.getArticleDetail(id);
    } catch (e) {
      new Notice(`加载文章失败: ${e}`);
      return;
    }

    // 2. 拼 frontmatter YAML
    const tagNames = (detail.tags || []).map((t) => t.name);
    const yamlParts: string[] = [];
    yamlParts.push("---");
    yamlParts.push(`title: ${detail.title}`);
    yamlParts.push(`summary: ${detail.summary || ""}`);
    if (detail.coverImage) yamlParts.push(`coverImage: ${detail.coverImage}`);
    if (detail.categoryName) yamlParts.push(`category: ${detail.categoryName}`);
    if (tagNames.length > 0) yamlParts.push(`tags: [${tagNames.join(", ")}]`);
    yamlParts.push(`article_id: ${encodeArticleId(id)}`);
    yamlParts.push("---");

    // 3. 完整内容：frontmatter + 正文
    const newContent = yamlParts.join("\n") + "\n" + (detail.content || "");

    // 4. 写入文件
    try {
      await this.app.vault.modify(this.file, newContent);
      new Notice(`已加载文章「${detail.title}」到当前文件`);
    } catch (e) {
      new Notice(`写入文件失败: ${e}`);
      return;
    }

    this.close();
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}
