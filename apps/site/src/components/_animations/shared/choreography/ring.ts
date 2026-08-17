const RING_BASE_SPEED = 30;
const RING_BOOST_SPEED = 1100;
const RING_BOOST_IN = 0.2;
const RING_BOOST_HOLD = 0.35;
const RING_BOOST_OUT = 1.4;
const RING_DIR_FLIP_TIME = 0.35;
export const RING_DECEL_TIME = 0.8;

const smooth = (x: number) => x * x * (3 - 2 * x);

export function createRingSpinner(ring: HTMLElement | null) {
  let angle = 0;
  let elapsed = 0;
  let boostStart = -1;

  let dir = 1;
  let dirFrom = 1;
  let dirTo = 1;
  let dirFlipStart = -1;
  let dirFlipDuration = RING_DIR_FLIP_TIME;

  return {
    tick(dt: number) {
      elapsed += dt;

      let speed = RING_BASE_SPEED;
      if (boostStart >= 0) {
        const bt = elapsed - boostStart;
        const total = RING_BOOST_IN + RING_BOOST_HOLD + RING_BOOST_OUT;
        if (bt >= total) {
          boostStart = -1;
        } else {
          let f = 1;
          if (bt < RING_BOOST_IN) f = smooth(bt / RING_BOOST_IN);
          else if (bt > RING_BOOST_IN + RING_BOOST_HOLD) {
            const p = (bt - RING_BOOST_IN - RING_BOOST_HOLD) / RING_BOOST_OUT;
            f = (1 - p) ** 3;
          }
          speed += RING_BOOST_SPEED * f;
        }
      }

      if (dirFlipStart >= 0) {
        const ft = elapsed - dirFlipStart;
        if (ft >= dirFlipDuration) {
          dir = dirTo;
          dirFlipStart = -1;
        } else {
          const p = smooth(ft / dirFlipDuration);
          dir = dirFrom + (dirTo - dirFrom) * p;
        }
      }

      angle = (angle + speed * dir * dt) % 360;
      if (ring) ring.style.transform = `rotate(${angle}deg)`;
    },
    decelToStop() {
      dirFrom = dir;
      dirTo = 0;
      dirFlipStart = elapsed;
      dirFlipDuration = RING_DECEL_TIME;
    },
    boost(direction: 1 | -1 = 1) {
      boostStart = elapsed;
      dirFrom = dir;
      dirTo = direction;
      dirFlipStart = elapsed;
      dirFlipDuration = RING_DIR_FLIP_TIME;
    },
  };
}
