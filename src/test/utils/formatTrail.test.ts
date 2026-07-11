import { describe, it, expect } from 'vitest';
import { buildTrailLineParts } from '../../utils/formatTrail';
 
 describe('buildTrailLineParts', () => {
   it('formats a basic trail', () => {
     const trail = {
       id: 'trail-1',
       name: 'Rainier',
       fullName: 'Mount Rainier',
       distance: 5.5,
       distanceExtended: 6.0,
       elevationStart: 2000,
       elevationMax: 4000,
       difficulty: 'Moderate',
       parking: 'Lot',
       range: 45,
     };
     const result = buildTrailLineParts(trail);
     expect(result.name).toBe('Mount Rainier');
     expect(result.difficulty).toBe('[Moderate]');
     expect(result.distanceText).toBe('5.5-6.0');
     expect(result.elevationText).toBe('2,000\'-4,000\'');
     expect(result.parking).toBe('Lot');
     expect(result.rideCost).toBe('ride-$5');
   });
 
   it('strips ◆ marker from trail name', () => {
     const trail = {
       id: 'trail-2',
       name: 'Wilderness',
       fullName: '◆ Wilderness Peak',
       distance: 8.0,
       elevationStart: 4200,
       elevationMax: 5000,
       difficulty: 'Difficult',
       parking: 'Free',
     };
     const result = buildTrailLineParts(trail);
     expect(result.name).toBe('Wilderness Peak');
   });
 
   it('handles missing optional fields', () => {
     const trail = {
       id: 'trail-3',
       name: 'Simple',
       fullName: 'Simple Trail',
       distance: 3.0,
       elevationStart: 1000,
       difficulty: 'Easy',
       parking: '',
     };
     const result = buildTrailLineParts(trail);
     expect(result.name).toBe('Simple Trail');
     expect(result.difficulty).toBe('[Easy]');
   });
 
   it('handles null distance', () => {
     const trail = {
       id: 'trail-4',
       name: 'No Distance',
       fullName: 'No Distance Trail',
       distance: null,
       elevationStart: 1000,
       difficulty: 'Easy',
     };
     const result = buildTrailLineParts(trail);
     expect(result.distanceText).toBe('N/A');
   });
 
   it('handles missing elevationMax', () => {
     const trail = {
       id: 'trail-5',
       name: 'Flat',
       fullName: 'Flat Trail',
       distance: 2.0,
       elevationStart: 500,
       difficulty: 'Easy',
     };
     const result = buildTrailLineParts(trail);
     expect(result.elevationText).toBe('500\'-500\'');
   });
 
   it('uses name when fullName is missing', () => {
     const trail = {
       id: 'trail-6',
       name: 'No FullName',
       distance: 1.0,
       elevationStart: 100,
       difficulty: 'Easy',
     };
     const result = buildTrailLineParts(trail);
     expect(result.name).toBe('No FullName');
   });
 
   it('handles large elevation numbers with locale', () => {
     const trail = {
       id: 'trail-7',
       name: 'Big',
       fullName: 'Big Mountain',
       distance: 10.0,
       elevationStart: 12345,
       elevationMax: 23456,
       difficulty: 'Difficult',
     };
     const result = buildTrailLineParts(trail);
     expect(result.elevationText).toContain('12,345\'');
     expect(result.elevationText).toContain('23,456\'');
   });
 });
