import type {
  UserTutorialProgress,
  UserTutorialProgressCreateInput,
  UserTutorialProgressUpdateInput as _UserTutorialProgressUpdateInput,
  UserTutorialStatus,
} from '../models/user-tutorial-progress';

export interface UserTutorialProgressRepository {
  getUserStatus(userId: string): Promise<UserTutorialStatus[]>;
  getByUserAndTutorial(userId: string, tutorialId: string): Promise<UserTutorialProgress | null>;
  create(input: UserTutorialProgressCreateInput): Promise<UserTutorialProgress>;
  updateProgress(
    userId: string,
    tutorialId: string,
    currentStep: number,
    completed?: boolean,
    skipped?: boolean,
  ): Promise<UserTutorialProgress>;
}