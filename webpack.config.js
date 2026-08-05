const path = require('path');
const webpack = require('webpack');

const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');

const ENVIRONMENT = process.env.NODE_ENV ? process.env.NODE_ENV : 'development';
const BUILD_DIR = process.env.BUILD_DIR ? path.resolve(process.env.BUILD_DIR) : path.resolve(__dirname, './build');

const resolveAliases = {
    env: path.resolve(__dirname, `./env.${ENVIRONMENT}.json`)
};

const resolve = {
    extensions: ['.ts', '.js', '.css'],
    alias: {
        '~': path.resolve('./node_modules'),
        ...resolveAliases
    },
    symlinks: false
};

// esbuild-loader rather than ts-loader: TypeScript 7 is the native Go port and
// exposes no JS compiler API, so ts-loader (which calls createProgram and
// createLanguageService) cannot run against it at all.
//
// esbuild only strips types — it does not type-check, and it never emits
// declarations. Both of those are `tsc`'s job here: `npm run typecheck` and
// `npm run build:types`. CI runs typecheck before build, so the gate still
// holds, but a bare `npm run build` will no longer fail on a type error.
const tsRule = {
    test: /\.ts$/,
    loader: 'esbuild-loader',
    options: {
        loader: 'ts',
        // Keep in step with `target` in tsconfig.json and BUILD_TARGET below.
        target: 'es2020'
    }
};

const cssRule = {
    test: /\.css$/,
    use: [MiniCssExtractPlugin.loader, 'css-loader']
};

// Entry points. src/bundle.ts adds the stylesheet side-effect import that makes
// MiniCssExtractPlugin emit dist/frontend-performance-band.css;
// src/PerformanceBandEditor.ts is the plain module. The CJS build uses the
// latter so it never references CSS at all — bundling it there pulls in
// webpack's automatic-publicPath runtime, which throws outside a browser and
// breaks `require()` at load time.
const BUNDLE_ENTRY = './src/bundle.ts';
const MODULE_ENTRY = './src/PerformanceBandEditor.ts';

// Keep this in step with `target` in tsconfig.json. Webpack emits its own
// runtime wrapper around the bundle, and it uses whatever syntax this allows —
// so a mismatch here silently ships syntax the tsconfig promised not to.
const BUILD_TARGET = ['web', 'es2020'];

const baseConfig = {
    entry: BUNDLE_ENTRY,
    mode: ENVIRONMENT,
    devtool: 'source-map',
    resolve,
    module: { rules: [tsRule, cssRule] },
    watchOptions: {
        ignored: ['dist/**', 'example/**', 'node_modules/**']
    }
};

const productionPlugins = () => [
    new webpack.DefinePlugin({
        'process.env': { NODE_ENV: '"production"' }
    })
];

/**
 * UMD bundle — the <script src> / unpkg entry point, and the one a
 * server-rendered template loads. Exposes `PerformanceBandEditor` as a browser
 * global.
 *
 * The library has no runtime dependencies, so this is genuinely one file: there
 * is no vendor bundle for a host page to load alongside it. Do not introduce
 * `splitChunks` — a host template having to load two files is exactly what the
 * rewrite removed.
 */
const umdConfig = {
    ...baseConfig,
    name: 'umd',
    target: BUILD_TARGET,
    output: {
        path: BUILD_DIR,
        libraryTarget: 'umd',
        globalObject: 'this',
        filename: ENVIRONMENT === 'production' ? 'frontend-performance-band.min.js' : 'frontend-performance-band.js'
    },
    plugins: [
        new MiniCssExtractPlugin({
            filename:
                ENVIRONMENT === 'production' ? 'frontend-performance-band.min.css' : 'frontend-performance-band.css'
        }),
        ...(ENVIRONMENT === 'production' ? productionPlugins() : [])
    ],
    optimization:
        ENVIRONMENT === 'production'
            ? {
                  minimize: true,
                  minimizer: [new TerserPlugin({ extractComments: false }), new CssMinimizerPlugin()]
              }
            : { minimize: false }
};

/**
 * ESM bundle — what bundlers resolve via the "import" condition. Left
 * unminified so downstream tooling can tree-shake and minify it in context.
 * Emits the canonical dist/frontend-performance-band.css consumers import.
 */
const esmConfig = {
    ...baseConfig,
    name: 'esm',
    target: BUILD_TARGET,
    experiments: { outputModule: true },
    output: {
        path: BUILD_DIR,
        filename: 'frontend-performance-band.mjs',
        library: { type: 'module' },
        // The es2020 target alone does not enable module output.
        environment: { module: true, dynamicImport: true }
    },
    plugins: [new MiniCssExtractPlugin({ filename: 'frontend-performance-band.css' }), ...productionPlugins()],
    optimization: { minimize: false }
};

/**
 * CommonJS bundle — the "require" condition, for Node-based consumers and
 * older bundler setups.
 */
const cjsConfig = {
    ...baseConfig,
    name: 'cjs',
    entry: MODULE_ENTRY,
    target: BUILD_TARGET,
    output: {
        path: BUILD_DIR,
        filename: 'frontend-performance-band.cjs',
        library: { type: 'commonjs2' }
    },
    module: { rules: [tsRule] },
    plugins: productionPlugins(),
    optimization: { minimize: false }
};

if (ENVIRONMENT === 'production') {
    console.log('Mode: PRODUCTION');
    module.exports = [umdConfig, esmConfig, cjsConfig];
} else {
    console.log('Mode: DEVELOPMENT');
    module.exports = umdConfig;
}
