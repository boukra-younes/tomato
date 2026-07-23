// =========================================================================
// EXERCISE DATABASE ENGINE
// A single-file, dependency-free ES module exercise engine for
// React + Vite + Supabase apps. Generates a large, realistic exercise
// database from reusable templates + variation generators (rather than
// hand-authoring thousands of near-duplicate objects), then builds
// search indexes and exposes calorie/workout helper functions.
// =========================================================================

// -------------------------------------------------------------------------
// SECTION 1: TAXONOMY CONSTANTS
// -------------------------------------------------------------------------

export const CATEGORIES = [
  'Strength', 'Powerlifting', 'Olympic Weightlifting', 'Bodybuilding',
  'CrossFit', 'Calisthenics', 'Strongman', 'Functional Training', 'Cardio',
  'Plyometrics', 'Machines', 'Sports', 'Stretching', 'Mobility', 'Yoga',
  'Pilates', 'Rehabilitation', 'Daily Activities'
];

export const MUSCLES = [
  'Chest', 'Upper Chest', 'Lower Chest', 'Back', 'Lats', 'Upper Back',
  'Mid Back', 'Lower Back', 'Front Delts', 'Side Delts', 'Rear Delts',
  'Rotator Cuff', 'Traps', 'Biceps', 'Brachialis', 'Forearms', 'Grip',
  'Triceps', 'Abs', 'Obliques', 'Core', 'Spinal Erectors', 'Glutes',
  'Hip Flexors', 'Quadriceps', 'Hamstrings', 'Adductors', 'Abductors',
  'Calves', 'Tibialis', 'Neck'
];

export const EQUIPMENT = [
  'Bodyweight', 'Barbell', 'EZ Bar', 'Trap Bar', 'Safety Squat Bar',
  'Swiss Bar', 'Dumbbells', 'Smith Machine', 'Cable Machine', 'Pulley',
  'Resistance Band', 'TRX', 'Gym Rings', 'Medicine Ball', 'Sandbag',
  'Kettlebell', 'Battle Rope', 'Sled', 'Landmine', 'Swiss Ball', 'Bench',
  'Plyo Box', 'Pull-up Bar', 'Dip Bars', 'Machine'
];

export const GYM_MACHINE_BRANDS = [
  'Hammer Strength', 'Life Fitness', 'Technogym', 'Matrix', 'Panatta',
  'Prime', 'Atlantis', 'Cybex', 'Precor', 'Nautilus'
];

export const BODY_REGIONS = [
  'Upper Body', 'Lower Body', 'Core', 'Full Body', 'Push', 'Pull'
];

export const MOVEMENT_PATTERNS = [
  'Horizontal Push', 'Horizontal Pull', 'Vertical Push', 'Vertical Pull',
  'Squat', 'Hinge', 'Lunge', 'Carry', 'Rotation', 'Gait', 'Isometric'
];

export const PLANES_OF_MOTION = ['Sagittal', 'Frontal', 'Transverse'];

export const FORCE_TYPES = ['Push', 'Pull', 'Static'];

export const MECHANICS = ['Compound', 'Isolation'];

export const DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced'];

export const EXERCISE_TYPES = [
  'Strength', 'Cardio', 'Stretching', 'Plyometric', 'Sport', 'Balance'
];

// -------------------------------------------------------------------------
// SECTION 2: VARIATION MODIFIER SETS
// Used by the generator to multiply a base "family" into many concrete
// exercises without hand-authoring each one.
// -------------------------------------------------------------------------

const GRIP_VARIATIONS = ['Standard Grip', 'Close Grip', 'Wide Grip', 'Reverse Grip', 'Neutral Grip', 'Mixed Grip'];
const STANCE_VARIATIONS = ['Standard Stance', 'Wide Stance', 'Narrow Stance', 'Staggered Stance', 'Single Leg'];
const ANGLE_VARIATIONS = ['Flat', 'Incline', 'Decline'];
const TEMPO_VARIATIONS = ['Standard', 'Paused', 'Tempo', 'Pulse', 'Explosive', '1.5 Rep'];
const UNILATERAL_VARIATIONS = ['Bilateral', 'Single Arm', 'Single Leg', 'Alternating'];
const ROM_VARIATIONS = ['Full Range', 'Partial Reps', 'Deficit', 'Elevated'];
const RESISTANCE_ACCESSORY = ['', 'Banded', 'Chain-Loaded', 'Reverse Band'];

// Which modifier sets apply to which movement families (keeps combos realistic)
const MOD_PROFILES = {
  press: [ANGLE_VARIATIONS, GRIP_VARIATIONS, TEMPO_VARIATIONS, UNILATERAL_VARIATIONS],
  pull: [GRIP_VARIATIONS, UNILATERAL_VARIATIONS, TEMPO_VARIATIONS],
  squat: [STANCE_VARIATIONS, TEMPO_VARIATIONS, ROM_VARIATIONS],
  hinge: [STANCE_VARIATIONS, TEMPO_VARIATIONS, UNILATERAL_VARIATIONS],
  curl: [GRIP_VARIATIONS, UNILATERAL_VARIATIONS, TEMPO_VARIATIONS],
  extension: [GRIP_VARIATIONS, UNILATERAL_VARIATIONS, TEMPO_VARIATIONS],
  raise: [UNILATERAL_VARIATIONS, TEMPO_VARIATIONS, ANGLE_VARIATIONS],
  core: [UNILATERAL_VARIATIONS, TEMPO_VARIATIONS, ROM_VARIATIONS],
  carry: [UNILATERAL_VARIATIONS],
  lunge: [STANCE_VARIATIONS, TEMPO_VARIATIONS, UNILATERAL_VARIATIONS],
};

// -------------------------------------------------------------------------
// SECTION 3: BASE EXERCISE FAMILY TEMPLATES
// Each family describes one movement pattern across multiple equipment
// options. The generator expands family x equipment x modifiers into
// concrete exercise records.
// -------------------------------------------------------------------------

