import type { AvatarFullConfig } from 'react-nice-avatar';

function hashSeed(seed: string): number {
  let hash = 0;
  if (!seed || seed.length === 0) return hash;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

function pick<T>(arr: T[], hash: number, offset = 0): T {
  const index = Math.abs(hash + offset) % arr.length;
  return arr[index]!;
}

export function getDeterministicAvatarConfig(seed: string): AvatarFullConfig {
  const hash = hashSeed(seed);

  const sexes: ('man' | 'woman')[] = ['man', 'woman'];
  const sex = pick(sexes, hash, 1);

  // Natural skin tones
  const faceColors = ['#F9C9B6', '#EDB98A', '#AC6651'];
  const faceColor = pick(faceColors, hash, 2);

  // Natural hair tones for clean professional SaaS look
  const hairColors = ['#171921', '#4A3728', '#77311D', '#2C2C2C', '#5C4033'];
  const hairColor = pick(hairColors, hash, 3);

  const manHairStyles: ('normal' | 'thick')[] = ['normal', 'thick'];
  const womanHairStyles: ('normal' | 'womanLong' | 'womanShort')[] = ['normal', 'womanLong', 'womanShort'];
  const hairStyle = sex === 'man' ? pick(manHairStyles, hash, 4) : pick(womanHairStyles, hash, 4);

  // Soft, pleasant background colors
  const bgColors = [
    '#F3F4F6',
    '#E0DDFF',
    '#D2EFF3',
    '#FFEDEF',
    '#FFEBA4',
    '#FCE7E7',
    '#EDE9FE',
    '#E5E7EB',
  ];
  const bgColor = pick(bgColors, hash, 5);

  const shirtColors = [
    '#E50914',
    '#1F2937',
    '#3B82F6',
    '#10B981',
    '#6366F1',
    '#4B5563',
    '#F87171',
  ];
  const shirtColor = pick(shirtColors, hash, 6);

  const shirtStyles: ('hoody' | 'short' | 'polo')[] = ['polo', 'short', 'hoody'];
  const shirtStyle = pick(shirtStyles, hash, 7);

  const earSizes: ('small' | 'big')[] = ['small', 'big'];
  const earSize = pick(earSizes, hash, 8);

  const eyeStyles: ('circle' | 'oval' | 'smile')[] = ['circle', 'oval', 'smile'];
  const eyeStyle = pick(eyeStyles, hash, 9);

  const glassesStyles: ('none' | 'none' | 'round' | 'square')[] = ['none', 'none', 'round', 'square'];
  const glassesStyle = pick(glassesStyles, hash, 10);

  const noseStyles: ('short' | 'round')[] = ['short', 'round'];
  const noseStyle = pick(noseStyles, hash, 11);

  const mouthStyles: ('smile' | 'peace')[] = ['smile', 'peace'];
  const mouthStyle = pick(mouthStyles, hash, 12);

  const eyeBrowStyle: 'up' | 'upWoman' = sex === 'woman' ? 'upWoman' : 'up';

  return {
    sex,
    faceColor,
    earSize,
    hairColor,
    hairStyle,
    hatStyle: 'none',
    eyeStyle,
    glassesStyle,
    noseStyle,
    mouthStyle,
    shirtStyle,
    shirtColor,
    bgColor,
    eyeBrowStyle,
  };
}
