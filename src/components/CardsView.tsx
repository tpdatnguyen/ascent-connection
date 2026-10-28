import type { DerivedGoal } from '../domain/selectors';
import type { Goal } from '../domain/types';
import { GoalCard, GoalCardEdit } from './GoalCard';

export function CardsView({ goals, editing, canProgress, onTick, onOpen, onGoal, onStep }: {
  goals: DerivedGoal[];
  editing: boolean;
  canProgress: boolean;
  onTick: (goalId: string, i: number) => void;
  onOpen: (goalId: string) => void;
  onGoal: (goalId: string, patch: Partial<Goal>) => void;
  onStep: (stepId: string, text: string) => void;
}) {
  return (
    <div className="cards">
      {goals.map((g) => editing
        ? <GoalCardEdit key={g.id} g={g} onGoal={onGoal} onStep={onStep} />
        : <GoalCard key={g.id} g={g} canProgress={canProgress} onTick={onTick} onOpen={onOpen} />)}
    </div>
  );
}
