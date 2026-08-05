// Webpack entry point.
//
// The stylesheet import lives here rather than in PerformanceBandEditor.ts so
// it stays out of the generated declarations: a `.d.ts` carrying
// `import './PerformanceBandEditor.css'` resolves to
// dist/types/PerformanceBandEditor.css for consumers, which does not exist.
// MiniCssExtractPlugin pulls the CSS out into its own file, so this import
// contributes nothing to the JavaScript bundle.
import './PerformanceBandEditor.css';

export { PerformanceBandEditor } from './PerformanceBandEditor';
