// Side-effect CSS imports are resolved by webpack's css-loader, not by tsc.
// TS 6+ reports TS2882 for side-effect imports without declarations.
declare module '*.css';
