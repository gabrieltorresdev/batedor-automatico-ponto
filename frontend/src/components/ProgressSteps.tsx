import { CheckCircle2, Circle, Loader2 } from "lucide-react";

interface Step {
    label: string;
    status: 'waiting' | 'loading' | 'completed' | 'error';
}

interface ProgressStepsProps {
    steps: Step[];
}

export default function ProgressSteps({ steps }: ProgressStepsProps) {
    return (
        <div className="flex flex-col gap-2 w-full">
            {steps.map((step, index) => (
                <div 
                    key={step.label}
                    className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${
                        step.status === 'completed' ? 'bg-green-50' :
                        step.status === 'error' ? 'bg-red-50' :
                        step.status === 'loading' ? 'bg-blue-50' : 'bg-gray-50'
                    }`}
                >
                    {step.status === 'waiting' && (
                        <Circle className="h-5 w-5 text-gray-400" />
                    )}
                    {step.status === 'loading' && (
                        <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                    )}
                    {step.status === 'completed' && (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                    )}
                    {step.status === 'error' && (
                        <Circle className="h-5 w-5 text-red-500" />
                    )}
                    <span className={`text-sm ${
                        step.status === 'completed' ? 'text-green-700' :
                        step.status === 'error' ? 'text-red-700' :
                        step.status === 'loading' ? 'text-blue-700' : 'text-gray-500'
                    }`}>
                        {step.label}
                    </span>
                </div>
            ))}
        </div>
    );
} 