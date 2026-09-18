/* ==========================================================================
   A name that is too long for its slot.

   Truncating with an ellipsis loses the end of the name, which on a yard is
   often the part that tells two horses apart. So instead of clipping, a name
   that does not fit reads itself: it holds, scrolls to the end, holds again,
   and returns.

   It only animates when the text actually overflows — measured, not guessed —
   and it re-measures when the column is resized, so the same component is
   quiet in a wide table and alive in a narrow one. Anyone who has asked their
   system not to animate things gets a plain ellipsis instead.
   ========================================================================== */

import { useEffect, useRef, useState } from "react";

/** How many pixels a second the text travels. Slow enough to read. */
const SPEED = 26;

export default function ScrollName({ children, className = "", title, style, ...rest }) {
  const box = useRef(null);
  const text = useRef(null);
  const [over, setOver] = useState(0);

  useEffect(() => {
    const outer = box.current;
    const inner = text.current;
    if (!outer || !inner) return;

    const measure = () => {
      // a couple of pixels of slack, so sub-pixel rounding does not start it
      const d = Math.round(inner.scrollWidth - outer.clientWidth);
      setOver(d > 3 ? d : 0);
    };
    measure();

    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(outer);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [children]);

  return (
    <span
      ref={box}
      className={`scroller${over ? " on" : ""}${className ? ` ${className}` : ""}`}
      title={title ?? (typeof children === "string" ? children : undefined)}
      style={over ? { ...style, "--d": `${over}px`, "--t": `${over / SPEED + 3.4}s` } : style}
      {...rest}
    >
      <span ref={text}>{children}</span>
    </span>
  );
}
