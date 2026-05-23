import { KanbanView } from "./kanban-view";
import { TFile, setIcon, setTooltip } from "obsidian";
import { TagEditModal } from "./tag-edit-modal";

export class Tags {
  private view: KanbanView;
  public activeFilters: Set<string> = new Set();

  constructor(view: KanbanView) {
    this.view = view;
  }

  public extractTagsFromFile(file: TFile): string[] {
    const cache = this.view.app.metadataCache.getFileCache(file);
    const tags = (cache?.frontmatter?.tags ??
      cache?.frontmatter?.tag) as unknown;
    let fileTags: string[] = [];
    if (Array.isArray(tags)) {
      fileTags = tags.filter((t): t is string => typeof t === "string");
    } else if (typeof tags === "string") {
      fileTags = tags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t);
    }
    // Strip '#' prefix — Obsidian's MetadataCache sometimes normalises
    // frontmatter tags with a leading '#' (e.g. "#my-tag" instead of "my-tag").
    fileTags = fileTags.map((t) => (t.startsWith("#") ? t.slice(1) : t));

    // Auto-tag: add the top-level folder name so projects can be filtered by
    // folder without manual frontmatter tags (e.g. "Personal", "MUNK").
    // Files at vault root (e.g. "Readme.md") have no folder tag.
    const pathParts = file.path.split("/");
    if (pathParts.length > 1) {
      const folderTag = pathParts[0];
      if (!fileTags.includes(folderTag)) {
        fileTags.push(folderTag);
      }
    }

    return fileTags;
  }

  public promptEditTags(file: TFile): void {
    const currentTags = this.extractTagsFromFile(file);
    new TagEditModal(this.view.app, currentTags, this, (newTags: string[]) => {
      void this.view.app.fileManager.processFrontMatter(
        file,
        (fm: Record<string, unknown>) => {
          if (newTags.length === 0) {
            delete fm.tags;
            delete fm.tag;
          } else {
            fm.tags = newTags;
          }
        },
      );
    }).open();
  }

  public renderFilterBar(container: HTMLElement): void {
    const allTags = new Set<string>();

    for (const group of this.view.currentGroups) {
      for (const entry of group.entries) {
        if (entry.file instanceof TFile) {
          const fileTags = this.extractTagsFromFile(entry.file);
          fileTags.forEach((t) => allTags.add(t));
        }
      }
    }

    if (allTags.size === 0 && this.activeFilters.size === 0) {
      return;
    }

    // Insert before the board
    const boardEl = container.querySelector(".base-board-board");
    if (!boardEl) return;

    const barEl = container.createDiv({ cls: "base-board-filter-bar" });
    container.insertBefore(barEl, boardEl);

    const titleEl = barEl.createSpan({
      cls: "base-board-filter-title",
      text: "Filters:",
    });
    setIcon(titleEl, "lucide-filter");

    const tagsArray = Array.from(allTags).sort();

    // Also include any active filters that might not be in the current cards
    for (const activeTag of this.activeFilters) {
      if (!allTags.has(activeTag)) tagsArray.push(activeTag);
    }

    for (const tag of tagsArray) {
      const pill = barEl.createSpan({ cls: "base-board-filter-pill" });
      pill.textContent = tag;
      pill.addClass("base-board-filter-pill--plain");

      if (this.activeFilters.has(tag)) {
        pill.addClass("is-active");
      }

      setTooltip(pill, "Click to filter by this tag");

      pill.addEventListener("click", () => {
        if (this.activeFilters.has(tag)) {
          this.activeFilters.delete(tag);
        } else {
          this.activeFilters.add(tag);
        }
        this.view.scheduleRender();
      });
    }

    if (this.activeFilters.size > 0) {
      const clearBtn = barEl.createSpan({
        cls: "base-board-filter-clear",
        text: "Clear",
      });
      clearBtn.addEventListener("click", () => {
        this.activeFilters.clear();
        this.view.scheduleRender();
      });
    }
  }
}
