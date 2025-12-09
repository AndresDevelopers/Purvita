import type { Tutorial, TutorialCreateInput, TutorialUpdateInput } from '../models/tutorial';

export interface TutorialRepository {
  getAll(): Promise<Tutorial[]>;
  getById(id: string): Promise<Tutorial | null>;
  create(input: TutorialCreateInput): Promise<Tutorial>;
  update(id: string, input: TutorialUpdateInput): Promise<Tutorial>;
  delete(id: string): Promise<void>;
}