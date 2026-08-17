import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useTranslation } from "next-i18next";
import { HookScript } from "@linkwarden/router/scripts";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

type Props = {
  scripts: HookScript[];
  onSelect: (script: HookScript) => void;
  onCreate: (name: string) => void;
  onDelete: (id: number) => void;
};

export type ScriptStashDropdownHandle = {
  openSaveAs: () => void;
};

const ScriptStashDropdown = forwardRef<ScriptStashDropdownHandle, Props>(
  ({ scripts, onSelect, onCreate, onDelete }, ref) => {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [adding, setAdding] = useState(false);
    const [newName, setNewName] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({
      openSaveAs: () => {
        setOpen(true);
        setAdding(true);
      },
    }));

    useEffect(() => {
      if (adding) inputRef.current?.focus();
    }, [adding]);

    const submitNewName = () => {
      const trimmed = newName.trim();
      if (trimmed) onCreate(trimmed);
      setNewName("");
      setAdding(false);
    };

    return (
      <DropdownMenu
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setAdding(false);
            setNewName("");
          }
        }}
      >
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <i className="bi-collection" />
            {t("saved_scripts")}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-64">
          {scripts.length === 0 && (
            <p className="px-2 py-1.5 text-sm text-neutral">
              {t("no_saved_scripts")}
            </p>
          )}

          {scripts.map((script) => (
            <div
              key={script.id}
              className="group flex items-center justify-between gap-1 rounded-sm hover:bg-neutral-content"
            >
              <button
                type="button"
                className="flex-1 min-w-0 text-left px-2 py-1.5 text-sm truncate"
                onClick={() => {
                  onSelect(script);
                  setOpen(false);
                }}
              >
                {script.name}
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 mr-1 shrink-0 opacity-0 group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(script.id);
                }}
              >
                <i className="bi-trash text-xs" />
              </Button>
            </div>
          ))}

          <DropdownMenuSeparator />

          {adding ? (
            <input
              ref={inputRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitNewName();
                if (e.key === "Escape") {
                  setAdding(false);
                  setNewName("");
                }
              }}
              onBlur={submitNewName}
              placeholder={t("script_name_placeholder")}
              className="w-full px-2 py-1.5 text-sm rounded-sm bg-base-100 border border-neutral-content outline-none"
            />
          ) : (
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setAdding(true);
              }}
            >
              <i className="bi-plus-lg" />
              {t("save_as")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
);

ScriptStashDropdown.displayName = "ScriptStashDropdown";

export default ScriptStashDropdown;
