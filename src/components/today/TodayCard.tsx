type TodayCardProps = {
  title: string;
  value: string;
  description?: string;
};

export function TodayCard({ title, value, description }: TodayCardProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium uppercase tracking-wide text-gray-500">
        {title}
      </p>

      <h2 className="mt-3 text-xl font-semibold text-gray-950">{value}</h2>

      {description && (
        <p className="mt-3 text-sm leading-6 text-gray-600">{description}</p>
      )}
    </div>
  );
}