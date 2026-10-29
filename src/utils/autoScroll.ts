/**
 * Auto-scroll utility for expanding cards, drawers, and collapsible components.
 * Automatically and smoothly scrolls the viewport so that newly deployed content
 * is immediately brought into view without manual scrolling by the user.
 */

export interface AutoScrollOptions {
  /** Offset from the top of the viewport in px to avoid sticky headers (default: 76) */
  topOffset?: number;
  /** Offset from the bottom of the viewport in px for comfortable reading room (default: 115) */
  bottomOffset?: number;
  /** Delay in milliseconds before measuring and scrolling (default: 50) */
  delay?: number;
  /** Known target height of the expanded element if pre-measured */
  targetHeight?: number;
  /** Smooth or instant scroll (default: 'smooth') */
  behavior?: ScrollBehavior;
}

/**
 * Ensures an expanded element (and its newly visible content) is fully visible on the screen.
 * Scrolls further down so the entire expanded card body and bottom actions can be read comfortably.
 */
export function scrollElementIntoView(
  element: HTMLElement | null,
  options: AutoScrollOptions = {}
): void {
  if (!element || typeof window === 'undefined') return;

  const {
    topOffset = 76,
    bottomOffset = 115,
    delay = 50,
    targetHeight,
    behavior = 'smooth'
  } = options;

  const measureFullExpandedHeight = (el: HTMLElement, rectHeight: number): number => {
    let height = Math.max(targetHeight ?? 0, rectHeight, el.scrollHeight);

    const measureRoot = el.querySelector('[data-auto-scroll-measure="true"]') as HTMLElement | null;
    if (measureRoot) {
      height = Math.max(height, measureRoot.scrollHeight, measureRoot.offsetHeight);
    }

    const innerDrawer = el.querySelector('.card-drawer-inner') as HTMLElement | null;
    if (innerDrawer) {
      const header = el.firstElementChild as HTMLElement | null;
      const headerH = header ? header.offsetHeight : 44;
      const drawerContentH = Math.max(
        innerDrawer.scrollHeight,
        innerDrawer.offsetHeight,
        (innerDrawer.firstElementChild as HTMLElement | null)?.scrollHeight ?? 0
      );
      height = Math.max(height, headerH + drawerContentH);
    }

    const acrylicCard = el.querySelector('.acrylic-card') as HTMLElement | null;
    if (acrylicCard) {
      height = Math.max(height, acrylicCard.scrollHeight, acrylicCard.offsetHeight);
    }

    return height;
  };

  const executeScroll = () => {
    if (!element || !element.isConnected) return;

    const rect = element.getBoundingClientRect();
    const fullHeight = measureFullExpandedHeight(element, rect.height);

    const viewportHeight = window.innerHeight;
    const effectiveBottomOffset = Math.min(bottomOffset, Math.floor(viewportHeight * 0.22));
    const maxVisibleBottom = viewportHeight - effectiveBottomOffset;
    const predictedBottom = rect.top + fullHeight;

    let delta = 0;

    if (predictedBottom > maxVisibleBottom) {
      // Scroll down far enough so the entire bottom of the expanded card is comfortably readable
      delta = predictedBottom - maxVisibleBottom;

      // Only cap scroll if the card is taller than the entire viewport, keeping a small top margin (20px)
      // so the newly expanded body and bottom content remain prioritized in view.
      const minTopMargin = 20;
      if (fullHeight < viewportHeight - minTopMargin - effectiveBottomOffset) {
        if (rect.top - delta < minTopMargin) {
          delta = rect.top - minTopMargin;
        }
      }
    } else if (rect.top < topOffset) {
      // Top is hidden above sticky navbar: scroll up to reveal it
      delta = rect.top - topOffset;
    } else if (rect.top > viewportHeight * 0.42 && predictedBottom > viewportHeight * 0.72) {
      // Card expanded in the lower portion of the screen: scroll down gently to place it in the reading zone
      const idealTop = Math.max(topOffset, viewportHeight * 0.24);
      const gentleDelta = Math.min(rect.top - idealTop, predictedBottom - viewportHeight * 0.68);
      if (gentleDelta > 12) {
        delta = gentleDelta;
      }
    }

    if (Math.abs(delta) > 4) {
      window.scrollBy({
        top: delta,
        behavior
      });
    }
  };

  if (delay > 0) {
    setTimeout(executeScroll, delay);
    // Second pass after CSS height/grid transition and ResizeObserver layout settle
    setTimeout(executeScroll, delay + 250);
  } else {
    requestAnimationFrame(() => {
      executeScroll();
      setTimeout(executeScroll, 250);
    });
  }
}
