import { App, Modal, Notice, TFile } from "obsidian";
import { ApiClient, Category, Tag, ArticleSaveRequest, encodeArticleId, decodeArticleId, stripFrontmatter } from "./api";

export class PublishModal extends Modal {
  private api: ApiClient;
  private file: TFile;

  private title = "";
  private summary = "";
  private coverImage = "";
  private content = "";

  private categories: Category[] = [];
  private tags: Tag[] = [];
  private categoryId = 0;
  private tagIds: number[] = [];
  private articleId: number | undefined;
  private hasInvalidArticleId = false;

  private searchCategory = "";
  private searchTag = "";

  // DOM refs
  private titleInput!: HTMLInputElement;
  private summaryInput!: HTMLTextAreaElement;
  private coverUrlInput!: HTMLInputElement;

  constructor(
    app: App,
    api: ApiClient,
    file: TFile,
    frontmatter: Record<string, unknown> | undefined,
    content: string,
  ) {
    super(app);
    this.api = api;
    this.file = file;
    this.content = stripFrontmatter(content);

    const fm = frontmatter || {};
    this.title = String(fm.title || file.basename || "");
    this.summary = String(fm.summary || "");
    this.coverImage = String(fm.coverImage || fm.cover_image || "");
    const catName = fm.category ? String(fm.category) : "";
    const tagNames: string[] = fm.tags && Array.isArray(fm.tags) ? fm.tags.map(String) : [];
    this.hasInvalidArticleId = (fm.article_id !== undefined && fm.article_id !== null) && !decodeArticleId(fm.article_id);
    this.articleId = decodeArticleId(fm.article_id);

    if (catName) this.searchCategory = catName;

    // 暂存，等拉完列表再解析 ID
    this._pendingCatName = catName;
    this._pendingTagNames = tagNames;
  }

  private _pendingCatName = "";
  private _pendingTagNames: string[] = [];

  async onOpen(): Promise<void> {
    this.modalEl.addClass("blog-publisher-modal");
    this.setTitle(this.articleId ? "编辑并发布" : "发布文章");

    try {
      [this.categories, this.tags] = await Promise.all([
        this.api.fetchCategories(),
        this.api.fetchTags(),
      ]);

      const matched = this.categories.find((c) => c.name === this._pendingCatName);
      if (matched) this.categoryId = matched.id;
      for (const name of this._pendingTagNames) {
        const t = this.tags.find((t) => t.name === name);
        if (t) this.tagIds.push(t.id);
      }
    } catch (e) {
      new Notice(`无法连接到后端: ${e}`);
      this.close();
      return;
    }

    this.render();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();

    // ── 标题 ──
    contentEl.createEl("label", { text: "标题" });
    this.titleInput = contentEl.createEl("input", { type: "text", attr: { placeholder: "文章标题" } });
    this.titleInput.value = this.title;
    this.titleInput.addEventListener("input", () => { this.title = this.titleInput.value; });
    this.titleInput.addEventListener("blur", () => this.saveTextFieldsToFrontmatter());

    // ── 摘要 ──
    contentEl.createEl("label", { text: "摘要" });
    this.summaryInput = contentEl.createEl("textarea");
    this.summaryInput.value = this.summary;
    this.summaryInput.style.minHeight = "80px";
    this.summaryInput.addEventListener("input", () => { this.summary = this.summaryInput.value; });
    this.summaryInput.addEventListener("blur", () => this.saveTextFieldsToFrontmatter());

    // ── 封面 ──
    this.renderCover(contentEl);

    // ── 分类 ──
    this.renderCategory(contentEl);

    // ── 标签 ──
    this.renderTags(contentEl);

    // ── 统计 ──
    const wordCount = this.content.length;
    const imgCount = (this.content.match(/!\[\[.*?\]\]|!\[.*?\]\(.*?\)/g) || []).length;
    contentEl.createEl("div", { text: `字数: ${wordCount}  |  图片: ${imgCount} 张`, cls: "bp-stats" });

    // ── 按钮 ──
    const actions = contentEl.createDiv({ cls: "bp-actions" });
    actions.createEl("button", { text: "存草稿", cls: "bp-draft-btn" }).addEventListener("click", () => this.submit(0));
    actions.createEl("button", { text: this.articleId ? "更新发布" : "发布", cls: "bp-publish-btn mod-cta" }).addEventListener("click", () => this.submit(1));
  }

  // ═══ 封面 ═══

