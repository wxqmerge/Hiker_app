// Test if duration is being calculated
import { loadData, getTrails } from './server/dist/services/dataService.js';

async function test() {
  await loadData();
  const trails = getTrails();
  const withDuration = trails.filter(t => t.duration);
  console.log(`Trails with duration: ${withDuration.length}`);
  console.log(withDuration.slice(0, 5).map(t => `${t.id}: ${t.duration}`).join('\n'));
}

test().catch(console.error);
