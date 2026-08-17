export interface OrbitProfile {
  width: number;
  bodyFrac: number;
  revealS: number;
  accelFrom: number;
  cruiseSpeed: number;
  lifetime: [number, number];
  leaveS: number;
  leaveDecel: number;
  widths?: number[];
  widthMin?: number;
  infinite?: boolean;
}

export const TRADITIONAL: OrbitProfile = {
  width: 4,
  bodyFrac: 0.55,
  revealS: 1.4,
  accelFrom: 0.05,
  cruiseSpeed: 225,
  lifetime: [5, 10],
  leaveS: 1.6,
  leaveDecel: 1.8,
};

export const ISOLATES: OrbitProfile = {
  width: 2,
  widths: [2, 1.5, 1, 1],
  bodyFrac: 0.45,
  revealS: 0.6,
  accelFrom: 0.08,
  cruiseSpeed: 600,
  lifetime: [2.5, 3.5],
  leaveS: 0.9,
  leaveDecel: 1.8,
};

export const PRODUCTS: OrbitProfile = {
  width: 1.25,
  widthMin: 0.25,
  bodyFrac: 0.35,
  revealS: 0.4,
  accelFrom: 1,
  cruiseSpeed: 500,
  lifetime: [2, 4],
  leaveS: 0.8,
  leaveDecel: 2,
};

export const CENTER_SPINNER: OrbitProfile = {
  width: 2,
  widths: [2, 1.5, 1, 1],
  bodyFrac: 0.45,
  revealS: 0.8,
  accelFrom: 0.1,
  cruiseSpeed: 150,
  lifetime: [6, 6],
  leaveS: 0,
  leaveDecel: 1,
  infinite: true,
};
