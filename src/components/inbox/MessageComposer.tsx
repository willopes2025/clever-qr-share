import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent, RefObject } from "react";
import { Send, Loader2, SpellCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface MessageComposerHandle {
  getValue: () => string;
  setValue: (value: string) => void;
  appendValue: (value: string) => void;
  clear: () => void;
  focus: () => void;
}

interface MessageComposerProps {
  textareaRef: RefObject<HTMLTextAreaElement>;
  disabled?: boolean;
  isMobile?: boolean;
  isAutoCorrect?: boolean;
  autoCorrectEnabled?: boolean;
  slashCommandOpen: boolean;
  totalSlashItems: number;
  onTyping: () => void;
  onSend: (message: string) => void;
  onSlashSearchChange: (searchTerm: string | null) => void;
  onSlashNavigate: (direction: 1 | -1) => void;
  onSlashConfirm: () => void;
  onSlashEscape: () => void;
}

export const MessageComposer = forwardRef<MessageComposerHandle, MessageComposerProps>(({
  textareaRef,
  disabled = false,
  isMobile = false,
  isAutoCorrect = false,
  autoCorrectEnabled = false,
  slashCommandOpen,
  totalSlashItems,
  onTyping,
  onSend,
  onSlashSearchChange,
  onSlashNavigate,
  onSlashConfirm,
  onSlashEscape,
}, ref) => {
  const [value, setValue] = useState("");
  const valueRef = useRef("");
  const slashTermRef = useRef<string | null>(null);

  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
  }, [textareaRef]);

  const updateValue = useCallback((nextValue: string) => {
    valueRef.current = nextValue;
    setValue(nextValue);
    requestAnimationFrame(resizeTextarea);
  }, [resizeTextarea]);

  useImperativeHandle(ref, () => ({
    getValue: () => valueRef.current,
    setValue: (nextValue: string) => {
      slashTermRef.current = null;
      onSlashSearchChange(null);
      updateValue(nextValue);
      setTimeout(() => textareaRef.current?.focus(), 0);
    },
    appendValue: (text: string) => {
      updateValue(valueRef.current + text);
      setTimeout(() => textareaRef.current?.focus(), 0);
    },
    clear: () => {
      slashTermRef.current = null;
      onSlashSearchChange(null);
      updateValue("");
    },
    focus: () => textareaRef.current?.focus(),
  }), [onSlashSearchChange, textareaRef, updateValue]);

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = event.target.value;
    valueRef.current = nextValue;
    setValue(nextValue);

    if (nextValue.length > 0) onTyping();

    const cursorPos = event.target.selectionStart || 0;
    const textBeforeCursor = nextValue.substring(0, cursorPos);
    const slashMatch = textBeforeCursor.match(/(?:^|\s)\/(\w*)$/);

    if (slashMatch) {
      const term = slashMatch[1] || "";
      if (slashTermRef.current !== term) {
        slashTermRef.current = term;
        onSlashSearchChange(term);
      }
    } else if (slashTermRef.current !== null) {
      slashTermRef.current = null;
      onSlashSearchChange(null);
    }

    event.target.style.height = "auto";
    event.target.style.height = `${Math.min(event.target.scrollHeight, 150)}px`;
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashCommandOpen) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (totalSlashItems > 0) onSlashNavigate(1);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (totalSlashItems > 0) onSlashNavigate(-1);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        onSlashConfirm();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        slashTermRef.current = null;
        onSlashEscape();
        return;
      }
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSend(valueRef.current);
    }
  };

  const canSend = value.trim().length > 0 && !disabled && !isAutoCorrect;

  return (
    <>
      <div className="relative flex-1 flex items-center bg-background rounded-full px-3 py-1">
        <Textarea
          ref={textareaRef}
          placeholder="Digite uma mensagem"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className="w-full bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 min-h-[36px] max-h-[100px] resize-none py-2 text-sm md:text-[15px] placeholder:text-muted-foreground"
          rows={1}
        />
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={() => onSend(valueRef.current)}
            disabled={!canSend}
            size={isMobile ? "icon" : "default"}
            className="shrink-0 min-w-[40px] md:min-w-[44px] relative"
          >
            {isAutoCorrect ? (
              <Loader2 className="h-4 w-4 md:h-5 md:w-5 animate-spin" />
            ) : (
              <Send className="h-4 w-4 md:h-5 md:w-5" />
            )}
            {autoCorrectEnabled && !isAutoCorrect && (
              <SpellCheck className="h-2.5 w-2.5 absolute -top-0.5 -right-0.5 text-primary" />
            )}
          </Button>
        </TooltipTrigger>
        {autoCorrectEnabled && (
          <TooltipContent>
            <p>Correção automática ativada</p>
          </TooltipContent>
        )}
      </Tooltip>
    </>
  );
});

MessageComposer.displayName = "MessageComposer";