'use client';

import { useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useTutorial } from '@/hooks/use-tutorial';

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TutorialModal({ isOpen, onClose }: TutorialModalProps) {
  const {
    currentTutorial,
    currentStep,
    updating,
    nextStep,
    previousStep,
    skipTutorial,
  } = useTutorial();

  // Close modal when tutorial is completed or skipped
  useEffect(() => {
    if (!currentTutorial) {
      onClose();
    }
  }, [currentTutorial, onClose]);

  if (!isOpen || !currentTutorial || !currentStep) {
    return null;
  }

  const progress = ((currentTutorial.current_step + 1) / currentTutorial.total_steps) * 100;
  const isFirstStep = currentTutorial.current_step === 0;
  const isLastStep = currentTutorial.current_step >= currentTutorial.total_steps - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-2xl mx-4">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="space-y-1">
            <CardTitle className="text-lg">{currentTutorial.title}</CardTitle>
            <p className="text-sm text-muted-foreground">
              Step {currentTutorial.current_step + 1} of {currentTutorial.total_steps}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Progress bar */}
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              {Math.round(progress)}% complete
            </p>
          </div>

          {/* Tutorial content */}
          <div className="space-y-4">
            {currentStep.image_url && (
              <div className="flex justify-center">
                <Image
                  src={currentStep.image_url}
                  alt={currentStep.title}
                  width={640}
                  height={192}
                  className="max-w-full h-auto max-h-48 rounded-lg object-contain"
                />
              </div>
            )}

            <div className="space-y-2">
              <h3 className="text-xl font-semibold">{currentStep.title}</h3>
              <p className="text-muted-foreground leading-relaxed">
                {currentStep.description}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-4">
            <Button
              variant="ghost"
              onClick={skipTutorial}
              disabled={updating}
              className="text-muted-foreground hover:text-foreground"
            >
              <SkipForward className="h-4 w-4 mr-2" />
              Skip tutorial
            </Button>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={previousStep}
                disabled={isFirstStep || updating}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>

              <Button
                onClick={nextStep}
                disabled={updating}
              >
                {updating ? (
                  <>
                    <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Updating...
                  </>
                ) : isLastStep ? (
                  'Complete Tutorial'
                ) : (
                  <>
                    Next
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
import Image from 'next/image';
