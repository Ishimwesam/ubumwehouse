export const FLOOR_OPTIONS = [
  'BASEMENT 3',
  'BASEMENT 2',
  'BASEMENT 1',
  'GROUND FLOOR',
  '1ST FLOOR',
  '2ND FLOOR',
  '3RD FLOOR',
  'FLOOR A',
  'FLOOR B',
  'FLOOR C',
  'CONT'
];

export const parseBuildingFloors = (availableFloors) => {
  if (Array.isArray(availableFloors) && availableFloors.length > 0) {
    return availableFloors;
  }

  if (typeof availableFloors === 'string') {
    try {
      const parsed = JSON.parse(availableFloors);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch (error) {
      return [];
    }
  }

  return [];
};
