'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useSupabaseUser } from '@/modules/auth/hooks/use-supabase-user';

interface Tutorial {
  tutorial_id: string;
  title: string;
  description: string;
  current_step: number;
  total_steps: number;
  completed: boolean;
  skipped: boolean;
  show_tutorial: boolean;
}

interface TutorialStep {
  title: string;
  description: string;
  image_url?: string;
  action_type?: string;
}

interface FullTutorial {
  id: string;
  title: string;
  description: string | null;
  content: TutorialStep[];
}

export function useTutorial() {
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [currentTutorial, setCurrentTutorial] = useState<Tutorial | null>(null);
  const [currentStep, setCurrentStep] = useState<TutorialStep | null>(null);
  const [fullTutorial, setFullTutorial] = useState<FullTutorial | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const { toast } = useToast();
  const { isAuthenticated, isLoading: isAuthLoading } = useSupabaseUser();

  const loadTutorialStep = useCallback(async (tutorialId: string, stepIndex: number) => {
    try {
      const response = await fetch(`/api/admin/tutorials/${tutorialId}`);
      if (!response.ok) {
        throw new Error('Failed to load tutorial');
      }
      const data = await response.json();
      const tutorial = data.tutorial;

      if (tutorial) {
        setFullTutorial(tutorial);
        if (tutorial.content && tutorial.content[stepIndex]) {
          setCurrentStep(tutorial.content[stepIndex]);
        }
      }
    } catch (error) {
      console.error('Error loading tutorial step:', error);
    }
  }, []);

  const loadTutorials = useCallback(async () => {
    // Don't load tutorials if user is not authenticated
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/user/tutorials');
      if (!response.ok) {
        throw new Error('Failed to load tutorials');
      }
      const data = await response.json();
      setTutorials(data.tutorials || []);

      // Find the first tutorial that should be shown
      const activeTutorial = data.tutorials?.find((t: Tutorial) => t.show_tutorial);
      if (activeTutorial) {
        setCurrentTutorial(activeTutorial);
        await loadTutorialStep(activeTutorial.tutorial_id, activeTutorial.current_step);
      }
    } catch (error) {
      console.error('Error loading tutorials:', error);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, loadTutorialStep]);

  const updateProgress = useCallback(async (
    tutorialId: string,
    stepIndex: number,
    completed: boolean = false,
    skipped: boolean = false
  ) => {
    setUpdating(true);
    try {
      const response = await fetch('/api/user/tutorials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tutorial_id: tutorialId,
          current_step: stepIndex,
          completed,
          skipped,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update progress');
      }

      // Reload tutorials to get updated status
      await loadTutorials();

      if (completed || skipped) {
        setCurrentTutorial(null);
        setCurrentStep(null);
        toast({
          title: completed ? 'Tutorial completed!' : 'Tutorial skipped',
          description: completed
            ? 'Great job! You\'ve completed the tutorial.'
            : 'You can always access tutorials later from your profile.',
        });
      }
    } catch (error) {
      console.error('Error updating tutorial progress:', error);
      toast({
        title: 'Error',
        description: 'Failed to update tutorial progress. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUpdating(false);
    }
  }, [loadTutorials, toast]);

  const nextStep = useCallback(() => {
    if (!currentTutorial) return;

    const nextStepIndex = currentTutorial.current_step + 1;
    const isLastStep = nextStepIndex >= currentTutorial.total_steps;

    if (isLastStep) {
      updateProgress(currentTutorial.tutorial_id, currentTutorial.current_step, true);
    } else {
      updateProgress(currentTutorial.tutorial_id, nextStepIndex);
      loadTutorialStep(currentTutorial.tutorial_id, nextStepIndex);
    }
  }, [currentTutorial, updateProgress, loadTutorialStep]);

  const previousStep = useCallback(() => {
    if (!currentTutorial || currentTutorial.current_step === 0) return;

    const prevStepIndex = currentTutorial.current_step - 1;
    updateProgress(currentTutorial.tutorial_id, prevStepIndex);
    loadTutorialStep(currentTutorial.tutorial_id, prevStepIndex);
  }, [currentTutorial, updateProgress, loadTutorialStep]);

  const skipTutorial = useCallback(() => {
    if (!currentTutorial) return;
    updateProgress(currentTutorial.tutorial_id, currentTutorial.current_step, false, true);
  }, [currentTutorial, updateProgress]);

  const getActiveTutorial = useCallback(() => {
    return tutorials.find(t => t.show_tutorial) || null;
  }, [tutorials]);

  const fetchTutorial = useCallback(async (tutorialId: string) => {
    await loadTutorialStep(tutorialId, 0); // Assuming starting from step 0
  }, [loadTutorialStep]);

  const markTutorialCompleted = useCallback((tutorialId: string) => {
    updateProgress(tutorialId, 0, true, false); // Mark as completed
  }, [updateProgress]);

  const markTutorialSkipped = useCallback((tutorialId: string) => {
    updateProgress(tutorialId, 0, false, true); // Mark as skipped
  }, [updateProgress]);

  useEffect(() => {
    // Wait for auth to finish loading before attempting to load tutorials
    if (!isAuthLoading) {
      loadTutorials();
    }
  }, [loadTutorials, isAuthLoading]);

  return {
    tutorials,
    currentTutorial,
    currentStep,
    fullTutorial,
    loading,
    updating,
    nextStep,
    previousStep,
    skipTutorial,
    hasActiveTutorial: !!currentTutorial,
    getActiveTutorial,
    fetchTutorial,
    markTutorialCompleted,
    markTutorialSkipped,
  };
}