const FAMILIES = [
  // ---- CHEST / PRESS FAMILY ----
  {
    key: 'bench-press', name: 'Bench Press', movementType: 'press',
    category: 'Strength', bodyRegion: 'Upper Body', movementPattern: 'Horizontal Push',
    plane: 'Sagittal', force: 'Push', mechanics: 'Compound',
    primaryMuscles: ['Chest'], secondaryMuscles: ['Triceps', 'Front Delts'], stabilizerMuscles: ['Core', 'Rotator Cuff'],
    equipmentOptions: ['Barbell', 'Dumbbells', 'Smith Machine', 'Machine', 'Cable Machine', 'Gym Rings', 'Resistance Band'],
    difficulty: 'Intermediate', met: 6.0, requiresSpotterEquip: ['Barbell'],
  },
  {
    key: 'push-up', name: 'Push-Up', movementType: 'press',
    category: 'Calisthenics', bodyRegion: 'Upper Body', movementPattern: 'Horizontal Push',
    plane: 'Sagittal', force: 'Push', mechanics: 'Compound',
    primaryMuscles: ['Chest'], secondaryMuscles: ['Triceps', 'Front Delts'], stabilizerMuscles: ['Core'],
    equipmentOptions: ['Bodyweight', 'Gym Rings', 'TRX', 'Swiss Ball', 'Resistance Band'],
    difficulty: 'Beginner', met: 4.0,
  },
  {
    key: 'chest-fly', name: 'Chest Fly', movementType: 'raise',
    category: 'Bodybuilding', bodyRegion: 'Upper Body', movementPattern: 'Horizontal Push',
    plane: 'Sagittal', force: 'Push', mechanics: 'Isolation',
    primaryMuscles: ['Chest'], secondaryMuscles: ['Front Delts'], stabilizerMuscles: ['Core'],
    equipmentOptions: ['Dumbbells', 'Cable Machine', 'Machine', 'Gym Rings', 'Resistance Band'],
    difficulty: 'Beginner', met: 3.8,
  },
  {
    key: 'dip', name: 'Dip', movementType: 'press',
    category: 'Calisthenics', bodyRegion: 'Upper Body', movementPattern: 'Vertical Push',
    plane: 'Sagittal', force: 'Push', mechanics: 'Compound',
    primaryMuscles: ['Chest', 'Triceps'], secondaryMuscles: ['Front Delts'], stabilizerMuscles: ['Core'],
    equipmentOptions: ['Dip Bars', 'Bodyweight', 'Machine', 'Gym Rings'],
    difficulty: 'Intermediate', met: 5.5,
  },

  // ---- SHOULDER / OVERHEAD PRESS FAMILY ----
  {
    key: 'overhead-press', name: 'Overhead Press', movementType: 'press',
    category: 'Strength', bodyRegion: 'Upper Body', movementPattern: 'Vertical Push',
    plane: 'Sagittal', force: 'Push', mechanics: 'Compound',
    primaryMuscles: ['Front Delts'], secondaryMuscles: ['Triceps', 'Side Delts', 'Traps'], stabilizerMuscles: ['Core'],
    equipmentOptions: ['Barbell', 'Dumbbells', 'Smith Machine', 'Machine', 'Kettlebell', 'Landmine', 'Cable Machine'],
    difficulty: 'Intermediate', met: 5.5,
  },
  {
    key: 'lateral-raise', name: 'Lateral Raise', movementType: 'raise',
    category: 'Bodybuilding', bodyRegion: 'Upper Body', movementPattern: 'Vertical Push',
    plane: 'Frontal', force: 'Push', mechanics: 'Isolation',
    primaryMuscles: ['Side Delts'], secondaryMuscles: ['Traps'], stabilizerMuscles: ['Core'],
    equipmentOptions: ['Dumbbells', 'Cable Machine', 'Machine', 'Resistance Band'],
    difficulty: 'Beginner', met: 3.5,
  },
  {
    key: 'rear-delt-fly', name: 'Rear Delt Fly', movementType: 'raise',
    category: 'Bodybuilding', bodyRegion: 'Upper Body', movementPattern: 'Horizontal Pull',
    plane: 'Sagittal', force: 'Pull', mechanics: 'Isolation',
    primaryMuscles: ['Rear Delts'], secondaryMuscles: ['Upper Back', 'Traps'], stabilizerMuscles: ['Core'],
    equipmentOptions: ['Dumbbells', 'Cable Machine', 'Machine', 'Resistance Band'],
    difficulty: 'Beginner', met: 3.5,
  },
  {
    key: 'front-raise', name: 'Front Raise', movementType: 'raise',
    category: 'Bodybuilding', bodyRegion: 'Upper Body', movementPattern: 'Vertical Push',
    plane: 'Sagittal', force: 'Push', mechanics: 'Isolation',
    primaryMuscles: ['Front Delts'], secondaryMuscles: ['Chest'], stabilizerMuscles: ['Core'],
    equipmentOptions: ['Dumbbells', 'Cable Machine', 'Barbell', 'Resistance Band', 'Plyo Box'],
    difficulty: 'Beginner', met: 3.5,
  },

  // ---- BACK / PULL FAMILY ----
  {
    key: 'pull-up', name: 'Pull-Up', movementType: 'pull',
    category: 'Calisthenics', bodyRegion: 'Upper Body', movementPattern: 'Vertical Pull',
    plane: 'Sagittal', force: 'Pull', mechanics: 'Compound',
    primaryMuscles: ['Lats'], secondaryMuscles: ['Biceps', 'Upper Back'], stabilizerMuscles: ['Core', 'Forearms'],
    equipmentOptions: ['Pull-up Bar', 'Bodyweight', 'Gym Rings', 'Machine', 'Resistance Band'],
    difficulty: 'Intermediate', met: 6.0,
  },
  {
    key: 'lat-pulldown', name: 'Lat Pulldown', movementType: 'pull',
    category: 'Bodybuilding', bodyRegion: 'Upper Body', movementPattern: 'Vertical Pull',
    plane: 'Sagittal', force: 'Pull', mechanics: 'Compound',
    primaryMuscles: ['Lats'], secondaryMuscles: ['Biceps', 'Upper Back'], stabilizerMuscles: ['Core'],
    equipmentOptions: ['Cable Machine', 'Machine', 'Resistance Band'],
    difficulty: 'Beginner', met: 4.5,
  },
  {
    key: 'bent-over-row', name: 'Bent-Over Row', movementType: 'pull',
    category: 'Strength', bodyRegion: 'Upper Body', movementPattern: 'Horizontal Pull',
    plane: 'Sagittal', force: 'Pull', mechanics: 'Compound',
    primaryMuscles: ['Mid Back', 'Lats'], secondaryMuscles: ['Biceps', 'Rear Delts'], stabilizerMuscles: ['Spinal Erectors', 'Core'],
    equipmentOptions: ['Barbell', 'Dumbbells', 'Cable Machine', 'Smith Machine', 'Landmine', 'Machine', 'Trap Bar'],
    difficulty: 'Intermediate', met: 5.5,
  },
  {
    key: 'seated-cable-row', name: 'Seated Row', movementType: 'pull',
    category: 'Bodybuilding', bodyRegion: 'Upper Body', movementPattern: 'Horizontal Pull',
    plane: 'Sagittal', force: 'Pull', mechanics: 'Compound',
    primaryMuscles: ['Mid Back'], secondaryMuscles: ['Lats', 'Biceps', 'Rear Delts'], stabilizerMuscles: ['Core'],
    equipmentOptions: ['Cable Machine', 'Machine', 'Resistance Band'],
    difficulty: 'Beginner', met: 4.5,
  },
  {
    key: 'shrug', name: 'Shrug', movementType: 'raise',
    category: 'Bodybuilding', bodyRegion: 'Upper Body', movementPattern: 'Isometric',
    plane: 'Frontal', force: 'Pull', mechanics: 'Isolation',
    primaryMuscles: ['Traps'], secondaryMuscles: ['Forearms'], stabilizerMuscles: ['Core'],
    equipmentOptions: ['Barbell', 'Dumbbells', 'Trap Bar', 'Smith Machine', 'Cable Machine', 'Machine'],
    difficulty: 'Beginner', met: 3.5,
  },
  {
    key: 'deadlift', name: 'Deadlift', movementType: 'hinge',
    category: 'Powerlifting', bodyRegion: 'Full Body', movementPattern: 'Hinge',
    plane: 'Sagittal', force: 'Pull', mechanics: 'Compound',
    primaryMuscles: ['Glutes', 'Hamstrings', 'Spinal Erectors'], secondaryMuscles: ['Lats', 'Traps', 'Forearms'], stabilizerMuscles: ['Core', 'Grip'],
    equipmentOptions: ['Barbell', 'Trap Bar', 'Dumbbells', 'Kettlebell', 'Safety Squat Bar', 'Smith Machine'],
    difficulty: 'Advanced', met: 6.0, requiresSpotterEquip: [],
  },

  // ---- LEG FAMILY ----
  {
    key: 'squat', name: 'Squat', movementType: 'squat',
    category: 'Powerlifting', bodyRegion: 'Lower Body', movementPattern: 'Squat',
    plane: 'Sagittal', force: 'Push', mechanics: 'Compound',
    primaryMuscles: ['Quadriceps', 'Glutes'], secondaryMuscles: ['Hamstrings', 'Core'], stabilizerMuscles: ['Spinal Erectors', 'Core'],
    equipmentOptions: ['Barbell', 'Dumbbells', 'Smith Machine', 'Safety Squat Bar', 'Kettlebell', 'Bodyweight', 'Machine', 'Swiss Ball'],
    difficulty: 'Intermediate', met: 6.5, requiresSpotterEquip: ['Barbell'],
  },
  {
    key: 'leg-press', name: 'Leg Press', movementType: 'squat',
    category: 'Machines', bodyRegion: 'Lower Body', movementPattern: 'Squat',
    plane: 'Sagittal', force: 'Push', mechanics: 'Compound',
    primaryMuscles: ['Quadriceps', 'Glutes'], secondaryMuscles: ['Hamstrings'], stabilizerMuscles: ['Core'],
    equipmentOptions: ['Machine'],
    difficulty: 'Beginner', met: 5.0,
  },
  {
    key: 'lunge', name: 'Lunge', movementType: 'lunge',
    category: 'Functional Training', bodyRegion: 'Lower Body', movementPattern: 'Lunge',
    plane: 'Sagittal', force: 'Push', mechanics: 'Compound',
    primaryMuscles: ['Quadriceps', 'Glutes'], secondaryMuscles: ['Hamstrings', 'Adductors'], stabilizerMuscles: ['Core', 'Abductors'],
    equipmentOptions: ['Bodyweight', 'Dumbbells', 'Barbell', 'Kettlebell', 'Smith Machine', 'Landmine'],
    difficulty: 'Intermediate', met: 5.5,
  },
  {
    key: 'romanian-deadlift', name: 'Romanian Deadlift', movementType: 'hinge',
    category: 'Bodybuilding', bodyRegion: 'Lower Body', movementPattern: 'Hinge',
    plane: 'Sagittal', force: 'Pull', mechanics: 'Compound',
    primaryMuscles: ['Hamstrings', 'Glutes'], secondaryMuscles: ['Spinal Erectors'], stabilizerMuscles: ['Core', 'Grip'],
    equipmentOptions: ['Barbell', 'Dumbbells', 'Kettlebell', 'Trap Bar', 'Smith Machine'],
    difficulty: 'Intermediate', met: 5.5,
  },
  {
    key: 'leg-curl', name: 'Leg Curl', movementType: 'curl',
    category: 'Bodybuilding', bodyRegion: 'Lower Body', movementPattern: 'Hinge',
    plane: 'Sagittal', force: 'Pull', mechanics: 'Isolation',
    primaryMuscles: ['Hamstrings'], secondaryMuscles: ['Glutes', 'Calves'], stabilizerMuscles: ['Core'],
    equipmentOptions: ['Machine', 'Cable Machine', 'Resistance Band', 'Swiss Ball'],
    difficulty: 'Beginner', met: 4.0,
  },
  {
    key: 'leg-extension', name: 'Leg Extension', movementType: 'extension',
    category: 'Bodybuilding', bodyRegion: 'Lower Body', movementPattern: 'Squat',
    plane: 'Sagittal', force: 'Push', mechanics: 'Isolation',
    primaryMuscles: ['Quadriceps'], secondaryMuscles: [], stabilizerMuscles: ['Core'],
    equipmentOptions: ['Machine', 'Cable Machine', 'Resistance Band'],
    difficulty: 'Beginner', met: 3.8,
  },
  {
    key: 'hip-thrust', name: 'Hip Thrust', movementType: 'hinge',
    category: 'Bodybuilding', bodyRegion: 'Lower Body', movementPattern: 'Hinge',
    plane: 'Sagittal', force: 'Push', mechanics: 'Compound',
    primaryMuscles: ['Glutes'], secondaryMuscles: ['Hamstrings'], stabilizerMuscles: ['Core'],
    equipmentOptions: ['Barbell', 'Bodyweight', 'Dumbbells', 'Machine', 'Resistance Band', 'Smith Machine'],
    difficulty: 'Beginner', met: 4.5,
  },
  {
    key: 'calf-raise', name: 'Calf Raise', movementType: 'raise',
    category: 'Bodybuilding', bodyRegion: 'Lower Body', movementPattern: 'Isometric',
    plane: 'Sagittal', force: 'Push', mechanics: 'Isolation',
    primaryMuscles: ['Calves'], secondaryMuscles: ['Tibialis'], stabilizerMuscles: ['Core'],
    equipmentOptions: ['Bodyweight', 'Dumbbells', 'Barbell', 'Machine', 'Smith Machine'],
    difficulty: 'Beginner', met: 3.5,
  },
  {
    key: 'adductor', name: 'Hip Adduction', movementType: 'raise',
    category: 'Machines', bodyRegion: 'Lower Body', movementPattern: 'Rotation',
    plane: 'Frontal', force: 'Push', mechanics: 'Isolation',
    primaryMuscles: ['Adductors'], secondaryMuscles: [], stabilizerMuscles: ['Core'],
    equipmentOptions: ['Machine', 'Cable Machine', 'Resistance Band'],
    difficulty: 'Beginner', met: 3.5,
  },
  {
    key: 'abductor', name: 'Hip Abduction', movementType: 'raise',
    category: 'Machines', bodyRegion: 'Lower Body', movementPattern: 'Rotation',
    plane: 'Frontal', force: 'Push', mechanics: 'Isolation',
    primaryMuscles: ['Abductors', 'Glutes'], secondaryMuscles: [], stabilizerMuscles: ['Core'],
    equipmentOptions: ['Machine', 'Cable Machine', 'Resistance Band'],
    difficulty: 'Beginner', met: 3.5,
  },

  // ---- ARMS FAMILY ----
  {
    key: 'bicep-curl', name: 'Bicep Curl', movementType: 'curl',
    category: 'Bodybuilding', bodyRegion: 'Upper Body', movementPattern: 'Isometric',
    plane: 'Sagittal', force: 'Pull', mechanics: 'Isolation',
    primaryMuscles: ['Biceps'], secondaryMuscles: ['Brachialis', 'Forearms'], stabilizerMuscles: ['Core'],
    equipmentOptions: ['Barbell', 'EZ Bar', 'Dumbbells', 'Cable Machine', 'Machine', 'Resistance Band'],
    difficulty: 'Beginner', met: 3.5,
  },
  {
    key: 'hammer-curl', name: 'Hammer Curl', movementType: 'curl',
    category: 'Bodybuilding', bodyRegion: 'Upper Body', movementPattern: 'Isometric',
    plane: 'Sagittal', force: 'Pull', mechanics: 'Isolation',
    primaryMuscles: ['Brachialis', 'Biceps'], secondaryMuscles: ['Forearms'], stabilizerMuscles: ['Core'],
    equipmentOptions: ['Dumbbells', 'Cable Machine', 'Resistance Band'],
    difficulty: 'Beginner', met: 3.5,
  },
  {
    key: 'tricep-extension', name: 'Tricep Extension', movementType: 'extension',
    category: 'Bodybuilding', bodyRegion: 'Upper Body', movementPattern: 'Vertical Push',
    plane: 'Sagittal', force: 'Push', mechanics: 'Isolation',
    primaryMuscles: ['Triceps'], secondaryMuscles: [], stabilizerMuscles: ['Core'],
    equipmentOptions: ['Dumbbells', 'Cable Machine', 'EZ Bar', 'Machine', 'Resistance Band', 'Barbell'],
    difficulty: 'Beginner', met: 3.5,
  },
  {
    key: 'tricep-pushdown', name: 'Tricep Pushdown', movementType: 'extension',
    category: 'Bodybuilding', bodyRegion: 'Upper Body', movementPattern: 'Vertical Push',
    plane: 'Sagittal', force: 'Push', mechanics: 'Isolation',
    primaryMuscles: ['Triceps'], secondaryMuscles: [], stabilizerMuscles: ['Core'],
    equipmentOptions: ['Cable Machine', 'Resistance Band', 'Machine'],
    difficulty: 'Beginner', met: 3.5,
  },
  {
    key: 'wrist-curl', name: 'Wrist Curl', movementType: 'curl',
    category: 'Bodybuilding', bodyRegion: 'Upper Body', movementPattern: 'Isometric',
    plane: 'Sagittal', force: 'Pull', mechanics: 'Isolation',
    primaryMuscles: ['Forearms', 'Grip'], secondaryMuscles: [], stabilizerMuscles: [],
    equipmentOptions: ['Barbell', 'Dumbbells', 'Cable Machine', 'Resistance Band'],
    difficulty: 'Beginner', met: 3.0,
  },

  // ---- CORE FAMILY ----
  {
    key: 'crunch', name: 'Crunch', movementType: 'core',
    category: 'Calisthenics', bodyRegion: 'Core', movementPattern: 'Isometric',
    plane: 'Sagittal', force: 'Static', mechanics: 'Isolation',
    primaryMuscles: ['Abs'], secondaryMuscles: ['Obliques'], stabilizerMuscles: ['Core'],
    equipmentOptions: ['Bodyweight', 'Cable Machine', 'Machine', 'Swiss Ball', 'Medicine Ball'],
    difficulty: 'Beginner', met: 3.8,
  },
  {
    key: 'plank', name: 'Plank', movementType: 'core',
    category: 'Calisthenics', bodyRegion: 'Core', movementPattern: 'Isometric',
    plane: 'Sagittal', force: 'Static', mechanics: 'Isolation',
    primaryMuscles: ['Abs', 'Core'], secondaryMuscles: ['Obliques', 'Spinal Erectors'], stabilizerMuscles: ['Front Delts'],
    equipmentOptions: ['Bodyweight', 'Swiss Ball', 'TRX', 'Gym Rings'],
    difficulty: 'Beginner', met: 3.5,
  },
  {
    key: 'leg-raise', name: 'Leg Raise', movementType: 'core',
    category: 'Calisthenics', bodyRegion: 'Core', movementPattern: 'Isometric',
    plane: 'Sagittal', force: 'Static', mechanics: 'Isolation',
    primaryMuscles: ['Abs', 'Hip Flexors'], secondaryMuscles: ['Obliques'], stabilizerMuscles: ['Grip'],
    equipmentOptions: ['Bodyweight', 'Pull-up Bar', 'Dip Bars', 'Cable Machine', 'Machine'],
    difficulty: 'Intermediate', met: 4.0,
  },
  {
    key: 'russian-twist', name: 'Russian Twist', movementType: 'core',
    category: 'Functional Training', bodyRegion: 'Core', movementPattern: 'Rotation',
    plane: 'Transverse', force: 'Static', mechanics: 'Isolation',
    primaryMuscles: ['Obliques'], secondaryMuscles: ['Abs'], stabilizerMuscles: ['Core'],
    equipmentOptions: ['Bodyweight', 'Medicine Ball', 'Dumbbells', 'Cable Machine', 'Kettlebell'],
    difficulty: 'Beginner', met: 4.0,
  },
  {
    key: 'wood-chop', name: 'Wood Chop', movementType: 'core',
    category: 'Functional Training', bodyRegion: 'Core', movementPattern: 'Rotation',
    plane: 'Transverse', force: 'Static', mechanics: 'Isolation',
    primaryMuscles: ['Obliques'], secondaryMuscles: ['Abs', 'Glutes'], stabilizerMuscles: ['Core'],
    equipmentOptions: ['Cable Machine', 'Medicine Ball', 'Resistance Band', 'Dumbbells'],
    difficulty: 'Intermediate', met: 4.2,
  },
  {
    key: 'back-extension', name: 'Back Extension', movementType: 'hinge',
    category: 'Rehabilitation', bodyRegion: 'Core', movementPattern: 'Hinge',
    plane: 'Sagittal', force: 'Pull', mechanics: 'Isolation',
    primaryMuscles: ['Spinal Erectors'], secondaryMuscles: ['Glutes', 'Hamstrings'], stabilizerMuscles: ['Core'],
    equipmentOptions: ['Bodyweight', 'Machine', 'Swiss Ball'],
    difficulty: 'Beginner', met: 4.0,
  },

  // ---- FULL BODY / FUNCTIONAL / CARRY FAMILY ----
  {
    key: 'farmers-carry', name: "Farmer's Carry", movementType: 'carry',
    category: 'Strongman', bodyRegion: 'Full Body', movementPattern: 'Carry',
    plane: 'Sagittal', force: 'Static', mechanics: 'Compound',
    primaryMuscles: ['Grip', 'Forearms', 'Traps'], secondaryMuscles: ['Core', 'Glutes'], stabilizerMuscles: ['Spinal Erectors'],
    equipmentOptions: ['Dumbbells', 'Kettlebell', 'Trap Bar', 'Sandbag'],
    difficulty: 'Intermediate', met: 5.0,
  },
  {
    key: 'kettlebell-swing', name: 'Kettlebell Swing', movementType: 'hinge',
    category: 'Functional Training', bodyRegion: 'Full Body', movementPattern: 'Hinge',
    plane: 'Sagittal', force: 'Pull', mechanics: 'Compound',
    primaryMuscles: ['Glutes', 'Hamstrings'], secondaryMuscles: ['Core', 'Front Delts'], stabilizerMuscles: ['Spinal Erectors', 'Grip'],
    equipmentOptions: ['Kettlebell'],
    difficulty: 'Intermediate', met: 8.0,
  },
  {
    key: 'clean', name: 'Clean', movementType: 'hinge',
    category: 'Olympic Weightlifting', bodyRegion: 'Full Body', movementPattern: 'Hinge',
    plane: 'Sagittal', force: 'Pull', mechanics: 'Compound',
    primaryMuscles: ['Glutes', 'Hamstrings', 'Traps'], secondaryMuscles: ['Quadriceps', 'Front Delts'], stabilizerMuscles: ['Core', 'Grip'],
    equipmentOptions: ['Barbell', 'Dumbbells', 'Kettlebell'],
    difficulty: 'Advanced', met: 8.0,
  },
  {
    key: 'snatch', name: 'Snatch', movementType: 'hinge',
    category: 'Olympic Weightlifting', bodyRegion: 'Full Body', movementPattern: 'Hinge',
    plane: 'Sagittal', force: 'Pull', mechanics: 'Compound',
    primaryMuscles: ['Glutes', 'Hamstrings', 'Traps'], secondaryMuscles: ['Side Delts', 'Quadriceps'], stabilizerMuscles: ['Core', 'Grip'],
    equipmentOptions: ['Barbell', 'Dumbbells', 'Kettlebell'],
    difficulty: 'Advanced', met: 8.5,
  },
  {
    key: 'thruster', name: 'Thruster', movementType: 'squat',
    category: 'CrossFit', bodyRegion: 'Full Body', movementPattern: 'Squat',
    plane: 'Sagittal', force: 'Push', mechanics: 'Compound',
    primaryMuscles: ['Quadriceps', 'Front Delts'], secondaryMuscles: ['Glutes', 'Triceps'], stabilizerMuscles: ['Core'],
    equipmentOptions: ['Barbell', 'Dumbbells', 'Kettlebell'],
    difficulty: 'Advanced', met: 9.0,
  },
  {
    key: 'wall-ball', name: 'Wall Ball', movementType: 'squat',
    category: 'CrossFit', bodyRegion: 'Full Body', movementPattern: 'Squat',
    plane: 'Sagittal', force: 'Push', mechanics: 'Compound',
    primaryMuscles: ['Quadriceps', 'Front Delts'], secondaryMuscles: ['Glutes', 'Core'], stabilizerMuscles: ['Core'],
    equipmentOptions: ['Medicine Ball'],
    difficulty: 'Intermediate', met: 8.0,
  },
  {
    key: 'burpee', name: 'Burpee', movementType: 'core',
    category: 'CrossFit', bodyRegion: 'Full Body', movementPattern: 'Squat',
    plane: 'Sagittal', force: 'Push', mechanics: 'Compound',
    primaryMuscles: ['Chest', 'Quadriceps'], secondaryMuscles: ['Core', 'Front Delts'], stabilizerMuscles: ['Core'],
    equipmentOptions: ['Bodyweight', 'Plyo Box'],
    difficulty: 'Intermediate', met: 8.0,
  },
  {
    key: 'box-jump', name: 'Box Jump', movementType: 'lunge',
    category: 'Plyometrics', bodyRegion: 'Lower Body', movementPattern: 'Squat',
    plane: 'Sagittal', force: 'Push', mechanics: 'Compound',
    primaryMuscles: ['Quadriceps', 'Glutes'], secondaryMuscles: ['Calves', 'Hamstrings'], stabilizerMuscles: ['Core'],
    equipmentOptions: ['Plyo Box', 'Bodyweight'],
    difficulty: 'Intermediate', met: 7.0,
  },
  {
    key: 'battle-rope-wave', name: 'Battle Rope Wave', movementType: 'core',
    category: 'Functional Training', bodyRegion: 'Full Body', movementPattern: 'Isometric',
    plane: 'Sagittal', force: 'Push', mechanics: 'Compound',
    primaryMuscles: ['Front Delts', 'Core'], secondaryMuscles: ['Forearms', 'Traps'], stabilizerMuscles: ['Core'],
    equipmentOptions: ['Battle Rope'],
    difficulty: 'Intermediate', met: 8.0,
  },
  {
    key: 'sled-push', name: 'Sled Push', movementType: 'lunge',
    category: 'Strongman', bodyRegion: 'Full Body', movementPattern: 'Gait',
    plane: 'Sagittal', force: 'Push', mechanics: 'Compound',
    primaryMuscles: ['Quadriceps', 'Glutes'], secondaryMuscles: ['Calves', 'Core'], stabilizerMuscles: ['Core'],
    equipmentOptions: ['Sled'],
    difficulty: 'Intermediate', met: 8.5,
  },
];

