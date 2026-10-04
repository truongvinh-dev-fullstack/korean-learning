export function LearningObjectives({ objectives }: { objectives: readonly string[] }) {
  if (!objectives.length) return null;
  return <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
    <h2 className="text-lg font-bold text-white">Mục tiêu bài học</h2><ul className="list-disc space-y-2 pl-5 text-sm text-slate-300">{objectives.map((objective, index) => <li key={index}>{objective}</li>)}</ul>
  </section>;
}
