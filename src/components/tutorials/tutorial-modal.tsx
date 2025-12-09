'use client';

import { useEffect as _useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';

interface TutorialStep {
  title: string;
  description: string;
  image_url?: string;
  action_type?: string;
}

interface Tutorial {
  id: string;
  title: string;
  description: string | null;
  content: TutorialStep[];
}

interface UserTutorialStatus {
  tutorial_id: string;
  title: string;
  description: string | null;
  current_step: number;
  total_steps: number;
  completed: boolean;
  skipped: boolean;
  show_tutorial: boolean;
}

interface TutorialModalProps {
  tutorial: Tutorial;
  status: UserTutorialStatus;
  onClose: () => void;
  onComplete: () => void;
  onSkip: () => void;
}

export function TutorialModal({ tutorial, status, onClose, onComplete, onSkip }: TutorialModalProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(status.current_step);
  const [isUpdating, setIsUpdating] = useState(false);

  const progress = ((currentStep + 1) / tutorial.content.length) * 100;
  const isLastStep = currentStep === tutorial.content.length - 1;
  const step = tutorial.content[currentStep];

  const updateProgress = async (newStep: number, completed = false, skipped = false) => {
    setIsUpdating(true);
    try {
      const response = await fetch('/api/tutorials/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tutorialId: tutorial.id,
          currentStep: newStep,
          completed,
          skipped,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update progress');
      }

      setCurrentStep(newStep);

      if (completed) {
        onComplete();
        toast({
          title: 'Tutorial completed!',
          description: 'You can always access tutorials from your profile.',
        });
      } else if (skipped) {
        onSkip();
        toast({
          title: 'Tutorial skipped',
          description: 'You can start tutorials again from your profile.',
        });
      }
    } catch (error) {
      console.error('Failed to update tutorial progress', error);
      toast({
        title: 'Error',
        description: 'Failed to save progress',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleNext = () => {
    if (isLastStep) {
      updateProgress(currentStep, true);
    } else {
      updateProgress(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      updateProgress(currentStep - 1);
    }
  };

  const handleSkip = () => {
    updateProgress(currentStep, false, true);
  };

  const handleClose = () => {
    updateProgress(currentStep); // Save current progress
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex-1">
            <h2 className="text-lg font-semibold">{tutorial.title}</h2>
            <p className="text-sm text-muted-foreground">
              Step {currentStep + 1} of {tutorial.content.length}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleClose} disabled={isUpdating}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="px-4 py-2">
          <Progress value={progress} className="h-2" />
        </div>

        <CardContent className="p-6 space-y-6">
          {step.image_url && (
            <div className="flex justify-center">
              <Image
                src={step.image_url}
                alt={step.title}
                width={640}
                height={192}
                className="max-w-full max-h-48 object-contain rounded-lg"
              />
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-xl font-semibold">{step.title}</h3>
            <p className="text-muted-foreground leading-relaxed">{step.description}</p>
          </div>

          <div className="flex items-center justify-between pt-4">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleSkip}
                disabled={isUpdating}
              >
                Skip Tutorial
              </Button>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStep === 0 || isUpdating}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>

              <Button onClick={handleNext} disabled={isUpdating}>
                {isLastStep ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Complete
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
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