// -------------------------------------------------------------------------
// SECTION 4: STANDALONE CATALOGS (cardio, sports, stretching/mobility/yoga,
// daily activities). These don't use the family/variation generator since
// they're not "grip/tempo/angle" style strength variations.
// -------------------------------------------------------------------------

const CARDIO_ACTIVITIES = [
  ['Walking', 3.5], ['Brisk Walking', 4.5], ['Running', 9.8], ['Jogging', 7.0],
  ['Sprinting', 14.0], ['Cycling (Moderate)', 7.5], ['Cycling (Vigorous)', 10.0],
  ['Mountain Biking', 8.5], ['Swimming (Freestyle)', 8.3], ['Swimming (Leisure)', 6.0],
  ['Elliptical Trainer', 5.0], ['Rowing Machine', 7.0], ['Stairmaster', 9.0],
  ['Jump Rope', 11.0], ['Air Bike', 8.5], ['SkiErg', 7.5], ['Hiking', 6.0],
  ['Ice Skating', 7.0], ['Rollerblading', 7.5], ['Dancing', 5.5],
];

const SPORTS_ACTIVITIES = [
  ['Basketball', 6.5], ['American Football', 8.0], ['Soccer', 7.0], ['Padel', 6.0],
  ['Tennis', 7.3], ['Table Tennis', 4.0], ['Badminton', 5.5], ['Volleyball', 4.0],
  ['Baseball', 5.0], ['Cricket', 5.0], ['Rugby', 8.3], ['Golf', 4.3],
  ['Boxing (Sparring)', 9.0], ['Kickboxing', 8.5], ['Muay Thai', 8.5], ['MMA Training', 9.5],
  ['Brazilian Jiu-Jitsu', 7.5], ['Judo', 8.0], ['Karate', 7.5], ['Taekwondo', 7.5],
  ['Wrestling', 6.0], ['Surfing', 5.0], ['Kayaking', 5.0], ['Rowing (Sport)', 8.5],
];

