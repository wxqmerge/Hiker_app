// Single source of truth for the client-visible config payload shared by
// /api/config (index.ts) and /api/schedule/group (schedule.routes.ts).
export function getPublicConfig() {
  return {
    scheduleName: process.env.SCHEDULE_NAME || 'default',
    hikeDays: process.env.HIKE_DAYS || '3,5',
    maxHikesPerDay: parseInt(process.env.MAX_HIKES_PER_DAY || '3', 10) || 3,
    minSpeedMph: parseFloat(process.env.MIN_SPEED_MPH || '1.1'),
    maxSpeedMph: parseFloat(process.env.MAX_SPEED_MPH || '2.2'),
    isBikeTrip: process.env.IS_BIKE_TRIP === 'true',
  };
}
