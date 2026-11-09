/**
 * destinations.js — Temporal destinations, scramble readout, telemetry.
 */

export const DESTINATIONS = [
  { year: '2026.10.19', location: 'London', era: 'Present Day', lat: '51.50°N', lon: '0.12°W', alt: '24m' },
  { year: '1066.10.14', location: 'Hastings', era: 'Medieval England', lat: '50.86°N', lon: '0.58°E', alt: '45m' },
  { year: '3045.07.22', location: 'Mars Colony', era: 'Terraforming Age', lat: '18.4°N', lon: '77.5°E', alt: '−3km' },
  { year: '1969.07.20', location: 'The Moon', era: 'Apollo 11', lat: '0.67°N', lon: '23.47°E', alt: '−1.9km' },
  { year: '65000000 BC', location: 'Yucatán', era: 'Cretaceous Period', lat: '21.4°N', lon: '89.0°W', alt: '12m' },
  { year: '2781.11.03', location: 'Europa Station', era: 'Solar Expansion', lat: '0.0°', lon: '0.0°', alt: 'ice' },
  { year: '1776.07.04', location: 'Philadelphia', era: 'American Revolution', lat: '39.95°N', lon: '75.16°W', alt: '12m' },
  { year: '4521.01.01', location: 'Andromeda Gate', era: 'Galactic Era', lat: '—', lon: '—', alt: 'void' },
  { year: '1889.03.31', location: 'Paris', era: 'Eiffel Tower Opening', lat: '48.86°N', lon: '2.29°E', alt: '35m' },
  { year: '79.08.24', location: 'Pompeii', era: 'Roman Empire', lat: '40.75°N', lon: '14.49°E', alt: '30m' },
  { year: '2199.12.31', location: 'Neo Tokyo', era: 'Cybernetic Age', lat: '35.68°N', lon: '139.76°E', alt: '40m' },
  { year: '1453.05.29', location: 'Constantinople', era: 'Fall of Byzantium', lat: '41.01°N', lon: '28.98°E', alt: '40m' },
  { year: '9999.12.31', location: 'Heat Death Frontier', era: 'End of Time', lat: '—', lon: '—', alt: '∞' },
  { year: '1609.08.25', location: 'Padua', era: "Galileo's Telescope", lat: '45.41°N', lon: '11.88°E', alt: '12m' },
  { year: '1929.10.29', location: 'New York', era: 'Black Tuesday', lat: '40.71°N', lon: '74.01°W', alt: '10m' },
  { year: '221B', location: 'Baker Street', era: 'Victorian London', lat: '51.52°N', lon: '0.16°W', alt: '27m' },
  { year: '5000000.01.01', location: 'Platform One', era: "Earth's End", lat: '—', lon: '—', alt: 'orbit' },
  { year: '1337.04.01', location: 'Chronos Vault', era: 'Hidden Epoch', lat: '??', lon: '??', alt: 'sealed' },
];

let currentIndex = 0;
let pendingIndex = null;

export function getDestinations() {
  return DESTINATIONS;
}

export function getCurrentDestination() {
  return DESTINATIONS[currentIndex];
}

export function getPendingDestination() {
  if (pendingIndex == null) return null;
  return DESTINATIONS[pendingIndex];
}

export function setPendingDestination(index) {
  if (index < 0 || index >= DESTINATIONS.length) return null;
  pendingIndex = index;
  return DESTINATIONS[index];
}

export function commitPendingDestination() {
  if (pendingIndex != null) {
    currentIndex = pendingIndex;
    pendingIndex = null;
  }
  return DESTINATIONS[currentIndex];
}

export function getRandomDestination() {
  let next;
  do {
    next = Math.floor(Math.random() * DESTINATIONS.length);
  } while (next === currentIndex);
  pendingIndex = next;
  return DESTINATIONS[next];
}

export function formatDestination(dest) {
  return `${dest.year} — ${dest.location}`;
}

/**
 * Character scramble reveal for the time readout.
 */
export function scrambleDisplay(element, destination, duration = 1800, onDone) {
  const target = formatDestination(destination);
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZΩΔΣΨξ∞∂√π$#@%';
  const start = performance.now();
  element.classList.add('scramble');

  const update = () => {
    const progress = Math.min((performance.now() - start) / duration, 1);
    let text = '';
    for (let i = 0; i < target.length; i++) {
      if (target[i] === ' ' || target[i] === '—' || i / target.length < progress) {
        text += target[i];
      } else {
        text += chars[Math.floor(Math.random() * chars.length)];
      }
    }
    element.textContent = text;
    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      element.textContent = target;
      element.classList.remove('scramble');
      if (onDone) onDone();
    }
  };
  requestAnimationFrame(update);
}
