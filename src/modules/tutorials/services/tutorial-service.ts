import type {
  Tutorial,
  TutorialCreateInput,
  TutorialUpdateInput,
} from '../domain/models/tutorial';
import type {
  UserTutorialProgress,
  UserTutorialProgressCreateInput,
  UserTutorialProgressUpdateInput as _UserTutorialProgressUpdateInput,
  UserTutorialStatus,
} from '../domain/models/user-tutorial-progress';
import type { TutorialModule } from '../factories/tutorial-module';
import { createTutorialModule } from '../factories/tutorial-module';

let moduleRef: TutorialModule | null = null;

const resolveModule = (): TutorialModule => {
  if (moduleRef) {
    return moduleRef;
  }

  moduleRef = createTutorialModule();
  return moduleRef;
};

export const setTutorialModule = (nextModule: TutorialModule | null) => {
  moduleRef = nextModule;
};

// Tutorial CRUD operations
export const getTutorials = async (): Promise<Tutorial[]> => {
  return resolveModule().tutorialRepository.getAll();
};

export const getTutorialById = async (id: string): Promise<Tutorial | null> => {
  return resolveModule().tutorialRepository.getById(id);
};

export const createTutorial = async (input: TutorialCreateInput): Promise<Tutorial> => {
  return resolveModule().tutorialRepository.create(input);
};

export const updateTutorial = async (
  id: string,
  input: TutorialUpdateInput,
): Promise<Tutorial> => {
  return resolveModule().tutorialRepository.update(id, input);
};

export const deleteTutorial = async (id: string): Promise<void> => {
  return resolveModule().tutorialRepository.delete(id);
};

// User tutorial progress operations
export const getUserTutorialStatus = async (userId: string): Promise<UserTutorialStatus[]> => {
  return resolveModule().progressRepository.getUserStatus(userId);
};

export const getUserProgress = async (
  userId: string,
  tutorialId: string,
): Promise<UserTutorialProgress | null> => {
  return resolveModule().progressRepository.getByUserAndTutorial(userId, tutorialId);
};

export const updateUserProgress = async (
  userId: string,
  tutorialId: string,
  currentStep: number,
  completed?: boolean,
  skipped?: boolean,
): Promise<UserTutorialProgress> => {
  return resolveModule().progressRepository.updateProgress(
    userId,
    tutorialId,
    currentStep,
    completed,
    skipped,
  );
};

export const createUserProgress = async (
  input: UserTutorialProgressCreateInput,
): Promise<UserTutorialProgress> => {
  return resolveModule().progressRepository.create(input);
};