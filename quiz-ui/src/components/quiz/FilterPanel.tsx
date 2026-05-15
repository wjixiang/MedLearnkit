import { useState } from "react";
import { ChevronDown, ChevronRight, X, Filter } from "lucide-react";
import type { QuizFilterMeta, QuizFilter } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

interface FilterTreeProps {
  meta: QuizFilterMeta;
  filter: QuizFilter;
  onFilterChange: (filter: QuizFilter) => void;
  totalCount: number;
}

export function FilterPanel({
  meta,
  filter,
  onFilterChange,
  totalCount,
}: FilterTreeProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set(["types", "sources"]),
  );

  const toggleCollapse = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleSelectClass = (cls: string) => {
    if (filter.classes === cls) {
      onFilterChange({ ...filter, classes: undefined, units: undefined, page: 1 });
    } else {
      onFilterChange({ ...filter, classes: cls, units: undefined, page: 1 });
    }
  };

  const handleSelectUnit = (unit: string) => {
    if (filter.units === unit) {
      onFilterChange({ ...filter, units: undefined, page: 1 });
    } else {
      onFilterChange({ ...filter, units: unit, page: 1 });
    }
  };

  const handleSelectType = (type: string) => {
    if (filter.types === type) {
      onFilterChange({ ...filter, types: undefined, page: 1 });
    } else {
      onFilterChange({ ...filter, types: type, page: 1 });
    }
  };

  const handleSelectSource = (source: string) => {
    if (filter.sources === source) {
      onFilterChange({ ...filter, sources: undefined, page: 1 });
    } else {
      onFilterChange({ ...filter, sources: source, page: 1 });
    }
  };

  const handleClearAll = () => {
    onFilterChange({
      classes: undefined,
      types: undefined,
      units: undefined,
      sources: undefined,
      years: undefined,
      page: 1,
    });
  };

  const selections = [
    filter.classes && { key: "classes", value: filter.classes },
    filter.units && { key: "units", value: filter.units },
    filter.types && { key: "types", value: filter.types },
    filter.sources && { key: "sources", value: filter.sources },
  ].filter(Boolean) as { key: string; value: string }[];

  const hasActiveFilters = selections.length > 0;

  return (
    <div className="h-full flex flex-col bg-card">
      {/* Header */}
      <div className="px-4 py-3 border-b shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <Filter size={16} className="text-muted-foreground" />
          <h3 className="font-medium text-sm">筛选</h3>
          {hasActiveFilters && (
            <Badge variant="secondary" className="text-xs">
              {selections.length}
            </Badge>
          )}
        </div>

        {/* Active selections */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {selections.map((s) => (
              <Badge
                key={s.key}
                variant="outline"
                className="text-xs cursor-pointer hover:bg-primary/10 hover:border-primary/50 gap-1 px-1.5 py-0.5"
                onClick={() => {
                  if (s.key === "classes" || s.key === "units") {
                    onFilterChange({ ...filter, classes: undefined, units: undefined, page: 1 });
                  } else {
                    onFilterChange({ ...filter, [s.key]: undefined, page: 1 });
                  }
                }}
              >
                {s.value}
                <X size={10} />
              </Badge>
            ))}
          </div>
        )}

        {/* Result count */}
        <div className="text-xs text-muted-foreground">
          共{" "}
          <span className="font-medium text-foreground">
            {totalCount.toLocaleString()}
          </span>{" "}
          道题目
        </div>
      </div>

      {/* Filter groups */}
      <div className="flex-1 overflow-y-auto">
        {/* 科目 + 章节 联动 */}
        <div className="border-b">
          {/* 科目 */}
          <div
            className={`${collapsedGroups.has("class") ? "" : "border-b border-dashed border-muted"}`}
          >
            <button
              onClick={() => toggleCollapse("class")}
              className="flex items-center justify-between w-full px-4 py-2.5 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">科目</span>
                <span className="text-xs text-muted-foreground">
                  {meta.classes.length}
                </span>
              </div>
              <ChevronDown
                size={14}
                className={`text-muted-foreground transition-transform ${
                  collapsedGroups.has("class") ? "-rotate-90" : ""
                }`}
              />
            </button>

            {!collapsedGroups.has("class") && (
              <div className="px-2 pb-2">
                <div className="space-y-0.5 max-h-48 overflow-y-auto">
                  {meta.classes.map((cls) => {
                    const isSelected = filter.classes === cls;
                    const hasUnits = (meta.units[cls] || []).length > 0;
                    return (
                      <div key={cls}>
                        <button
                          onClick={() => handleSelectClass(cls)}
                          className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all flex items-center gap-2 ${
                            isSelected
                              ? "bg-primary text-primary-foreground font-medium"
                              : "hover:bg-muted"
                          }`}
                        >
                          <span className="flex-1 truncate">{cls}</span>
                          {hasUnits && (
                            <ChevronRight
                              size={12}
                              className="shrink-0 opacity-60"
                            />
                          )}
                        </button>

                        {/* 章节子选项 */}
                        {isSelected && hasUnits && (
                          <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-muted pl-2">
                            <button
                              onClick={() => handleSelectUnit(cls)}
                              className={`w-full text-left px-2 py-1.5 rounded text-xs transition-all ${
                                filter.units === cls
                                  ? "bg-primary/10 text-primary font-medium"
                                  : "hover:bg-muted"
                              }`}
                            >
                              全部章节
                            </button>
                            {meta.units[cls]?.map((unit) => {
                              const isUnitSelected = filter.units === unit;
                              return (
                                <button
                                  key={unit}
                                  onClick={() => handleSelectUnit(unit)}
                                  className={`w-full text-left px-2 py-1.5 rounded text-xs transition-all truncate ${
                                    isUnitSelected
                                      ? "bg-primary/10 text-primary font-medium"
                                      : "hover:bg-muted"
                                  }`}
                                >
                                  {unit}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 题型 */}
        <div className="border-b">
          <button
            onClick={() => toggleCollapse("types")}
            className="flex items-center justify-between w-full px-4 py-2.5 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">题型</span>
              <span className="text-xs text-muted-foreground">
                {meta.types.length}
              </span>
            </div>
            <ChevronDown
              size={14}
              className={`text-muted-foreground transition-transform ${
                collapsedGroups.has("types") ? "-rotate-90" : ""
              }`}
            />
          </button>

          {!collapsedGroups.has("types") && (
            <div className="px-2 pb-2">
              <div className="space-y-0.5 max-h-40 overflow-y-auto">
                {meta.types.map((type) => {
                  const isSelected = filter.types === type;
                  return (
                    <button
                      key={type}
                      onClick={() => handleSelectType(type)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all ${
                        isSelected
                          ? "bg-primary text-primary-foreground font-medium"
                          : "hover:bg-muted"
                      }`}
                    >
                      {type}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 来源 */}
        <div className="border-b">
          <button
            onClick={() => toggleCollapse("sources")}
            className="flex items-center justify-between w-full px-4 py-2.5 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">来源</span>
              <span className="text-xs text-muted-foreground">
                {meta.sources.length}
              </span>
            </div>
            <ChevronDown
              size={14}
              className={`text-muted-foreground transition-transform ${
                collapsedGroups.has("sources") ? "-rotate-90" : ""
              }`}
            />
          </button>

          {!collapsedGroups.has("sources") && (
            <div className="px-2 pb-2">
              <div className="space-y-0.5 max-h-40 overflow-y-auto">
                {meta.sources.map((source) => {
                  const isSelected = filter.sources === source;
                  return (
                    <button
                      key={source}
                      onClick={() => handleSelectSource(source)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all truncate ${
                        isSelected
                          ? "bg-primary text-primary-foreground font-medium"
                          : "hover:bg-muted"
                      }`}
                    >
                      {source}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer - Clear all */}
      {hasActiveFilters && (
        <div className="px-4 py-3 border-t shrink-0">
          <button
            onClick={handleClearAll}
            className="w-full text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 py-2 rounded-md transition-colors"
          >
            清除所有筛选
          </button>
        </div>
      )}
    </div>
  );
}
