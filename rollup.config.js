import path from 'path';
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import commonjs from '@rollup/plugin-commonjs';
import postcss from 'rollup-plugin-postcss';
import svelte from 'rollup-plugin-svelte';
import babel from 'rollup-plugin-babel';
import copy from 'rollup-plugin-copy';
import { terser } from 'rollup-plugin-terser';
import config from 'sapper/config/rollup.js';
import json from '@rollup/plugin-json';
import sveltePreprocess from 'svelte-preprocess';
import { mdsvex } from 'mdsvex';
import hljs from 'highlight.js';

import pkg from './package.json';

const mode = process.env.NODE_ENV;

const dev = mode === 'development';
const legacy = !!process.env.SAPPER_LEGACY_BUILD;

const onwarn = (warning, onwarn) =>
  (warning.code === 'CIRCULAR_DEPENDENCY' &&
    /[/\\]@sapper[/\\]/.test(warning.message)) ||
  onwarn(warning);

const purgecss = require('@fullhuman/postcss-purgecss')({
  content: [
    './src/**/*.css',
    './src/**/*.html',
    './src/**/*.svelte',
    './src/**/*.svx',
  ],
  defaultExtractor: content => content.match(/[A-Za-z0-9-_:/]+/g) || [],
});

const preprocess = [
  sveltePreprocess({ postcss: true }),
  mdsvex({
    extension: '.svx',
    layout: path.join(__dirname, 'src/components/MdLayout.svelte'),
    markdownOptions: {
      typographer: true,
      linkify: true,
      highlight: (str, lang) => hljs.highlight(str, lang),
    },
  }),
];

export default {
  client: {
    input: config.client.input(),
    output: config.client.output(),
    plugins: [
      replace({
        'process.browser': true,
        'process.env.NODE_ENV': JSON.stringify(mode),
      }),
      svelte({
        preprocess,
        extensions: ['.svelte', '.svexy', '.svx'],
        dev,
        hydratable: true,
        emitCss: true,
      }),
      resolve({
        browser: true,
        dedupe: ['svelte'],
      }),
      commonjs(),
      json(),
      legacy &&
        babel({
          extensions: ['.js', '.mjs', '.html', '.svelte'],
          runtimeHelpers: true,
          exclude: ['node_modules/@babel/**'],
          presets: [
            [
              '@babel/preset-env',
              {
                targets: '> 0.25%, not dead',
              },
            ],
          ],
          plugins: [
            '@babel/plugin-syntax-dynamic-import',
            [
              '@babel/plugin-transform-runtime',
              {
                useESModules: true,
              },
            ],
          ],
        }),

      !dev &&
        terser({
          module: true,
        }),
    ],

    onwarn,
  },

  server: {
    input: config.server.input(),
    output: config.server.output(),
    plugins: [
      replace({
        'process.browser': false,
        'process.env.NODE_ENV': JSON.stringify(mode),
      }),
      svelte({
        preprocess,
        extensions: ['.svelte', '.svexy', '.svx'], // here actually
        generate: 'ssr',
        dev,
      }),
      postcss({
        extract: './static/global.css',
        plugins: [
          require('postcss-import'),
          require('tailwindcss'), // See tailwind.config.js
          require('autoprefixer'),
          require('postcss-fail-on-warn'),
          // Do not purge the CSS in dev mode to be able to play with classes in the browser dev-tools.
          !dev && purgecss,
          !dev &&
            require('cssnano')({
              preset: 'default',
            }),
        ].filter(Boolean),
      }),
      copy({
        targets: [
          { src: 'src/assets/fonts/*', dest: 'static/assets/fonts' },
          { src: 'content/**/*.{png,jpg}', dest: 'static/assets/content' },
        ],
      }),
      resolve({
        dedupe: ['svelte'],
      }),
      commonjs(),
      json(),
    ],
    external: Object.keys(pkg.dependencies).concat(
      require('module').builtinModules ||
        Object.keys(process.binding('natives'))
    ),

    onwarn,
  },

  serviceworker: {
    input: config.serviceworker.input(),
    output: config.serviceworker.output(),
    plugins: [
      resolve(),
      replace({
        'process.browser': true,
        'process.env.NODE_ENV': JSON.stringify(mode),
      }),
      commonjs(),
      !dev && terser(),
    ],

    onwarn,
  },
};
