import { CheckCircle2, LineChart } from "lucide-react";
import { memo } from "react";
import type {
  LandingOpportunityPhase,
  LandingOpportunitySection,
} from "@/modules/site-content/domain/models/landing-content";

export type OpportunityPhaseCopy = LandingOpportunityPhase;

export type OpportunitySectionCopy = LandingOpportunitySection;

export type OpportunitySectionProps = {
  content?: OpportunitySectionCopy;
};

const PhaseCard = memo(function PhaseCard({ phase }: { phase: OpportunityPhaseCopy }) {
  return (
    <article className="flex h-full flex-col rounded-3xl border border-border/80 bg-card/80 p-6 shadow-lg transition-shadow hover:shadow-xl dark:border-emerald-500/20 dark:bg-slate-900/60">
      {phase.visibilityTag ? (
        <span className="mb-3 inline-flex w-fit items-center justify-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
          {phase.visibilityTag}
        </span>
      ) : null}
      <h3 className="text-xl font-semibold text-foreground">{phase.title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{phase.descriptor}</p>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {phase.monthlyInvestment}
      </p>
      <p className="mt-2 text-sm font-medium text-emerald-700 dark:text-emerald-200">{phase.requirement}</p>
      <ul className="mt-4 flex flex-1 flex-col gap-3 text-sm text-muted-foreground">
        {phase.rewards.map((reward, rewardIndex) => (
          <li key={`${phase.id}-reward-${rewardIndex}`} className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" aria-hidden="true" />
            <span>{reward}</span>
          </li>
        ))}
      </ul>
      {phase.accountBalanceHighlight ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200">
          {phase.accountBalanceHighlight}
        </div>
      ) : null}
      <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-200">
        <LineChart className="h-4 w-4" aria-hidden="true" />
        <span>{phase.commissionHighlight}</span>
      </div>
    </article>
  );
});

export function OpportunitySection({ content }: OpportunitySectionProps) {
  if (!content) {
    return null;
  }

  const phases = [...content.phases].sort((a, b) => a.order - b.order);

  // Determine grid columns based on number of phases
  const getGridCols = (count: number) => {
    if (count === 1) return 'grid-cols-1 max-w-md mx-auto';
    if (count === 2) return 'md:grid-cols-2 max-w-3xl mx-auto';
    if (count === 3) return 'md:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto';
    return 'md:grid-cols-2 xl:grid-cols-4'; // 4 or more phases
  };

  return (
    <section id="opportunity" className="mx-auto w-full max-w-6xl space-y-10 px-4">
      <div className={`grid gap-6 ${getGridCols(phases.length)}`}>
        {phases.map((phase) => (
          <PhaseCard key={phase.id} phase={phase} />
        ))}
      </div>

    </section>
  );
}
