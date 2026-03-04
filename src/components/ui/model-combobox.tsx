import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";

import { cn } from "@/lib/utils";

export interface ComboboxGroup {
  label: string;
  options: string[];
  badge?: string;
}

interface ModelComboboxProps {
  value: string;
  onChange: (value: string) => void;
  groups: ComboboxGroup[];
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export function ModelCombobox({
  value,
  onChange,
  groups,
  placeholder,
  disabled,
  id,
  className,
}: ModelComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filteredGroups = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!query) return groups;
    return groups
      .map((g) => ({
        ...g,
        options: g.options.filter((o) => o.toLowerCase().includes(query)),
      }))
      .filter((g) => g.options.length > 0);
  }, [groups, search]);

  const flatOptions = useMemo(
    () => filteredGroups.flatMap((g) => g.options),
    [filteredGroups],
  );

  const close = useCallback(() => {
    setOpen(false);
    setHighlightIndex(-1);
  }, []);

  const selectOption = useCallback(
    (option: string) => {
      onChange(option);
      setSearch("");
      close();
    },
    [close, onChange],
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [close]);

  useEffect(() => {
    if (!open) return;
    if (highlightIndex < 0 || highlightIndex >= flatOptions.length) return;
    const el = listRef.current?.querySelector(`[data-idx="${highlightIndex}"]`);
    if (el) {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIndex, open, flatOptions.length]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        e.preventDefault();
        setOpen(true);
        setHighlightIndex(0);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIndex((i) => (i < flatOptions.length - 1 ? i + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIndex((i) => (i > 0 ? i - 1 : flatOptions.length - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightIndex >= 0 && highlightIndex < flatOptions.length) {
          selectOption(flatOptions[highlightIndex]);
        } else if (search.trim()) {
          selectOption(search.trim());
        }
        break;
      case "Escape":
        e.preventDefault();
        close();
        break;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setSearch(v);
    if (!open) setOpen(true);
    setHighlightIndex(-1);
  };

  const handleClear = () => {
    onChange("");
    setSearch("");
    inputRef.current?.focus();
  };

  let runningIdx = 0;

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          autoComplete="off"
          value={open ? search || value : value}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "h-9 w-full rounded-lg border border-input/85 bg-gradient-to-b from-background to-muted/20 px-3 pr-16 text-sm shadow-sm transition-all duration-150",
            "hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:border-primary/50",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
          onFocus={() => {
            if (!disabled) {
              setOpen(true);
              setSearch("");
            }
          }}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
        />
        <span className="pointer-events-none absolute inset-y-1 right-1.5 flex items-center gap-0.5">
          {value && !disabled ? (
            <button
              type="button"
              className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={handleClear}
              tabIndex={-1}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted/40">
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform duration-150",
                open && "rotate-180",
              )}
            />
          </span>
        </span>
      </div>

      {open && !disabled ? (
        <div
          ref={listRef}
          className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-border bg-popover shadow-lg"
        >
          {filteredGroups.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              {search ? "无匹配结果，按 Enter 确认输入" : "无可选模型"}
            </div>
          ) : (
            filteredGroups.map((group) => {
              const startIdx = runningIdx;
              const items = group.options.map((option, localIdx) => {
                const globalIdx = startIdx + localIdx;
                return (
                  <button
                    key={option}
                    type="button"
                    data-idx={globalIdx}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors",
                      globalIdx === highlightIndex
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-muted/60",
                      option === value && "font-medium",
                    )}
                    onMouseEnter={() => setHighlightIndex(globalIdx)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectOption(option);
                    }}
                  >
                    <span className="truncate">{option}</span>
                    {group.badge ? (
                      <span className="ml-auto shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {group.badge}
                      </span>
                    ) : null}
                  </button>
                );
              });
              runningIdx += group.options.length;
              return (
                <div key={group.label}>
                  <div className="sticky top-0 z-10 border-b border-border/50 bg-muted/50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </div>
                  {items}
                </div>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
