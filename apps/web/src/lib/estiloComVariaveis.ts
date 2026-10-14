import type { CSSProperties } from 'react';

/** `style` do React que aceita custom properties (`--x`) sem recorrer a `any`. */
export type EstiloComVariaveis = CSSProperties & Record<`--${string}`, string | number | undefined>;
