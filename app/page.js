import { getRoadmapData } from '@/lib/data';
import RoadmapApp from '@/components/RoadmapApp';

// Always hit the database fresh rather than caching the page, since this
// is an internal tool that gets edited directly, not a public marketing page.
export const dynamic = 'force-dynamic';

export default async function Page() {
  const data = await getRoadmapData();

  return (
    <RoadmapApp
      initialTitle={data.title}
      initialThemes={data.themes}
      initialItems={data.items}
    />
  );
}
