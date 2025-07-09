import React from "react";
import ReactMarkdown from "react-markdown";

type DocStepProps = {
  step: number;
  title: string;
  content: string;
};

export default function DocStep({ step, title, content }: DocStepProps) {
  return (
    <div className="mb-6 p-4 border-l-4 border-[#131C3B] bg-gray-50 rounded-md shadow-sm">
      <h3 className="text-[#131C3B] font-semibold mb-1">Step {step}: {title}</h3>
      <div className="text-sm text-gray-700 leading-relaxed">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  );
}
