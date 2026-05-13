import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Toggle } from "@/components/ui/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { Reference } from "./types";

interface MessageSourcesProps {
  sources: Reference[];
  content?: string;
}

export function MessageSources({ sources, content }: MessageSourcesProps) {
  const [showAllSources, setShowAllSources] = useState(false);

  const refIndices = content
    ? [...content.matchAll(/\[ref:(\d+)\]/g)].map((match) =>
        parseInt(match[1]),
      )
    : null;

  const filteredSources = sources.filter(
    (_, idx) => !refIndices || refIndices.includes(idx + 1),
  );

  const displayedSources = showAllSources ? sources : filteredSources;

  if (displayedSources.length === 0) return null;

  return (
    <div className="w-full">
      <div className="flex justify-end mb-2">
        <Toggle
          pressed={showAllSources}
          onPressedChange={setShowAllSources}
          variant="outline"
          size="sm"
        >
          {showAllSources ? "显示过滤来源" : "显示全部来源"}
        </Toggle>
      </div>
      <Accordion type="multiple" className="w-full">
        {displayedSources.map((source) => {
          const originalIndex = sources.indexOf(source);
          return (
            <AccordionItem
              key={originalIndex}
              value={`item-${originalIndex}`}
              className="border-none"
            >
              <AccordionTrigger className="p-3 hover:no-underline">
                <div className="flex flex-wrap justify-between items-start gap-2 w-full">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">来源 {originalIndex + 1}</Badge>
                    <p className="text-muted-foreground text-xs break-words truncate hover:text-clip hover:whitespace-normal">
                      {source.title}
                    </p>
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="secondary">
                          相关度: {(source.score * 100).toFixed(1)}%
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>文档与查询的相关性分数</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </AccordionTrigger>
              <AccordionContent className="p-3 pt-0 text-sm">
                <div className="p-2 bg-muted rounded text-xs whitespace-pre-wrap max-h-60 overflow-y-auto">
                  {source.content}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
