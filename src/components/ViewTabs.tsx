export type View = 'cards' | 'table' | 'timeline';

export const VIEWS: { key: View; label: string }[] = [
  { key: 'cards', label: 'Cards' },
  { key: 'table', label: 'Table' },
  { key: 'timeline', label: 'Timeline' },
];

export function ViewTabs({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <div className="tabs" role="tablist" aria-label="View">
      {VIEWS.map((v) => (
        <button key={v.key} type="button" role="tab" id={'tab-' + v.key} aria-selected={view === v.key} aria-controls="view" onClick={() => onChange(v.key)}>
          {v.label}
        </button>
      ))}
    </div>
  );
}
