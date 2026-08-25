import { listPortfolio } from "../api/portfolio";
import type { PortfolioCollection } from "../types";

let resolved: PortfolioCollection[] | null = null;
let pending: Promise<PortfolioCollection[]> | null = null;

export function readCachedPortfolioList(): PortfolioCollection[] | null {
  return resolved;
}

export function writeCachedPortfolioList(items: PortfolioCollection[]) {
  resolved = items;
}

export function prefetchPortfolioList() {
  return fetchPortfolioList();
}

export function fetchPortfolioList(force = false) {
  if (!force && resolved) {
    return Promise.resolve(resolved);
  }
  if (!force && pending) {
    return pending;
  }

  const request = listPortfolio()
    .then((items) => {
      resolved = items;
      pending = null;
      return items;
    })
    .catch((error) => {
      pending = null;
      throw error;
    });

  pending = request;
  return request;
}

export function invalidatePortfolioList() {
  resolved = null;
  pending = null;
}
