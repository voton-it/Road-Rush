// Static game data: bikes, rivals, tracks, levels and prize money.
RR.DATA = (function () {
  // mph is the top speed. Internal speed is mph * 60 world units per second.
  const BIKES = [
    { id: 'vandal', name: 'Vandal 400', cls: 'Rat bike', price: 0, mph: 128, accel: 0.34, handling: 1.0, durability: 0.85, nitro: 0, color: '#9a5b36', trim: '#2a2522',
      blurb: 'Rusty, loud and held together with zip ties. It runs. Mostly.' },
    { id: 'rattler', name: 'Rattler 600', cls: 'Rat bike', price: 3200, mph: 142, accel: 0.37, handling: 1.05, durability: 0.95, nitro: 0, color: '#4f7a3a', trim: '#1d2a17',
      blurb: 'Army-surplus green with a gearbox that forgives most of your mistakes.' },
    { id: 'bandit', name: 'Bandit 750', cls: 'Sport', price: 7400, mph: 157, accel: 0.41, handling: 1.12, durability: 0.9, nitro: 0, color: '#d0a020', trim: '#2b2210',
      blurb: 'Light, twitchy and quick off the line. Great for weaving through traffic.' },
    { id: 'fury', name: 'Fury 900', cls: 'Sport', price: 12800, mph: 171, accel: 0.44, handling: 1.15, durability: 1.0, nitro: 0, color: '#c4372d', trim: '#2a0f0c',
      blurb: 'A proper sport bike. Holds a line in the bends and shrugs off a punch.' },
    { id: 'reaper', name: 'Reaper 1000', cls: 'Superbike', price: 20500, mph: 185, accel: 0.47, handling: 1.1, durability: 1.05, nitro: 2, color: '#26282e', trim: '#b8bcc4',
      blurb: 'Matte black, two nitrous shots per race. Rivals hear it before they see it.' },
    { id: 'phantom', name: 'Phantom 1200', cls: 'Superbike', price: 31000, mph: 199, accel: 0.5, handling: 1.12, durability: 1.15, nitro: 3, color: '#e8e4dc', trim: '#3060c0',
      blurb: 'The fastest thing on two wheels. Three nitrous shots and a reinforced frame.' },
  ];

  // Rivals keep their personality across the whole career; their machinery
  // and stamina scale with the level.
  const RIVALS = [
    { name: 'Viper', jacket: '#2f8f4e', helmet: '#151515', stripe: '#9be36d', skill: 0.99, aggression: 0.75, weapon: 'chain',
      quote: 'Stay out of my mirror, rookie. Better yet, stay out of my zip code.' },
    { name: 'Natasha', jacket: '#8e1f2f', helmet: '#e9e2d6', stripe: '#8e1f2f', skill: 0.98, aggression: 0.55, weapon: null,
      quote: "I don't brake for amateurs." },
    { name: 'Moose', jacket: '#6b4a2b', helmet: '#c98a2b', stripe: '#3d2a17', skill: 0.92, aggression: 0.9, weapon: 'club',
      quote: 'Last guy who passed me is still picking gravel out of his teeth.' },
    { name: 'Kiki', jacket: '#d94f9b', helmet: '#f5f0f2', stripe: '#d94f9b', skill: 0.95, aggression: 0.45, weapon: null,
      quote: "Cute bike. Shame about the paint job you're about to get." },
    { name: 'Dutch', jacket: '#d9822b', helmet: '#1f2a44', stripe: '#d9822b', skill: 0.94, aggression: 0.5, weapon: null,
      quote: "I've been riding this road since before you had a learner's permit." },
    { name: 'Bones', jacket: '#e6e1d3', helmet: '#151515', stripe: '#e6e1d3', skill: 0.9, aggression: 0.8, weapon: 'club',
      quote: "Doctors say I've broken every bone twice. Going for three." },
    { name: 'Ruby', jacket: '#b3261e', helmet: '#b3261e', stripe: '#111111', skill: 0.96, aggression: 0.7, weapon: 'chain',
      quote: "The chain's not for the bike, sweetheart." },
    { name: 'Slater', jacket: '#3b4f7a', helmet: '#9aa3b5', stripe: '#3b4f7a', skill: 0.93, aggression: 0.65, weapon: null,
      quote: 'Win money, lose teeth. Fair trade.' },
    { name: 'Tank', jacket: '#3d3f2a', helmet: '#5b6b3a', stripe: '#c9b458', skill: 0.86, aggression: 0.95, weapon: 'club',
      quote: 'Hit me. I dare you. I double-dog dare you.' },
    { name: 'Hex', jacket: '#4a2b6b', helmet: '#120d18', stripe: '#a776e8', skill: 0.95, aggression: 0.6, weapon: 'chain',
      quote: 'I can smell fear. Also gasoline. Mostly fear.' },
    { name: 'Lola', jacket: '#1f8a8a', helmet: '#f2c94c', stripe: '#1f8a8a', skill: 0.91, aggression: 0.5, weapon: null,
      quote: "Pass me on the left and you'll meet my right hook." },
    { name: 'Rocco', jacket: '#232323', helmet: '#c0392b', stripe: '#f1f1f1', skill: 0.89, aggression: 0.85, weapon: 'club',
      quote: 'My mother rides faster than you. She hits harder, too.' },
    { name: 'Jinx', jacket: '#141414', helmet: '#f2f2f2', stripe: '#141414', skill: 0.97, aggression: 0.4, weapon: null,
      quote: 'A black cat crossed my path once. It is still running.' },
    { name: 'Ace', jacket: '#c9a227', helmet: '#7a1c1c', stripe: '#c9a227', skill: 1.0, aggression: 0.35, weapon: null,
      quote: 'Second place is just the first loser with a nicer jacket.' },
  ];

  // Track themes. Colours are the full-daylight values; fog is blended in at render time.
  const TRACKS = [
    {
      id: 'coast', name: 'Pacific Coast', blurb: 'Cliffside two-lane with the ocean on your right. Long sweepers, heavy beach traffic.',
      seed: 1181, curvy: 0.75, hilly: 0.55,
      sky: [[0, '#2a6db0'], [0.5, '#7fb9e0'], [0.82, '#f3d3a4'], [1, '#f6c690']],
      sun: { x: 0.78, y: 0.42, r: 0.05, color: '#fff6dc', glow: 'rgba(255,214,140,0.55)' },
      fog: '#d9d7cf', fogDensity: 4.2,
      grass: ['#86a64a', '#7c9c43'], grassR: ['#2f7fb2', '#2b78aa'],
      road: ['#5d5d63', '#58585e'], rumble: ['#ececec', '#c73a2f'], lane: '#f2f2f2', center: '#f2c230',
      shoulder: ['#c8b68c', '#bba87f'], shoulderR: ['#e3d3a8', '#d9c89c'],
      layers: [
        { kind: 'clouds', parallax: 0.04, y: 0.08, h: 0.32, color: '#ffffff' },
        { kind: 'headlands', parallax: 0.1, h: 0.13, color: '#6d8fa8', base: '#5f88aa' },
        { kind: 'hills', parallax: 0.22, h: 0.18, color: '#5e7f4a', base: '#58784a', gappy: true },
      ],
      left: [['palm', 4], ['bush', 3], ['house', 1.2], ['billboard', 0.5], ['rock', 0.6]],
      right: [['rock', 1], ['palm', 0.4]],
      farLeft: [['palm', 2], ['house', 1], ['bush', 2]],
      farRight: [['seastack', 1]],
      traffic: 1.15,
    },
    {
      id: 'forest', name: 'Redwood Run', blurb: 'Morning fog between giant redwoods. Trees right up to the road edge, so stay on the tarmac.',
      seed: 2734, curvy: 0.9, hilly: 0.7,
      sky: [[0, '#8fa9a6'], [0.55, '#c9d6cb'], [1, '#e7e6d4']],
      sun: { x: 0.25, y: 0.3, r: 0.035, color: '#fffbe8', glow: 'rgba(255,248,214,0.45)' },
      rays: true,
      fog: '#c7d1c6', fogDensity: 7.5,
      grass: ['#3f6a35', '#39622f'], road: ['#504e4b', '#4b4946'], rumble: ['#e2e2dc', '#8a8a84'], lane: '#e8e4d8', center: '#e2b72e',
      shoulder: ['#6a5a42', '#62533c'],
      layers: [
        { kind: 'treeline', parallax: 0.12, h: 0.26, color: '#6f8a7d', base: '#6f8a7d' },
        { kind: 'treeline', parallax: 0.26, h: 0.2, color: '#4f6d5b', base: '#4f6d5b' },
      ],
      left: [['redwood', 4], ['fern', 3], ['pine', 1.5], ['rock', 0.4], ['sign', 0.25]],
      right: [['redwood', 4], ['fern', 3], ['pine', 1.5], ['rock', 0.4]],
      farLeft: [['redwood', 3], ['pine', 2]], farRight: [['redwood', 3], ['pine', 2]],
      dense: true,
      traffic: 0.8,
    },
    {
      id: 'desert', name: 'Mojave Burn', blurb: 'Sunset over red mesas. Fast straights, blind crests and big air.',
      seed: 3991, curvy: 0.45, hilly: 1.0,
      sky: [[0, '#2b2a5a'], [0.38, '#8a4a78'], [0.68, '#e9785a'], [0.9, '#f8b65e'], [1, '#fbd38a']],
      sun: { x: 0.62, y: 0.86, r: 0.07, color: '#ffe6a8', glow: 'rgba(255,150,80,0.6)' },
      fog: '#e79a6c', fogDensity: 3.2,
      grass: ['#c98a55', '#c0814e'], road: ['#4f4a4a', '#4a4545'], rumble: ['#efe6d8', '#b5432f'], lane: '#efe6d8', center: '#f0c040',
      shoulder: ['#b77a4a', '#ae7243'],
      layers: [
        { kind: 'clouds', parallax: 0.04, y: 0.05, h: 0.3, color: '#ffb59a' },
        { kind: 'mesas', parallax: 0.1, h: 0.2, color: '#9a4a47', base: '#b55c4f' },
        { kind: 'mesas', parallax: 0.2, h: 0.14, color: '#7d3a3c', base: '#c56f52', small: true },
      ],
      left: [['cactus', 3], ['rock', 2], ['shrub', 3], ['billboard', 0.5], ['fence', 1]],
      right: [['cactus', 3], ['rock', 2], ['shrub', 3], ['sign', 0.4]],
      farLeft: [['cactus', 2], ['rock', 2], ['shack', 0.4]], farRight: [['cactus', 2], ['rock', 2]],
      traffic: 0.85,
    },
    {
      id: 'alpine', name: 'Sierra Pass', blurb: 'Snowy peaks, hairpins and a long drop on every corner. Handling matters here.',
      seed: 5120, curvy: 1.1, hilly: 0.9,
      sky: [[0, '#1d5fae'], [0.6, '#79aee6'], [1, '#d6e7f5']],
      sun: { x: 0.35, y: 0.16, r: 0.03, color: '#ffffff', glow: 'rgba(255,255,240,0.5)' },
      fog: '#d3e1ec', fogDensity: 3.6,
      grass: ['#e8eef3', '#dbe4ec'], road: ['#55585e', '#505359'], rumble: ['#f4f4f4', '#d0362c'], lane: '#f4f4f4', center: '#f2c230',
      shoulder: ['#9da3a8', '#93999e'],
      layers: [
        { kind: 'clouds', parallax: 0.04, y: 0.06, h: 0.26, color: '#ffffff' },
        { kind: 'mountains', parallax: 0.1, h: 0.34, color: '#6d86a6', base: '#8aa0ba', snow: true },
        { kind: 'mountains', parallax: 0.2, h: 0.2, color: '#4c6684', base: '#6d849e', snow: true, small: true },
        { kind: 'treeline', parallax: 0.3, h: 0.1, color: '#3d5a52', base: '#c9d6e0' },
      ],
      left: [['pinesnow', 4], ['rock', 1], ['post', 2], ['sign', 0.4]],
      right: [['pinesnow', 4], ['rock', 1], ['post', 2]],
      farLeft: [['pinesnow', 3], ['cabin', 0.3]], farRight: [['pinesnow', 3]],
      traffic: 0.9,
    },
    {
      id: 'city', name: 'Neon Night', blurb: 'Downtown after midnight. Streetlights, taxis and cops who never sleep.',
      seed: 6603, curvy: 0.6, hilly: 0.5, night: true,
      sky: [[0, '#05060f'], [0.55, '#151a3a'], [0.85, '#3a2a55'], [1, '#6a3a5e']],
      moon: { x: 0.2, y: 0.18, r: 0.025 },
      fog: '#1c1830', fogDensity: 3.4,
      grass: ['#20222a', '#1d1f26'], road: ['#2b2b33', '#28282f'], rumble: ['#8c8c96', '#6a2a34'], lane: '#b8b8c0', center: '#b89a30',
      shoulder: ['#3a3a44', '#35353e'],
      lit: { road: ['#5a5560', '#55505b'], grass: ['#3c3840', '#38343c'], shoulder: ['#6a646a', '#625c62'], rumble: ['#e0dcd8', '#c04050'], lane: '#fff8e8', center: '#f8d050' },
      layers: [
        { kind: 'skyline', parallax: 0.08, h: 0.3, color: '#141428', base: '#141428', windows: '#f4c66a' },
        { kind: 'skyline', parallax: 0.18, h: 0.22, color: '#0c0c18', base: '#0c0c18', windows: '#ffd890', near: true },
      ],
      left: [['lamp', 0], ['building', 3], ['billboard', 0.8], ['hydrant', 0.6]],
      right: [['lamp', 0], ['building', 3], ['billboard', 0.8], ['hydrant', 0.6]],
      farLeft: [['building', 3]], farRight: [['building', 3]],
      lamps: 10,
      traffic: 1.25,
    },
  ];

  const LEVELS = [
    { n: 1, segments: 4300, rivalMph: [118, 134], stamina: 55, traffic: 1.0, cops: 1, weaponChance: 0.35, aggression: 0.75, prize: 1.0, fine: 900, repair: 700 },
    { n: 2, segments: 4700, rivalMph: [132, 148], stamina: 70, traffic: 1.1, cops: 2, weaponChance: 0.5, aggression: 0.9, prize: 1.7, fine: 1600, repair: 1200 },
    { n: 3, segments: 5100, rivalMph: [146, 162], stamina: 85, traffic: 1.2, cops: 2, weaponChance: 0.6, aggression: 1.0, prize: 2.6, fine: 2400, repair: 1900 },
    { n: 4, segments: 5500, rivalMph: [159, 176], stamina: 100, traffic: 1.3, cops: 3, weaponChance: 0.7, aggression: 1.1, prize: 3.6, fine: 3400, repair: 2700 },
    { n: 5, segments: 5900, rivalMph: [172, 190], stamina: 115, traffic: 1.4, cops: 3, weaponChance: 0.8, aggression: 1.2, prize: 5.0, fine: 4600, repair: 3600 },
  ];

  const PRIZES = [2000, 1400, 1000, 700, 520, 380, 280, 200, 140, 100, 70, 50, 30, 20, 10];
  const QUALIFY_PLACE = 3;

  const WEAPONS = {
    fist: { name: 'Fists', damage: 9, reach: 640, push: 0.7, windup: 0.11, dur: 0.38 },
    kick: { name: 'Kick', damage: 6, reach: 600, push: 3.1, windup: 0.13, dur: 0.42 },
    club: { name: 'Club', damage: 16, reach: 780, push: 1.0, windup: 0.17, dur: 0.46 },
    chain: { name: 'Chain', damage: 20, reach: 920, push: 0.9, windup: 0.2, dur: 0.5 },
    baton: { name: 'Baton', damage: 14, reach: 760, push: 1.1, windup: 0.15, dur: 0.44 },
  };

  return { BIKES, RIVALS, TRACKS, LEVELS, PRIZES, QUALIFY_PLACE, WEAPONS };
})();
