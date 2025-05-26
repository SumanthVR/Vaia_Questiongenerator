
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { toast } from "@/components/ui/sonner";
import { LoaderCircle } from "lucide-react";

interface QuestionGeneratorProps {
  selectedFrameworks: Set<string>;
  onGenerate: (count: number) => void;
  isGenerating: boolean;
}

export default function QuestionGenerator({
  selectedFrameworks,
  onGenerate,
  isGenerating
}: QuestionGeneratorProps) {
  const [questionCount, setQuestionCount] = useState<number>(5);
  
  const handleGenerate = () => {
    if (selectedFrameworks.size < 2) {
      toast.error("Please select at least two frameworks to generate questions.");
      return;
    }
    onGenerate(questionCount);
  };
  
  return (
    <Card className="p-6 animate-fade-in">
      <h2 className="text-2xl font-semibold text-gray-800 mb-4">Generate Questions</h2>
      
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <label htmlFor="questionCount" className="text-sm font-medium text-gray-700">
            Number of Questions:
          </label>
          <span className="text-sm font-medium text-prism-700 bg-prism-50 px-2 py-0.5 rounded-md">
            {questionCount}
          </span>
        </div>
        <div className="px-1">
          <Slider 
            id="questionCount"
            min={1}
            max={50}
            step={1}
            defaultValue={[questionCount]}
            onValueChange={(values) => setQuestionCount(values[0])}
            className="my-4"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>1</span>
            <span>50</span>
          </div>
        </div>
      </div>
      
      <div className="mb-4 text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
        <p>Only questions with very similar context between frameworks will be merged. Non-similar questions will not be included.</p>
      </div>
      
      <Button
        onClick={handleGenerate}
        disabled={isGenerating || selectedFrameworks.size < 2}
        className="w-full prism-gradient"
      >
        {isGenerating ? (
          <>
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            Generating...
          </>
        ) : (
          "Merge Similar Questions"
        )}
      </Button>

      {selectedFrameworks.size < 2 && (
        <div className="mt-3 text-sm text-orange-600">
          Please select at least two frameworks to enable question generation.
              
        </div>
      )}
    </Card>
  );
}
