
import { useState } from "react";
import { Question } from "@/lib/types";
import { toast } from "@/components/ui/sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Copy } from "lucide-react";

interface QuestionCardProps {
  question: Question;
}

export default function QuestionCard({ question }: QuestionCardProps) {
  const copyToClipboard = () => {
    navigator.clipboard.writeText(question.text);
    toast.success("Question copied to clipboard!");
  };

  // Process question text to handle emoji at beginning
  const questionText = question.text.replace(/^(\s*[\u{1F300}-\u{1FAD6}])/u, match => 
    `<span class="text-2xl mr-2 inline-block">${match}</span>`
  );

  return (
    <Card className="question-card group p-6 relative animate-slide-up">
      <button 
        onClick={copyToClipboard}
        className="absolute top-4 right-4 text-gray-400 hover:text-prism-600 clipboard-icon"
        aria-label="Copy to clipboard"
      >
        <Copy className="h-5 w-5" />
      </button>
      
      <div className="mb-4">
        <h3 
          className="text-lg font-medium text-gray-900 mb-3"
          dangerouslySetInnerHTML={{ __html: questionText }}
        />
        
        <div className="flex flex-wrap gap-2 mb-3">
          {question.frameworks.map((framework, index) => (
            <Badge key={index} variant="secondary" className="framework-badge">
              {framework}
            </Badge>
          ))}
        </div>
        
        {question.category && (
          <div className="text-xs text-gray-500 mb-2">
            Category: {question.category}
          </div>
        )}
      </div>
      
      <div className="space-y-2 text-sm text-gray-600 border-t pt-3">
        {question.originalQuestions.map((original, index) => (
          <div key={index} className="flex flex-col">
            <div className="font-medium text-xs text-gray-500 mb-1">
              From {original.framework}:
            </div>
            <div className="text-gray-700 bg-gray-50 p-2 rounded-md">
              "{original.text}"
              {original.category && (
                <div className="text-xs text-gray-500 mt-1">
                  Category: {original.category}
                </div>
              )}
              {original.ref && (
                <div className="text-xs text-gray-500 mt-1">
                  Reference: {original.ref}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