const STRETCH_MOBILITY = [
  ['Hamstring Stretch', 'Stretching', ['Hamstrings']],
  ['Quad Stretch', 'Stretching', ['Quadriceps']],
  ['Hip Flexor Stretch', 'Mobility', ['Hip Flexors']],
  ['Shoulder Cross-Body Stretch', 'Stretching', ['Rear Delts']],
  ['Cat-Cow', 'Mobility', ['Spinal Erectors', 'Core']],
  ['World\'s Greatest Stretch', 'Mobility', ['Hip Flexors', 'Hamstrings', 'Core']],
  ['90/90 Hip Stretch', 'Mobility', ['Glutes', 'Adductors']],
  ['Thoracic Spine Rotation', 'Mobility', ['Upper Back', 'Obliques']],
  ['Ankle Dorsiflexion Mobilization', 'Mobility', ['Calves', 'Tibialis']],
  ['Downward Dog', 'Yoga', ['Hamstrings', 'Calves', 'Front Delts']],
  ['Sun Salutation', 'Yoga', ['Full Body']],
  ['Warrior II', 'Yoga', ['Quadriceps', 'Glutes']],
  ['Pigeon Pose', 'Yoga', ['Glutes', 'Hip Flexors']],
  ['Child\'s Pose', 'Yoga', ['Lower Back']],
  ['Pilates Hundred', 'Pilates', ['Abs', 'Core']],
  ['Pilates Roll-Up', 'Pilates', ['Abs', 'Spinal Erectors']],
  ['Pilates Teaser', 'Pilates', ['Abs', 'Hip Flexors']],
  ['Foam Rolling - IT Band', 'Rehabilitation', ['Abductors']],
  ['Band Pull-Apart', 'Rehabilitation', ['Rear Delts', 'Rotator Cuff']],
  ['Scapular Wall Slide', 'Rehabilitation', ['Rotator Cuff', 'Upper Back']],
];

