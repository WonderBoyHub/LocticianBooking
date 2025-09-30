import React from 'react';
import { motion } from 'framer-motion';
import { Check, Circle } from 'lucide-react';

interface Step {
  id: string;
  title: string;
  description: string;
}

interface ProgressIndicatorProps {
  steps: Step[];
  currentStep: number;
  completedSteps: number[];
  onStepClick?: (stepIndex: number) => void;
  className?: string;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  steps,
  currentStep,
  completedSteps,
  onStepClick,
  className = '',
}) => {
  const isStepAccessible = (stepIndex: number) => {
    return stepIndex <= currentStep || completedSteps.includes(stepIndex);
  };

  const getStepStatus = (stepIndex: number) => {
    if (completedSteps.includes(stepIndex)) return 'completed';
    if (stepIndex === currentStep) return 'current';
    if (stepIndex < currentStep) return 'accessible';
    return 'upcoming';
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Mobile Progress Bar */}
      <div className="block md:hidden mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-brand-dark">
            Trin {currentStep + 1} af {steps.length}
          </span>
          <span className="text-sm text-gray-600">
            {steps[currentStep]?.title}
          </span>
        </div>
        <div className="w-full bg-brown-100 rounded-full h-2">
          <motion.div
            className="bg-brand-primary h-2 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          />
        </div>
      </div>

      {/* Desktop Step Indicator */}
      <div className="hidden md:block">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const status = getStepStatus(index);
            const isAccessible = isStepAccessible(index);
            const isClickable = onStepClick && isAccessible;

            return (
              <React.Fragment key={step.id}>
                <div
                  className={`flex flex-col items-center ${
                    isClickable ? 'cursor-pointer' : ''
                  }`}
                  onClick={isClickable ? () => onStepClick(index) : undefined}
                >
                  {/* Step Circle */}
                  <div className="relative mb-3">
                    <motion.div
                      className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                        status === 'completed'
                          ? 'bg-brand-primary border-brand-primary text-white'
                          : status === 'current'
                          ? 'bg-white border-brand-primary text-brand-primary ring-4 ring-brand-primary/20'
                          : status === 'accessible'
                          ? 'bg-white border-brand-secondary text-brand-primary hover:border-brand-primary'
                          : 'bg-gray-100 border-gray-300 text-gray-400'
                      }`}
                      whilehover={isClickable ? { scale: 1.05 } : {}}
                      whiletap={isClickable ? { scale: 0.95 } : {}}
                    >
                      {status === 'completed' ? (
                        <Check className="h-6 w-6" />
                      ) : (
                        <Circle className="h-6 w-6" />
                      )}
                    </motion.div>

                    {/* Step Number */}
                    <div
                      className={`absolute -top-1 -right-1 w-6 h-6 rounded-full text-xs font-semibold flex items-center justify-center ${
                        status === 'completed'
                          ? 'bg-green-500 text-white'
                          : status === 'current'
                          ? 'bg-brand-primary text-white'
                          : 'bg-gray-400 text-white'
                      }`}
                    >
                      {index + 1}
                    </div>
                  </div>

                  {/* Step Info */}
                  <div className="text-center max-w-[120px]">
                    <h3
                      className={`text-sm font-semibold mb-1 ${
                        status === 'current'
                          ? 'text-brand-primary'
                          : status === 'completed' || status === 'accessible'
                          ? 'text-brand-dark'
                          : 'text-gray-500'
                      }`}
                    >
                      {step.title}
                    </h3>
                    <p
                      className={`text-xs ${
                        status === 'current' || status === 'completed' || status === 'accessible'
                          ? 'text-gray-600'
                          : 'text-gray-400'
                      }`}
                    >
                      {step.description}
                    </p>
                  </div>
                </div>

                {/* Connector Line */}
                {index < steps.length - 1 && (
                  <div className="flex-1 mx-4 h-px relative">
                    <div className="absolute inset-0 bg-gray-300" />
                    <motion.div
                      className="absolute inset-0 bg-brand-primary"
                      initial={{ scaleX: 0 }}
                      animate={{
                        scaleX: completedSteps.includes(index) ? 1 : 0,
                      }}
                      transition={{ duration: 0.5, ease: 'easeInOut' }}
                      style={{ transformOrigin: 'left' }}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};