  private renderCover(container: HTMLElement): void {
    container.createEl("label", { text: "封面图片" });
    const fileInput = container.createEl("input", { type: "file", attr: { accept: "image/*" } });
    fileInput.style.display = "none";

    const row = container.createDiv();
    row.style.cssText = "display:flex;gap:8px;align-items:center;margin-bottom:4px;";
    const uploadBtn = row.createEl("button", { text: "上传图片", cls: "mod-cta" });
    uploadBtn.style.cssText = "flex-shrink:0;";
    uploadBtn.addEventListener("click", () => fileInput.click());
    this.coverUrlInput = row.createEl("input", { type: "text", attr: { placeholder: "或粘贴 URL" } });
    this.coverUrlInput.value = this.coverImage;

    const previewDiv = container.createDiv();
    previewDiv.style.cssText = "margin-bottom:8px;";
    const previewImg = previewDiv.createEl("img");
    previewImg.style.cssText = "max-width:100%;max-height:120px;border-radius:8px;object-fit:cover;";
    if (this.coverImage) { previewImg.src = this.coverImage; } else { previewDiv.style.display = "none"; }

    this.coverUrlInput.addEventListener("input", () => {
      this.coverImage = this.coverUrlInput.value;
      if (this.coverImage) { previewImg.src = this.coverImage; previewDiv.style.display = ""; }
      else { previewDiv.style.display = "none"; }
    });
    this.coverUrlInput.addEventListener("blur", () => this.saveTextFieldsToFrontmatter());

    fileInput.addEventListener("change", async () => {
      const f = fileInput.files?.[0];
      if (!f) return;
      uploadBtn.textContent = "上传中...";
      uploadBtn.disabled = true;
      try {
        const media = await this.api.uploadImage(f);
        this.coverImage = media.fileUrl;
        this.coverUrlInput.value = media.fileUrl;
        previewImg.src = media.fileUrl;
        previewDiv.style.display = "";
        new Notice("图片已上传");
      } catch (e) { new Notice(`上传失败: ${e}`); }
      finally { uploadBtn.textContent = "上传图片"; uploadBtn.disabled = false; }
    });
  }

  // ═══ 分类 ═══

  private renderCategory(container: HTMLElement): void {
    container.createEl("label", { text: "分类" });
    const catInput = container.createEl("input", { type: "text", attr: { placeholder: "搜索分类..." } });
    catInput.value = this.searchCategory;
    const catList = container.createDiv({ cls: "bp-tags" });
    catList.style.maxHeight = "150px";

    const renderList = () => {
      catList.empty();
      const q = this.searchCategory.trim().toLowerCase();
      const filtered = this.categories.filter((c) => c.name.toLowerCase().includes(q));

      if (q && !this.categories.find((c) => c.name.toLowerCase() === q)) {
        const add = catList.createEl("button", { type: "button" });
        add.textContent = `+ 新增「${this.searchCategory.trim()}」`;
        add.addEventListener("click", () => this.createCategory(this.searchCategory.trim()));
      }

      for (const c of filtered) {
        const btn = catList.createEl("button", { type: "button" });
        btn.textContent = c.name;
        if (c.id === this.categoryId) btn.style.cssText = "font-weight:700;color:var(--color-accent);";
        btn.addEventListener("click", () => { this.categoryId = c.id; this.searchCategory = c.name; catInput.value = c.name; renderList(); this.saveCategoryToFrontmatter(); });
      }

      if (filtered.length === 0 && !q) catList.createEl("div", { text: "暂无分类", cls: "bp-empty" });
    };
    catInput.addEventListener("input", () => { this.searchCategory = catInput.value; renderList(); });
    renderList();
  }

  // ═══ 标签 ═══

  private renderTags(container: HTMLElement): void {
    container.createEl("label", { text: "标签" });
    const tagInput = container.createEl("input", { type: "text", attr: { placeholder: "搜索标签..." } });

    const bar = container.createDiv();
    bar.style.cssText = "display:flex;flex-wrap:wrap;gap:4px;margin:4px 0;";

    const renderBar = () => {
      bar.empty();
      for (const id of this.tagIds) {
        const t = this.tags.find((t) => t.id === id);
        if (!t) continue;
        const chip = bar.createEl("span");
        chip.style.cssText = "display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:12px;font-size:12px;background:var(--color-accent);color:var(--text-on-accent);";
        chip.textContent = t.name;
        const rm = chip.createEl("span"); rm.textContent = "×";
        rm.style.cssText = "cursor:pointer;font-weight:bold;";
        rm.addEventListener("click", () => { this.tagIds = this.tagIds.filter((i) => i !== id); renderBar(); renderList(); this.saveTagStateToFrontmatter(); });
      }
    };

    const tagList = container.createDiv({ cls: "bp-tags" });

    const renderList = () => {
      tagList.empty();
      const q = this.searchTag.trim().toLowerCase();
      const filtered = this.tags.filter((t) => t.name.toLowerCase().includes(q));

      if (q && !this.tags.find((t) => t.name.toLowerCase() === q)) {
        const add = tagList.createEl("button", { type: "button" });
        add.textContent = `+ 新增「${this.searchTag.trim()}」`;
        add.addEventListener("click", () => this.createTag(this.searchTag.trim()).then(() => { renderBar(); renderList(); }));
      }

      for (const t of filtered) {
        const sel = this.tagIds.includes(t.id);
        const label = tagList.createEl("label");
        const cb = label.createEl("input", { type: "checkbox" });
        cb.checked = sel;
        label.appendText(" " + t.name);
        cb.addEventListener("change", () => {
          if (cb.checked) this.tagIds.push(t.id); else this.tagIds = this.tagIds.filter((i) => i !== t.id);
          renderBar();
          this.saveTagStateToFrontmatter();
        });
      }

      if (filtered.length === 0 && !q) tagList.createEl("div", { text: "暂无标签", cls: "bp-empty" });
    };

    tagInput.addEventListener("input", () => { this.searchTag = tagInput.value; renderList(); });
    renderBar();
    renderList();
  }