const DAILY_ACTIVITIES = [
  ['Climbing Stairs', 8.0], ['Carrying Groceries', 4.0], ['Gardening', 4.0],
  ['House Cleaning', 3.3], ['Moving Furniture', 6.0], ['Shoveling Snow', 6.0],
  ['Mowing the Lawn', 5.5], ['Washing the Car', 3.0], ['Playing with Kids (Active)', 5.0],
];

// -------------------------------------------------------------------------
// SECTION 5: GENERATION HELPERS
// -------------------------------------------------------------------------

let _idCounter = 0;
const nextId = () => `ex_${(++_idCounter).toString(36)}`;

const slugify = (str) =>
  str.toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const round = (n, d = 1) => {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
};

// Cartesian product of arrays of modifier-option-arrays, capped to keep the
// combinatorics realistic (not every family needs every modifier combo).
function buildVariationCombos(modProfileArrays, maxPerEquipment) {
  // Produce a curated set of combos: base (no modifiers) + one-modifier-at-a-time
  // + a handful of two-modifier combos, rather than a full cartesian blowup.
  const combos = [[]]; // start with "no modifiers" (the plain/standard version)
  for (const options of modProfileArrays) {
    for (const opt of options) {
      if (opt.startsWith('Standard')) continue; // standard is implied by base
      combos.push([opt]);
    }
  }
  // add a few realistic two-modifier combos (angle + grip, stance + tempo, etc.)
  if (modProfileArrays.length >= 2) {
    const [a, b] = modProfileArrays;
    for (const optA of a) {
      if (optA.startsWith('Standard')) continue;
      for (const optB of b.slice(0, 2)) {
        if (optB.startsWith('Standard')) continue;
        combos.push([optA, optB]);
      }
    }
  }
  return combos.slice(0, maxPerEquipment);
}

