
import { useState } from "react";
import { Framework } from "@/lib/types";
import { Check, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface FrameworkSelectorProps {
  frameworks: Framework[];
  selectedFrameworks: Set<string>;
  isLoading: boolean;
  onSelectFramework: (framework: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
}

export default function FrameworkSelector({
  frameworks,
  selectedFrameworks,
  isLoading,
  onSelectFramework,
  onSelectAll,
  onClearAll,
}: FrameworkSelectorProps) {
  return (
    <Card className="p-6 animate-fade-in">
      <div className="mb-4 flex flex-wrap justify-between items-center">
        <h2 className="text-2xl font-semibold text-gray-800">Framework Selection</h2>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" onClick={onSelectAll}>
            Select All
          </Button>
          <Button variant="outline" size="sm" onClick={onClearAll}>
            Clear All
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array(8).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-64 overflow-y-auto">
          {frameworks.map((framework) => {
            const isSelected = selectedFrameworks.has(framework.name);
            return (
              <button
                key={framework.id}
                className={`flex items-center p-3 border rounded-lg transition-colors hover:bg-gray-50 ${
                  isSelected ? "border-prism-500 bg-prism-50" : "border-gray-200"
                }`}
                onClick={() => onSelectFramework(framework.name)}
              >
                <div className={`w-5 h-5 rounded border flex items-center justify-center mr-2 ${
                  isSelected ? "bg-prism-500 border-prism-500" : "border-gray-300" 
                }`}>
                  {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
                </div>
                <div className="flex-1 text-left truncate">
                  <div className="text-sm font-medium">{framework.name}</div>
                  <div className="text-xs text-gray-500">({framework.questionCount})</div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-6">
        <div className="text-sm font-medium text-gray-700 mb-2">Selected Frameworks:</div>
        {selectedFrameworks.size === 0 ? (
          <div className="text-sm text-gray-500">No frameworks selected</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {Array.from(selectedFrameworks).map((name) => (
              <Badge 
                key={name} 
                variant="secondary"
                className="framework-badge group flex items-center gap-1 pl-3"
              >
                {name}
                <button
                  onClick={() => onSelectFramework(name)}
                  className="ml-1 rounded-full hover:bg-prism-200 p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
