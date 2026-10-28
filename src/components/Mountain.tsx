import { Fragment, memo } from 'react';
import { MILESTONES } from '../domain/plan';
import { CLIMB_POINTS, climbNodeReached, climberPosition } from '../domain/selectors';

const LABELS = ['Base Camp', MILESTONES[0].name, MILESTONES[1].name, 'Kickoff'];
const RIDGE = 'M0 290L120 200L190 236L330 120L470 34L540 150L560 170V290Z';
const pathOf = (pts: [number, number][]) => 'M' + pts.map((p) => p.join(' ')).join(' L');

/** The Climb: pure SVG of team progress `pct` (0..100). */
export const Mountain = memo(function Mountain({ pct }: { pct: number }) {
  const { i0, cx, cy } = climberPosition(pct);
  const donePath = pathOf(CLIMB_POINTS.slice(0, i0 + 1).concat([[cx, cy]]));
  return (
    <svg viewBox="0 0 560 300" xmlns="http://www.w3.org/2000/svg" fontFamily="Inter,Segoe UI,sans-serif" role="img" aria-label={`Team progress on the mountain: ${pct} percent`}>
      <defs><clipPath id="clip-m"><rect x="0" y="0" width={cx} height="300" /></clipPath></defs>
      <path d={RIDGE} fill="#EAE6DD" />
      <path d={RIDGE} fill="#154230" opacity=".16" clipPath="url(#clip-m)" />
      <path d="M0 290L120 200L190 236L330 120L470 34L540 150L560 170" fill="none" stroke="#CFC8BA" strokeWidth="1.5" />
      <line x1="0" y1="290" x2="560" y2="290" stroke="#D6D0C4" />
      <path d={pathOf(CLIMB_POINTS)} fill="none" stroke="#BDB6A8" strokeWidth="2" strokeDasharray="3 5" strokeLinecap="round" />
      <path d={donePath} fill="none" stroke="#154230" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {CLIMB_POINTS.map((p, i) => {
        const on = climbNodeReached(i, pct);
        return (
          <Fragment key={i}>
            <circle cx={p[0]} cy={p[1]} r="6" fill={on ? '#154230' : '#FBF9F5'} stroke={on ? '#154230' : '#8E897F'} strokeWidth="2" />
            <text x={p[0] - 12} y={p[1] + 4} textAnchor="end" fontSize="11" fontWeight="600" fill="#101111">{LABELS[i]}</text>
          </Fragment>
        );
      })}
      <path d="M470 48V14" stroke="#101111" strokeWidth="1.5" /><path d="M470 14l18 6l-18 6z" fill="#5D1E21" />
      <circle cx={cx} cy={cy} r="9" fill="#154230" opacity=".18" /><circle cx={cx} cy={cy} r="5" fill="#154230" stroke="#fff" strokeWidth="1.5" />
    </svg>
  );
});