function buildName(baseName, equipment, modifiers) {
  const parts = [];
  if (modifiers.length) parts.push(modifiers.join(' '));
  parts.push(equipment !== 'Bodyweight' && equipment !== 'Machine' ? equipment : (equipment === 'Machine' ? 'Machine' : ''));
  parts.push(baseName);
  return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

function calorieFormulaString() {
  return 'Calories = MET x Weight(kg) x Duration(hours)';
}

function metTriplet(baseMet) {
  return {
    lightMET: round(baseMet * 0.75, 1),
    moderateMET: round(baseMet, 1),
    vigorousMET: round(baseMet * 1.3, 1),
    averageMET: round(baseMet, 1),
  };
}

function caloriesPerMinuteFromMet(met, weightKg = 75) {
  return round((met * weightKg * 3.5) / 200, 1); // standard ACSM approximation
}

function buildInstructions(family, equipmentName, modifiers) {
  const mod = modifiers.length ? ` using a ${modifiers.join(', ').toLowerCase()} variation` : '';
  return [
    `Set up with the ${equipmentName.toLowerCase()} positioned securely and select an appropriate load.`,
    `Brace your core and assume a stable ${family.bodyRegion.toLowerCase()} position${mod}.`,
    `Perform the ${family.name.toLowerCase()} through a full, controlled range of motion, emphasizing the ${family.primaryMuscles.join(' and ').toLowerCase()}.`,
    `Return to the starting position under control and repeat for the prescribed reps.`,
  ];
}

function buildCommonMistakes(family) {
  return [
    'Using excessive momentum instead of controlled muscle tension',
    'Cutting the range of motion short',
    `Failing to properly engage the ${family.primaryMuscles[0]?.toLowerCase() || 'target muscle'}`,
    'Poor breathing pattern throughout the rep',
  ];
}

function buildTips(family) {
  return [
    'Prioritize controlled tempo over heavier weight when learning the movement',
    `Keep tension on the ${family.primaryMuscles[0]?.toLowerCase() || 'target muscle group'} throughout the set`,
    'Warm up with a lighter load before working sets',
  ];
}

function repRangeFor(mechanics, difficulty) {
  if (mechanics === 'Isolation') return difficulty === 'Advanced' ? '10-15' : '10-20';
  return difficulty === 'Advanced' ? '3-6' : difficulty === 'Intermediate' ? '6-10' : '8-12';
}

function setsFor(mechanics) {
  return mechanics === 'Isolation' ? 3 : 4;
}

function restFor(mechanics, difficulty) {
  if (difficulty === 'Advanced' && mechanics === 'Compound') return '180-300s';
  if (mechanics === 'Compound') return '90-150s';
  return '45-75s';
}

// -------------------------------------------------------------------------
// SECTION 6: MASTER GENERATOR
// -------------------------------------------------------------------------

function generateFromFamily(family) {
  const generated = [];
  const modProfiles = MOD_PROFILES[family.movementType] || [];
  const combos = buildVariationCombos(modProfiles, 14);

  for (const equipmentName of family.equipmentOptions) {
    for (const modifiers of combos) {
      const name = buildName(family.name, equipmentName, modifiers);
      const homeCompatible = ['Bodyweight', 'Dumbbells', 'Resistance Band', 'Kettlebell', 'TRX', 'Gym Rings', 'Swiss Ball', 'Pull-up Bar', 'Medicine Ball'].includes(equipmentName);
      const gymCompatible = true;
      const requiresSpotter = (family.requiresSpotterEquip || []).includes(equipmentName) && !modifiers.includes('Single Arm');
      const unilateral = modifiers.some(m => m.toLowerCase().includes('single') || m.toLowerCase().includes('alternating'));
      const met = metTriplet(family.met + (modifiers.includes('Explosive') ? 1.0 : 0) + (unilateral ? 0.3 : 0));

      const exercise = {
        id: nextId(),
        slug: slugify(name),
        name,
        aliases: [family.name, ...(equipmentName !== 'Bodyweight' ? [`${equipmentName} ${family.name}`] : [])],
        category: family.category,
        subCategory: family.movementType,
        exerciseType: 'Strength',
        equipment: equipmentName,
        difficulty: family.difficulty,
        skillLevel: family.difficulty,
        force: family.force,
        mechanics: family.mechanics,
        movementPattern: family.movementPattern,
        planeOfMotion: family.plane,
        bodyRegion: family.bodyRegion,
        primaryMuscles: family.primaryMuscles,
        secondaryMuscles: family.secondaryMuscles,
        stabilizerMuscles: family.stabilizerMuscles,
        targetMuscles: [...new Set([...family.primaryMuscles, ...family.secondaryMuscles])],
        compound: family.mechanics === 'Compound',
        isolation: family.mechanics === 'Isolation',
        unilateral,
        bilateral: !unilateral,
        homeCompatible,
        gymCompatible,
        requiresSpotter,
        recommendedRepRange: repRangeFor(family.mechanics, family.difficulty),
        recommendedSets: setsFor(family.mechanics),
        averageRest: restFor(family.mechanics, family.difficulty),
        tempo: modifiers.includes('Paused') ? '3-2-1-0' : modifiers.includes('Tempo') ? '3-1-1-0' : modifiers.includes('Explosive') ? '1-0-X-0' : '2-0-2-0',
        rom: modifiers.includes('Partial Reps') ? 'Partial' : modifiers.includes('Deficit') ? 'Extended' : 'Full',
        averageDuration: 40,
        averageWeight: null,
        estimatedCaloriesPerMinute: caloriesPerMinuteFromMet(met.averageMET),
        averageMET: met.averageMET,
        lightMET: met.lightMET,
        moderateMET: met.moderateMET,
        vigorousMET: met.vigorousMET,
        calorieFormula: calorieFormulaString(),
        instructions: buildInstructions(family, equipmentName, modifiers),
        commonMistakes: buildCommonMistakes(family),
        tips: buildTips(family),
        breathing: 'Exhale on exertion (the hardest part of the rep), inhale on the return.',
        progressions: [`Increase load on ${family.name}`, `Advance to unilateral ${family.name} variations`],
        regressions: [`Reduce load or range of motion`, `Use an assisted or banded ${family.name} variation`],
        variations: [family.name, ...modifiers],
        alternativeExercises: family.equipmentOptions.filter(e => e !== equipmentName).slice(0, 3).map(e => `${e} ${family.name}`),
        alternativeExercisesForList: null,
        contraindications: family.difficulty === 'Advanced' ? ['Uncontrolled joint pain', 'Recent surgery in involved joints'] : ['Acute injury to involved joints'],
        injuryWarnings: requiresSpotter ? ['Use a spotter or safety pins for heavy loads'] : [],
        beginnerFriendly: family.difficulty === 'Beginner',
        video: null,
        gif: null,
        image: null,
        notes: null,
      };
      generated.push(exercise);
    }
  }
  return generated;
}

function generateCardio() {
  return CARDIO_ACTIVITIES.map(([name, met]) => {
    const mets = metTriplet(met);
    return {
      id: nextId(), slug: slugify(name), name, aliases: [name],
      category: 'Cardio', subCategory: 'Cardio', exerciseType: 'Cardio',
      equipment: 'Bodyweight', difficulty: met > 9 ? 'Advanced' : met > 6 ? 'Intermediate' : 'Beginner',
      skillLevel: 'All Levels', force: 'Push', mechanics: 'Compound',
      movementPattern: 'Gait', planeOfMotion: 'Sagittal', bodyRegion: 'Full Body',
      primaryMuscles: ['Quadriceps', 'Hamstrings', 'Calves'], secondaryMuscles: ['Glutes', 'Core'], stabilizerMuscles: ['Core'],
      targetMuscles: ['Quadriceps', 'Hamstrings', 'Calves', 'Glutes', 'Core'],
      compound: true, isolation: false, unilateral: false, bilateral: true,
      homeCompatible: true, gymCompatible: true, requiresSpotter: false,
      recommendedRepRange: null, recommendedSets: null, averageRest: '0-60s',
      tempo: null, rom: 'Full', averageDuration: 30, averageWeight: null,
      estimatedCaloriesPerMinute: caloriesPerMinuteFromMet(mets.averageMET),
      averageMET: mets.averageMET, lightMET: mets.lightMET, moderateMET: mets.moderateMET, vigorousMET: mets.vigorousMET,
      calorieFormula: calorieFormulaString(),
      instructions: [`Begin at an easy pace to warm up.`, `Gradually build to your target intensity for ${name}.`, `Maintain steady breathing and posture.`, `Cool down gradually at the end of the session.`],
      commonMistakes: ['Starting too fast', 'Poor posture leading to fatigue', 'Inconsistent pacing'],
      tips: ['Track duration and perceived exertion', 'Stay hydrated', 'Progress duration before intensity'],
      breathing: 'Rhythmic breathing matched to movement cadence.',
      progressions: ['Increase duration', 'Increase intensity/incline/resistance'],
      regressions: ['Reduce duration', 'Lower intensity'],
      variations: [`${name} Intervals`, `${name} Steady State`],
      alternativeExercises: [],
      contraindications: ['Uncontrolled cardiovascular conditions'],
      injuryWarnings: [], beginnerFriendly: met <= 6,
      video: null, gif: null, image: null, notes: null,
    };
  });
}

function generateSports() {
  return SPORTS_ACTIVITIES.map(([name, met]) => {
    const mets = metTriplet(met);
    return {
      id: nextId(), slug: slugify(name), name, aliases: [name],
      category: 'Sports', subCategory: 'Sports', exerciseType: 'Sport',
      equipment: 'Bodyweight', difficulty: 'Intermediate', skillLevel: 'Sport-Specific',
      force: 'Push', mechanics: 'Compound', movementPattern: 'Gait', planeOfMotion: 'Transverse',
      bodyRegion: 'Full Body', primaryMuscles: ['Core', 'Quadriceps'], secondaryMuscles: ['Glutes', 'Calves'], stabilizerMuscles: ['Core'],
      targetMuscles: ['Core', 'Quadriceps', 'Glutes', 'Calves'],
      compound: true, isolation: false, unilateral: false, bilateral: true,
      homeCompatible: false, gymCompatible: false, requiresSpotter: false,
      recommendedRepRange: null, recommendedSets: null, averageRest: 'Variable',
      tempo: null, rom: 'Full', averageDuration: 45, averageWeight: null,
      estimatedCaloriesPerMinute: caloriesPerMinuteFromMet(mets.averageMET),
      averageMET: mets.averageMET, lightMET: mets.lightMET, moderateMET: mets.moderateMET, vigorousMET: mets.vigorousMET,
      calorieFormula: calorieFormulaString(),
      instructions: [`Warm up dynamically before playing/training ${name}.`, `Follow sport-specific technique and safety rules.`, `Cool down and stretch afterward.`],
      commonMistakes: ['Skipping the warm-up', 'Poor technique under fatigue'],
      tips: ['Use proper protective equipment', 'Progress skill drills before full intensity play'],
      breathing: 'Natural breathing adapted to exertion.',
      progressions: ['Increase play intensity/duration', 'Add competitive drills'],
      regressions: ['Practice drills at lower intensity'],
      variations: [`${name} Drills`, `${name} Match Play`],
      alternativeExercises: [], contraindications: ['Uncontrolled cardiovascular conditions'],
      injuryWarnings: ['Use proper protective gear'], beginnerFriendly: false,
      video: null, gif: null, image: null, notes: null,
    };
  });
}

function generateStretchMobility() {
  return STRETCH_MOBILITY.map(([name, category, muscles]) => {
    const met = 2.5;
    const mets = metTriplet(met);
    return {
      id: nextId(), slug: slugify(name), name, aliases: [name],
      category, subCategory: category, exerciseType: 'Stretching',
      equipment: 'Bodyweight', difficulty: 'Beginner', skillLevel: 'All Levels',
      force: 'Static', mechanics: 'Isolation', movementPattern: 'Isometric', planeOfMotion: 'Sagittal',
      bodyRegion: 'Full Body', primaryMuscles: muscles, secondaryMuscles: [], stabilizerMuscles: ['Core'],
      targetMuscles: muscles, compound: false, isolation: true, unilateral: false, bilateral: true,
      homeCompatible: true, gymCompatible: true, requiresSpotter: false,
      recommendedRepRange: null, recommendedSets: 1, averageRest: '0s',
      tempo: null, rom: 'Full', averageDuration: 3, averageWeight: null,
      estimatedCaloriesPerMinute: caloriesPerMinuteFromMet(mets.averageMET),
      averageMET: mets.averageMET, lightMET: mets.lightMET, moderateMET: mets.moderateMET, vigorousMET: mets.vigorousMET,
      calorieFormula: calorieFormulaString(),
      instructions: [`Move slowly into the ${name} position.`, 'Hold at a comfortable end range without pain, breathing deeply.', 'Release slowly and repeat on the opposite side if applicable.'],
      commonMistakes: ['Bouncing into the stretch', 'Holding your breath', 'Forcing beyond a comfortable range'],
      tips: ['Hold for 20-45 seconds', 'Never stretch into sharp pain', 'Perform after a light warm-up'],
      breathing: 'Slow, deep breaths throughout the hold.',
      progressions: ['Increase hold duration', 'Deepen range gradually'],
      regressions: ['Reduce range of motion', 'Use support/assistance'],
      variations: [`${name} (Assisted)`, `${name} (Weighted)`],
      alternativeExercises: [], contraindications: ['Acute injury in stretched area'],
      injuryWarnings: [], beginnerFriendly: true,
      video: null, gif: null, image: null, notes: null,
    };
  });
}

function generateDailyActivities() {
  return DAILY_ACTIVITIES.map(([name, met]) => {
    const mets = metTriplet(met);
    return {
      id: nextId(), slug: slugify(name), name, aliases: [name],
      category: 'Daily Activities', subCategory: 'Daily Activities', exerciseType: 'Cardio',
      equipment: 'Bodyweight', difficulty: 'Beginner', skillLevel: 'All Levels',
      force: 'Push', mechanics: 'Compound', movementPattern: 'Gait', planeOfMotion: 'Sagittal',
      bodyRegion: 'Full Body', primaryMuscles: ['Core'], secondaryMuscles: ['Quadriceps', 'Glutes'], stabilizerMuscles: ['Core'],
      targetMuscles: ['Core', 'Quadriceps', 'Glutes'], compound: true, isolation: false,
      unilateral: false, bilateral: true, homeCompatible: true, gymCompatible: false, requiresSpotter: false,
      recommendedRepRange: null, recommendedSets: null, averageRest: 'Variable',
      tempo: null, rom: 'Full', averageDuration: 20, averageWeight: null,
      estimatedCaloriesPerMinute: caloriesPerMinuteFromMet(mets.averageMET),
      averageMET: mets.averageMET, lightMET: mets.lightMET, moderateMET: mets.moderateMET, vigorousMET: mets.vigorousMET,
      calorieFormula: calorieFormulaString(),
      instructions: [`Perform ${name.toLowerCase()} using proper body mechanics.`, 'Keep your core braced, especially when lifting or bending.'],
      commonMistakes: ['Rounding the back when lifting', 'Overexertion without breaks'],
      tips: ['Use proper lifting technique', 'Take breaks as needed'],
      breathing: 'Natural breathing, exhale on exertion.',
      progressions: ['Increase duration or load carried'],
      regressions: ['Break the activity into shorter bouts'],
      variations: [], alternativeExercises: [], contraindications: ['Acute back injury'],
      injuryWarnings: ['Use proper lifting form'], beginnerFriendly: true,
      video: null, gif: null, image: null, notes: null,
    };
  });
}

function generateMachineBrandVariants() {
  // A curated set of machine-based exercise families expanded across gym
  // equipment brands, representing the "Machines" catalog.
  const machineFamilies = FAMILIES.filter(f => f.equipmentOptions.includes('Machine'));
  const picks = machineFamilies.slice(0, 12); // keep this catalog focused
  const out = [];
  for (const family of picks) {
    for (const brand of GYM_MACHINE_BRANDS) {
      const name = `${brand} ${family.name} Machine`;
      const met = metTriplet(family.met);
      out.push({
        id: nextId(), slug: slugify(name), name, aliases: [family.name, `${brand} ${family.name}`],
        category: 'Machines', subCategory: family.movementType, exerciseType: 'Strength',
        equipment: 'Machine', difficulty: family.difficulty, skillLevel: family.difficulty,
        force: family.force, mechanics: family.mechanics, movementPattern: family.movementPattern,
        planeOfMotion: family.plane, bodyRegion: family.bodyRegion,
        primaryMuscles: family.primaryMuscles, secondaryMuscles: family.secondaryMuscles, stabilizerMuscles: family.stabilizerMuscles,
        targetMuscles: [...new Set([...family.primaryMuscles, ...family.secondaryMuscles])],
        compound: family.mechanics === 'Compound', isolation: family.mechanics === 'Isolation',
        unilateral: false, bilateral: true, homeCompatible: false, gymCompatible: true, requiresSpotter: false,
        recommendedRepRange: repRangeFor(family.mechanics, family.difficulty), recommendedSets: setsFor(family.mechanics),
        averageRest: restFor(family.mechanics, family.difficulty), tempo: '2-0-2-0', rom: 'Full',
        averageDuration: 40, averageWeight: null,
        estimatedCaloriesPerMinute: caloriesPerMinuteFromMet(met.averageMET),
        averageMET: met.averageMET, lightMET: met.lightMET, moderateMET: met.moderateMET, vigorousMET: met.vigorousMET,
        calorieFormula: calorieFormulaString(),
        instructions: buildInstructions(family, `${brand} machine`, []),
        commonMistakes: buildCommonMistakes(family), tips: buildTips(family),
        breathing: 'Exhale on exertion, inhale on the return.',
        progressions: [`Increase machine stack weight`], regressions: [`Reduce machine stack weight`],
        variations: [family.name], alternativeExercises: [`${family.name} (Free Weight)`],
        contraindications: ['Acute injury to involved joints'], injuryWarnings: [],
        beginnerFriendly: family.difficulty === 'Beginner',
        video: null, gif: null, image: null, notes: `${brand}-branded equipment; adjust seat/pad settings to your anthropometry before use.`,
      });
    }
  }
  return out;
}

// -------------------------------------------------------------------------
// SECTION 7: BUILD THE DATABASE
// -------------------------------------------------------------------------

function buildDatabase() {
  const all = [];
  for (const family of FAMILIES) {
    all.push(...generateFromFamily(family));
  }
  all.push(...generateCardio());
  all.push(...generateSports());
  all.push(...generateStretchMobility());
  all.push(...generateDailyActivities());
  all.push(...generateMachineBrandVariants());
  return all;
}

function dedupeSlugs(db) {
  const seen = new Map();
  for (const ex of db) {
    const base = ex.slug;
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    if (count > 0) {
      ex.slug = `${base}-${count + 1}`;
    }
  }
  return db;
}

export const EXERCISE_DATABASE = dedupeSlugs(buildDatabase());

// -------------------------------------------------------------------------
// SECTION 8: SEARCH INDEX
// -------------------------------------------------------------------------

function buildIndex(db) {
  const byId = new Map();
  const bySlug = new Map();
  const byCategory = new Map();
  const byMuscle = new Map();
  const byEquipment = new Map();
  const byDifficulty = new Map();
  const byForce = new Map();
  const byMovementPattern = new Map();
  const byBodyRegion = new Map();
  const byExerciseType = new Map();
  const nameTokens = new Map(); // token -> Set(ids), for fast partial/typo search

  const addTo = (map, key, id) => {
    if (key === undefined || key === null) return;
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(id);
  };

  for (const ex of db) {
    byId.set(ex.id, ex);
    bySlug.set(ex.slug, ex);
    addTo(byCategory, ex.category, ex.id);
    addTo(byEquipment, ex.equipment, ex.id);
    addTo(byDifficulty, ex.difficulty, ex.id);
    addTo(byForce, ex.force, ex.id);
    addTo(byMovementPattern, ex.movementPattern, ex.id);
    addTo(byBodyRegion, ex.bodyRegion, ex.id);
    addTo(byExerciseType, ex.exerciseType, ex.id);
    for (const m of [...ex.primaryMuscles, ...ex.secondaryMuscles, ...ex.stabilizerMuscles]) {
      addTo(byMuscle, m, ex.id);
    }
    const tokens = new Set(
      `${ex.name} ${ex.aliases.join(' ')}`.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
    );
    for (const t of tokens) addTo(nameTokens, t, ex.id);
  }

  return {
    byId, bySlug, byCategory, byMuscle, byEquipment, byDifficulty, byForce,
    byMovementPattern, byBodyRegion, byExerciseType, nameTokens,
  };
}

export const ExerciseIndex = buildIndex(EXERCISE_DATABASE);

// -------------------------------------------------------------------------
// SECTION 9: FUZZY MATCH (typo tolerance) — small Levenshtein distance
// -------------------------------------------------------------------------

function levenshtein(a, b) {
  if (a === b) return 0;
  const al = a.length, bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;
  let prev = new Array(bl + 1);
  let curr = new Array(bl + 1);
  for (let j = 0; j <= bl; j++) prev[j] = j;
  for (let i = 1; i <= al; i++) {
    curr[0] = i;
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[bl];
}

function idsFromSets(...sets) {
  const out = new Set();
  for (const s of sets) if (s) for (const id of s) out.add(id);
  return out;
}

// -------------------------------------------------------------------------
// SECTION 10: SEARCH FUNCTIONS
// -------------------------------------------------------------------------

export function searchExercises(query, { limit = 50 } = {}) {
  if (!query || !query.trim()) return [];
  const q = query.toLowerCase().trim();
  const qTokens = q.split(/[^a-z0-9]+/).filter(Boolean);
  const scored = new Map(); // id -> score

  // Exact / partial token matches from the index (fast path)
  for (const [token, idSet] of ExerciseIndex.nameTokens) {
    for (const qt of qTokens) {
      if (token === qt) {
        for (const id of idSet) scored.set(id, (scored.get(id) || 0) + 3);
      } else if (token.includes(qt) || qt.includes(token)) {
        for (const id of idSet) scored.set(id, (scored.get(id) || 0) + 1.5);
      } else if (qt.length > 3 && levenshtein(token, qt) <= 2) {
        // typo tolerance
        for (const id of idSet) scored.set(id, (scored.get(id) || 0) + 1);
      }
    }
  }

  // Whole-phrase substring match as a bonus (handles multi-word queries like "close grip bench")
  for (const ex of EXERCISE_DATABASE) {
    const haystack = `${ex.name} ${ex.aliases.join(' ')}`.toLowerCase();
    if (haystack.includes(q)) scored.set(ex.id, (scored.get(ex.id) || 0) + 5);
  }

  return [...scored.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => ExerciseIndex.byId.get(id));
}

const setToExercises = (idSet) => idSet ? [...idSet].map(id => ExerciseIndex.byId.get(id)) : [];

export const searchByMuscle = (muscle) => setToExercises(ExerciseIndex.byMuscle.get(muscle));
export const searchByEquipment = (equipment) => setToExercises(ExerciseIndex.byEquipment.get(equipment));
export const searchByDifficulty = (difficulty) => setToExercises(ExerciseIndex.byDifficulty.get(difficulty));
export const searchByForce = (force) => setToExercises(ExerciseIndex.byForce.get(force));
export const searchByMovement = (movementPattern) => setToExercises(ExerciseIndex.byMovementPattern.get(movementPattern));
export const searchByCategory = (category) => setToExercises(ExerciseIndex.byCategory.get(category));
export const searchByBodyRegion = (bodyRegion) => setToExercises(ExerciseIndex.byBodyRegion.get(bodyRegion));
export const searchByExerciseType = (exerciseType) => setToExercises(ExerciseIndex.byExerciseType.get(exerciseType));
export const searchCompound = () => EXERCISE_DATABASE.filter(e => e.compound);
export const searchIsolation = () => EXERCISE_DATABASE.filter(e => e.isolation);
export const searchGym = () => EXERCISE_DATABASE.filter(e => e.gymCompatible);
export const searchHome = () => EXERCISE_DATABASE.filter(e => e.homeCompatible);
export const searchCardio = () => searchByExerciseType('Cardio');
export const searchSports = () => searchByCategory('Sports');
export const searchMachines = () => searchByCategory('Machines').concat(searchByEquipment('Machine'))
  .filter((v, i, arr) => arr.findIndex(x => x.id === v.id) === i);

// -------------------------------------------------------------------------
// SECTION 11: HELPER / GETTER FUNCTIONS
// -------------------------------------------------------------------------

export const getExercise = (id) => ExerciseIndex.byId.get(id) || null;
export const getExerciseBySlug = (slug) => ExerciseIndex.bySlug.get(slug) || null;
export const getExercisesByCategory = (category) => searchByCategory(category);
export const getExercisesByMuscle = (muscle) => searchByMuscle(muscle);
export const getExercisesByEquipment = (equipment) => searchByEquipment(equipment);
export const getExercisesByDifficulty = (difficulty) => searchByDifficulty(difficulty);
export const getExercisesByBodyRegion = (bodyRegion) => searchByBodyRegion(bodyRegion);
export const getCompoundExercises = () => searchCompound();
export const getIsolationExercises = () => searchIsolation();
export const getCardioExercises = () => searchCardio();
export const getSports = () => searchSports();
export const getMachineExercises = () => searchMachines();
export const getHomeExercises = () => searchHome();
export const getGymExercises = () => searchGym();
export const getCategories = () => [...CATEGORIES];
export const getMuscles = () => [...MUSCLES];
export const getEquipment = () => [...EQUIPMENT];

// -------------------------------------------------------------------------
// SECTION 12: CALORIE / WORKOUT CALCULATIONS
// -------------------------------------------------------------------------

/**
 * Core calorie formula: Calories = MET x Weight(kg) x Duration(hours)
 */
export function calculateCalories({ met, weightKg = 75, durationMinutes = 30 }) {
  const durationHours = durationMinutes / 60;
  return round(met * weightKg * durationHours, 0);
}

export function calculateCaloriesPerMinute({ met, weightKg = 75 }) {
  return caloriesPerMinuteFromMet(met, weightKg);
}

/**
 * Calculate calories for a single logged exercise entry.
 * intensity: 'light' | 'moderate' | 'vigorous'
 */
export function calculateExerciseCalories({ exerciseId, weightKg = 75, durationMinutes = 10, intensity = 'moderate' }) {
  const exercise = getExercise(exerciseId);
  if (!exercise) return null;
  const met = intensity === 'light' ? exercise.lightMET
    : intensity === 'vigorous' ? exercise.vigorousMET
    : exercise.moderateMET;
  return calculateCalories({ met, weightKg, durationMinutes });
}

/**
 * Calculate total calories for a full workout.
 * entries: [{ exerciseId, durationMinutes, intensity }]
 */
export function calculateWorkoutCalories({ entries = [], weightKg = 75 }) {
  let total = 0;
  const breakdown = [];
  for (const entry of entries) {
    const cals = calculateExerciseCalories({
      exerciseId: entry.exerciseId,
      weightKg,
      durationMinutes: entry.durationMinutes ?? 10,
      intensity: entry.intensity ?? 'moderate',
    });
    if (cals !== null) {
      total += cals;
      breakdown.push({ exerciseId: entry.exerciseId, calories: cals });
    }
  }
  return { totalCalories: round(total, 0), breakdown };
}

/**
 * Estimate total workout duration in minutes given a list of
 * { exerciseId, sets, restSeconds } entries.
 */
export function estimateWorkoutTime({ entries = [] }) {
  let totalSeconds = 0;
  for (const entry of entries) {
    const exercise = getExercise(entry.exerciseId);
    const sets = entry.sets ?? exercise?.recommendedSets ?? 3;
    const secondsPerSet = entry.secondsPerSet ?? 40;
    const parsedRest = parseInt((exercise?.averageRest || '60').replace(/\D+/g, ''));
    const restSeconds = entry.restSeconds ?? (parsedRest || 60);
    totalSeconds += sets * (secondsPerSet + restSeconds);
  }
  return { minutes: round(totalSeconds / 60, 1), seconds: totalSeconds };
}

// -------------------------------------------------------------------------
// SECTION 13: STATS / RECOMMENDATIONS
// -------------------------------------------------------------------------

export function getMuscleVolumeStats(entries = []) {
  // entries: [{ exerciseId, sets }]
  const stats = {};
  for (const entry of entries) {
    const exercise = getExercise(entry.exerciseId);
    if (!exercise) continue;
    const sets = entry.sets ?? exercise.recommendedSets ?? 3;
    for (const m of exercise.primaryMuscles) stats[m] = (stats[m] || 0) + sets;
    for (const m of exercise.secondaryMuscles) stats[m] = (stats[m] || 0) + sets * 0.5;
  }
  return stats;
}

export function recommendExercises({ muscle, equipmentAvailable = [], difficulty, limit = 10 }) {
  let pool = muscle ? searchByMuscle(muscle) : EXERCISE_DATABASE;
  if (equipmentAvailable.length) {
    pool = pool.filter(e => equipmentAvailable.includes(e.equipment));
  }
  if (difficulty) {
    pool = pool.filter(e => e.difficulty === difficulty);
  }
  // Favor compound movements first, then isolation, capped to limit.
  return [...pool]
    .sort((a, b) => (b.compound === a.compound) ? 0 : (b.compound ? 1 : -1))
    .slice(0, limit);
}

export function getDatabaseStats() {
  return {
    totalExercises: EXERCISE_DATABASE.length,
    byCategory: Object.fromEntries([...ExerciseIndex.byCategory.entries()].map(([k, v]) => [k, v.size])),
    byEquipment: Object.fromEntries([...ExerciseIndex.byEquipment.entries()].map(([k, v]) => [k, v.size])),
    byDifficulty: Object.fromEntries([...ExerciseIndex.byDifficulty.entries()].map(([k, v]) => [k, v.size])),
  };
}

// -------------------------------------------------------------------------
// DEFAULT EXPORT
// -------------------------------------------------------------------------

export default {
  EXERCISE_DATABASE,
  ExerciseIndex,
  CATEGORIES,
  MUSCLES,
  EQUIPMENT,
  searchExercises,
  searchByMuscle,
  searchByEquipment,
  searchByDifficulty,
  searchByForce,
  searchByMovement,
  searchByCategory,
  searchByBodyRegion,
  searchByExerciseType,
  searchCompound,
  searchIsolation,
  searchGym,
  searchHome,
  searchCardio,
  searchSports,
  searchMachines,
  getExercise,
  getExerciseBySlug,
  getExercisesByCategory,
  getExercisesByMuscle,
  getExercisesByEquipment,
  getExercisesByDifficulty,
  getExercisesByBodyRegion,
  getCompoundExercises,
  getIsolationExercises,
  getCardioExercises,
  getSports,
  getMachineExercises,
  getHomeExercises,
  getGymExercises,
  getCategories,
  getMuscles,
  getEquipment,
  calculateCalories,
  calculateCaloriesPerMinute,
  calculateExerciseCalories,
  calculateWorkoutCalories,
  estimateWorkoutTime,
  getMuscleVolumeStats,
  recommendExercises,
  getDatabaseStats,
};