  // ═══ 创建分类/标签 ═══

  private async createCategory(name: string): Promise<void> {
    try {
      const created = await this.api.createCategory(name);
      this.categories.push(created);
      this.categoryId = created.id;
      this.searchCategory = created.name;
      await this.saveCategoryToFrontmatter();
      this.render();
      new Notice(`分类已创建 → ${name}`);
    } catch (e) { new Notice(`创建失败: ${e}`); }
  }

  private async createTag(name: string): Promise<void> {
    try {
      const created = await this.api.createTag(name);
      this.tags.push(created);
      this.tagIds.push(created.id);
      this.searchTag = "";
      await this.saveTagStateToFrontmatter();
      this.render();
      new Notice(`标签已创建 → ${name}`);
    } catch (e) { new Notice(`创建失败: ${e}`); }
  }

  // ═══ 即时保存到 frontmatter（关弹窗/勾选时自动存） ═══

  private async saveTagStateToFrontmatter(): Promise<void> {
    const tagNames = this.tags.filter((t) => this.tagIds.includes(t.id)).map((t) => t.name);
    await this.app.fileManager.processFrontMatter(this.file, (fm) => {
      if (tagNames.length > 0) fm.tags = tagNames; else delete fm.tags;
    });
  }

  private async saveCategoryToFrontmatter(): Promise<void> {
    const catName = this.categories.find((c) => c.id === this.categoryId)?.name || "";
    await this.app.fileManager.processFrontMatter(this.file, (fm) => {
      if (catName) fm.category = catName; else delete fm.category;
    });
  }

  private async saveTextFieldsToFrontmatter(): Promise<void> {
    const title = this.titleInput?.value.trim() || this.title;
    const summary = this.summaryInput?.value.trim() || this.summary;
    const coverUrl = this.coverUrlInput?.value.trim() || this.coverImage;
    await this.app.fileManager.processFrontMatter(this.file, (fm) => {
      fm.title = title;
      fm.summary = summary || undefined;
      if (coverUrl) { fm.coverImage = coverUrl; delete fm.cover_image; }
      else { delete fm.coverImage; delete fm.cover_image; }
    });
  }

  private async saveAllToFrontmatter(): Promise<void> {
    const title = this.titleInput?.value.trim() || this.title;
    const summary = this.summaryInput?.value.trim() || this.summary;
    const coverUrl = this.coverUrlInput?.value.trim() || this.coverImage;
    const catName = this.categories.find((c) => c.id === this.categoryId)?.name || "";
    const tagNames = this.tags.filter((t) => this.tagIds.includes(t.id)).map((t) => t.name);

    await this.app.fileManager.processFrontMatter(this.file, (fm) => {
      fm.title = title;
      fm.summary = summary || undefined;
      if (coverUrl) { fm.coverImage = coverUrl; delete fm.cover_image; }
      else { delete fm.coverImage; delete fm.cover_image; }
      if (catName) fm.category = catName; else delete fm.category;
      if (tagNames.length > 0) fm.tags = tagNames; else delete fm.tags;
    });
  }

  // ═══ 提交 ═══

  private async submit(isPublished: number): Promise<void> {
    this.title = this.titleInput.value.trim();
    this.summary = this.summaryInput.value.trim();
    this.coverImage = this.coverUrlInput.value.trim();

    if (!this.title) { new Notice("标题不能为空"); return; }
    if (!this.categoryId) { new Notice("请选择分类"); return; }
    if (this.hasInvalidArticleId) { new Notice("article_id 格式无效，无法更新"); return; }

    // 先保存到 frontmatter
    const catName = this.categories.find((c) => c.id === this.categoryId)?.name || "";
    const tagNames = this.tags.filter((t) => this.tagIds.includes(t.id)).map((t) => t.name);
    await this.app.fileManager.processFrontMatter(this.file, (fm) => {
      fm.title = this.title;
      fm.summary = this.summary || undefined;
      if (this.coverImage) { fm.coverImage = this.coverImage; delete fm.cover_image; }
      else { delete fm.coverImage; delete fm.cover_image; }
      if (catName) fm.category = catName; else delete fm.category;
      if (tagNames.length > 0) fm.tags = tagNames; else delete fm.tags;
    });

    const article: ArticleSaveRequest = {
      title: this.title,
      summary: this.summary,
      content: this.content,
      coverImage: this.coverImage || undefined,
      categoryId: this.categoryId,
      tagIds: this.tagIds,
      isPublished,
    };

    try {
      if (this.articleId) {
        article.id = this.articleId;
        await this.api.updateArticle(article);
        new Notice("文章更新成功！");
      } else {
        const created = await this.api.createArticle(article);
        await this.app.fileManager.processFrontMatter(this.file, (fm) => {
          fm.article_id = encodeArticleId(created.id);
        });
        new Notice("文章发布成功！");
      }
      this.close();
    } catch (e) { new Notice(`发布失败: ${e}`); }
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}
